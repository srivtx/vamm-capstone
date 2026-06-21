/**
 * StableSwap math — CANONICAL Curve Finance implementation for N=2.
 *
 * Reference: Curve 3Pool Vyper (StableSwap3Pool.vy, get_D lines 203-226)
 * Adapted from N=3 to N=2 for the V-AMM two-token pool.
 *
 * NOTE: The on-chain V-AMM Rust has 3 bugs vs canonical Curve:
 *   1. compute_d: A_PRECISION applied twice (scales effective A down ~2500x)
 *   2. compute_y c: D⁴/(8x) instead of D³/(4·x·Ann)
 *   3. compute_y b: x + D·Ann/A_PREC instead of x + D/Ann
 * These are documented in investigation_report.md.
 * This file uses the CORRECT canonical formulas so the simulator works.
 *
 * Functions:
 *   computeD  — Newton-Raphson D invariant solver
 *   computeY  — solve for new reserve_j given new reserve_i
 *   getDy     — trade output (before fee — caller applies fee)
 *   getPrice  — spot price scaled by 1e18
 */

export const N_COINS = 2n;
export const MAX_ITERATIONS = 255;

/* ───────────────────────────── D invariant ────────────────────────────── */

/**
 * Compute D, the StableSwap invariant.
 *
 * From Curve Vyper get_D (line 203-226):
 *   Ann = amp * N_COINS
 *   D_P = D * D / (x * N_COINS)  for each x
 *   D_new = (Ann * S + D_P * N) * D / ((Ann - 1) * D + (N+1) * D_P)
 */
export function computeD(reserves: [bigint, bigint], amp: bigint): bigint {
  const S = reserves[0] + reserves[1];
  if (S === 0n) return 0n;

  const Ann = amp * N_COINS;

  let D = S;
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    let D_P = D;
    D_P = (D_P * D) / (reserves[0] * N_COINS);
    D_P = (D_P * D) / (reserves[1] * N_COINS);

    const Dprev = D;

    // D = (Ann * S + D_P * N) * D / ((Ann - 1) * D + (N+1) * D_P)
    D = ((Ann * S + D_P * N_COINS) * D) / ((Ann - 1n) * D + (N_COINS + 1n) * D_P);

    const diff = D > Dprev ? D - Dprev : Dprev - D;
    if (diff <= 1n) break;
  }

  return D;
}

/* ──────────────────────────── compute Y ───────────────────────────────── */

/**
 * Given the new reserve x_i, the invariant D, and amp, solve for x_j.
 *
 * From Curve Vyper get_y (adapted for N=2, 1 known reserve):
 *   c = D³ / (4 · x · Ann)
 *   b = x + D / Ann
 *   y_new = (y² + c) / (2y + b − D)
 */
export function computeY(x: bigint, d: bigint, amp: bigint): bigint {
  if (x === 0n) throw new Error("computeY: x must be > 0");
  if (d === 0n) throw new Error("computeY: d must be > 0");

  const Ann = amp * N_COINS;

  // c = D * D / (x * N) * D / (Ann * N)
  //   = D³ / (4 · x · Ann)
  let c = d;
  c = (c * d) / (x * N_COINS);
  c = (c * d) / (Ann * N_COINS);

  // b = x + D / Ann
  const b = x + d / Ann;

  let y = d;
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const yPrev = y;
    const numerator = y * y + c;
    const denominator = 2n * y + b - d;
    y = numerator / denominator;

    const diff = y > yPrev ? y - yPrev : yPrev - y;
    if (diff <= 1n) break;
  }

  return y;
}

/* ─────────────────────────── get_dy (trade output) ───────────────────── */

/**
 * Output amount for swapping `dx` of token i → token j.
 * Fee is NOT applied here — the caller deducts fee from dx first.
 */
export function getDy(
  reserves: [bigint, bigint],
  i: 0 | 1,
  j: 0 | 1,
  dx: bigint,
  amp: bigint,
): bigint {
  if (i === j) throw new Error("getDy: i and j must be different");
  if (dx <= 0n) return 0n;
  if (reserves[0] === 0n || reserves[1] === 0n) return 0n;

  const d = computeD(reserves, amp);
  const x = reserves[i] + dx;
  const y = computeY(x, d, amp);
  const dy = reserves[j] - y - 1n; // round down by 1 (matches Curve)
  return dy < 0n ? 0n : dy;
}

/* ─────────────────────────── spot price ───────────────────────────────── */

const PRICE_SCALE = 1_000_000_000_000_000_000n; // 1e18

/**
 * Spot price of token 1 in terms of token 0, scaled by 1e18.
 *
 * Derived from the StableSwap invariant for N=2:
 *   P = dy/dx at the current point on the curve.
 *
 * For the Curve invariant: 4A(x+y) + D = 4AD + D³/(4xy)
 * Taking dF/dx and dF/dy:
 *   P = (4A + D³/(4x²y)) / (4A + D³/(4xy²))
 *   = (16A·x²·y² + D³·y) / (16A·x²·y² + D³·x)
 *
 * We use `amp` here which is the user-facing A (NOT Ann).
 */
export function getPrice(reserves: [bigint, bigint], amp: bigint): bigint {
  if (reserves[0] === 0n || reserves[1] === 0n) return 0n;

  const d = computeD(reserves, amp);
  const a = amp;

  const x2y2 = reserves[0] * reserves[0] * reserves[1] * reserves[1];
  const d3 = d * d * d;

  // The price formula uses "4A" from the invariant (which is A·N for N=2)
  // 16A·x²y² = 4·(4A)·x²y² = 4·Ann·x²y²
  // But for the 2-coin invariant, the coefficient is 4A (not 16A)
  // P = (4A·x²y² + D³·y/(4)) / (4A·x²y² + D³·x/(4))
  // Simplifying: multiply top and bottom by 4:
  // P = (16A·x²y² + D³·y) / (16A·x²y² + D³·x)
  const term1 = 16n * a * x2y2;

  const numerator = term1 + d3 * reserves[1];
  const denominator = term1 + d3 * reserves[0];

  return (numerator * PRICE_SCALE) / denominator;
}
