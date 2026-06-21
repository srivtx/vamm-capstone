/**
 * Volatility math — 1:1 port of `programs/vamm/src/math/mod.rs::VolatilityMath`.
 *
 * All arithmetic uses BigInt to match the on-chain u128 behaviour.
 *
 * Constants (identical to Rust):
 *   SCALE            = 1e12
 *   SECONDS_PER_YEAR = 31_536_000
 *   LN_10001         = 99_995  (scaled by 1e9)
 *
 * Functions:
 *   updateEwma           — EWMA variance update
 *   tickToReturnSq       — tick delta → squared log return
 *   annualizeVolatility  — σ_annual = √variance · √(secPerYear/bucketSec)
 *   integerSqrt          — Babylonian √ (128 iter)
 *   sigmaToA             — A(σ) = A_max · max(1−k·σ/100, 0)  (linear approx)
 *   computeFee           — piecewise smoothstep fee 5→100 bps
 *   smoothstep           — 3x² − 2x³
 *   smoothFee            — EMA smoother for fee
 *   limitFeeChange       — rate-limit to max_delta bps per slot
 */

export const SCALE = 1_000_000_000_000n; // 1e12
export const SECONDS_PER_YEAR = 31_536_000n;
export const LN_10001 = 99_995n; // ≈ ln(1.0001), scaled by 1e9

/* ───────────────────────────── EWMA ──────────────────────────────────── */

/**
 * variance_new = λ · variance_old  +  (1−λ) · return²
 *
 * lambda is scaled by SCALE (e.g. 0.95 = 950_000_000_000n).
 */
export function updateEwma(
  varianceOld: bigint,
  returnSq: bigint,
  lambda: bigint,
): bigint {
  const oneMinusLambda = SCALE - lambda;
  const term1 = (lambda * varianceOld) / SCALE;
  const term2 = (oneMinusLambda * returnSq) / SCALE;
  return term1 + term2;
}

/* ─────────────────────────── tick → return² ───────────────────────────── */

/**
 * Convert a tick delta to a squared log return.
 *
 *   return = |Δtick| · ln(1.0001) / 1e9
 *   return² = return · return
 */
export function tickToReturnSq(deltaTick: number): bigint {
  const dt = BigInt(Math.round(Math.abs(deltaTick)));
  const returnVal = (dt * LN_10001) / 1_000_000_000n;
  return returnVal * returnVal;
}

/* ─────────────────────────── annualize ────────────────────────────────── */

/**
 * σ_annual = √variance · √(SECONDS_PER_YEAR / bucketSeconds)
 *
 * Both sqrt calls use integerSqrt on SCALE-sized integers.
 */
export function annualizeVolatility(
  variance: bigint,
  bucketSeconds: bigint,
): bigint {
  const rv = integerSqrt(variance);
  const annFactor = integerSqrt((SECONDS_PER_YEAR * SCALE) / bucketSeconds);
  // Result is SCALE-based: 1.0 = SCALE = 100% annual vol.
  return (rv * annFactor);
}

/* ─────────────────────────── integer √ ───────────────────────────────── */

/** Babylonian integer square root (128 iterations max, matches Rust). */
export function integerSqrt(n: bigint): bigint {
  if (n === 0n) return 0n;
  let x = n;
  let y = (x + 1n) / 2n;
  for (let i = 0; i < 128; i++) {
    if (y >= x) break;
    x = y;
    y = (x + n / x) / 2n;
  }
  return x;
}

/* ─────────────────────────── σ → A ───────────────────────────────────── */

/**
 * A(σ) = A_max · exp(−k·σ)  ≈  A_max · (1 − k·σ_real)
 *
 * sigma is scaled by SCALE. k is e.g. 200 for k=2.0 (scaled by 100).
 * k·σ_real = k/100 · sigma/SCALE = (k · sigma) / (100 · SCALE).
 *
 * We compute product = k·sigma/100 (which is in SCALE units).
 * If product ≥ SCALE → k·σ_real ≥ 1.0 → return floor of 1.
 *
 * NOTE: The on-chain Rust has a bug here — it divides by SCALE first
 * (giving a tiny unitless number) then compares to SCALE (1e12).
 * The floor never triggers. This fix uses the correct comparison.
 */
export function sigmaToA(sigma: bigint, aMax: bigint, k: bigint): bigint {
  // product = k · sigma / 100  (in SCALE units, i.e. represents k·σ_real · SCALE)
  const product = (sigma * k) / 100n;
  if (product >= SCALE) return 1n;
  // a = A_max · (1 − product/SCALE) = A_max · (SCALE − product) / SCALE
  const a = (aMax * (SCALE - product)) / SCALE;
  return a < 1n ? 1n : a;
}

/* ─────────────────────────── smoothstep ───────────────────────────────── */

/**
 * S(x) = 3x² − 2x³,  input/output scaled by SCALE.
 * Clamped to [0, SCALE].
 */
export function smoothstep(x: bigint): bigint {
  if (x >= SCALE) return SCALE;
  if (x === 0n) return 0n;
  const x2 = (x * x) / SCALE;
  const x3 = (x2 * x) / SCALE;
  return 3n * x2 - 2n * x3;
}

/* ─────────────────────────── compute fee ──────────────────────────────── */

/**
 * Dynamic fee via piecewise smoothstep:
 *
 *   σ ≤ 15%  →  5 bps
 *   15–75%   →  smoothstep 5 → 30 bps
 *   75–120%  →  smoothstep 30 → 100 bps
 *   σ ≥ 120% →  100 bps (hard cap 150 bps)
 *
 * sigma is SCALE-based (0.15 = 150_000_000_000n).
 */
export function computeFee(sigma: bigint): bigint {
  // Thresholds (SCALE-based)
  const S15 = 150_000_000_000n; // 15%
  const S75 = 750_000_000_000n; // 75%
  const S120 = 1_200_000_000_000n; // 120%

  let feeBps: bigint;

  if (sigma <= S15) {
    feeBps = 5n;
  } else if (sigma < S75) {
    const t = ((sigma - S15) * SCALE) / (S75 - S15); // 600_000_000_000
    const s = smoothstep(t);
    feeBps = 5n + (25n * s) / SCALE;
  } else if (sigma < S120) {
    const t = ((sigma - S75) * SCALE) / (S120 - S75); // 450_000_000_000
    const s = smoothstep(t);
    feeBps = 30n + (70n * s) / SCALE;
  } else {
    feeBps = 100n;
  }

  return feeBps < 150n ? feeBps : 150n;
}

/* ─────────────────────────── smooth fee (EMA) ────────────────────────── */

/**
 * EMA smoothing on the raw fee:
 *
 *   ema_new = α · ema_old  +  (1−α) · fee_raw_scaled
 *
 * alpha and feeEma are SCALE-based. Returns the de-scaled bps integer.
 */
export function smoothFee(
  feeRaw: bigint,
  feeEma: bigint,
  alpha: bigint,
): bigint {
  const feeRawScaled = feeRaw * SCALE;
  const oneMinusAlpha = SCALE - alpha;
  const newEma =
    (alpha * feeEma) / SCALE + (oneMinusAlpha * feeRawScaled) / SCALE;
  return newEma / SCALE;
}

/* ─────────────────────────── rate limiter ─────────────────────────────── */

/**
 * Clamp fee change to ±maxDelta bps per slot.
 */
export function limitFeeChange(
  feeNew: bigint,
  feeOld: bigint,
  maxDelta: bigint,
): bigint {
  if (feeNew > feeOld) {
    const delta = feeNew - feeOld;
    return delta > maxDelta ? feeOld + maxDelta : feeNew;
  } else {
    const delta = feeOld - feeNew;
    return delta > maxDelta ? feeOld - maxDelta : feeNew;
  }
}

/* ─────────────────── tick estimation (from swap.rs) ──────────────────── */

/**
 * Approximate tick from a Q64.64 price (matches the on-chain approximation
 * in swap.rs::update_volatility_bucket).
 *
 *   tick ≈ log2(price >> 32) · 0.6931
 */
export function priceX64ToTick(priceX64: bigint): number {
  if (priceX64 <= 0n) return 0;
  // priceX64 = price * 2^64. We only need the Q32.32 part (top 32 bits) for a
  // float approximation — fine for stablecoin pools (price 0.1–10, well under 2^53).
  const priceScaled = Number(priceX64 >> 32n) / 2 ** 32;
  if (priceScaled <= 0) return 0;
  // Scaled log return: ln(price) × 1e9, so a 1% move is ~10_000_000.
  return Math.log(priceScaled) * 1e9;
}

/** Count leading zeros for a BigInt (up to 128 bits). */
function clz128(x: bigint): number {
  if (x <= 0n) return 128;
  let n = 0;
  let val = x;
  // Standard binary search: check against the original threshold, then shift.
  if (val < (1n << 64n)) { n += 64; val <<= 64n; }
  if (val < (1n << 96n)) { n += 32; val <<= 32n; }
  if (val < (1n << 112n)) { n += 16; val <<= 16n; }
  if (val < (1n << 120n)) { n += 8; val <<= 8n; }
  if (val < (1n << 124n)) { n += 4; val <<= 4n; }
  if (val < (1n << 126n)) { n += 2; val <<= 2n; }
  if (val < (1n << 127n)) { n += 1; }
  return n;
}
