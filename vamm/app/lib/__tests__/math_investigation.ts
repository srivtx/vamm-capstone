/**
 * Investigation: V-AMM Rust math vs Canonical Curve Finance math
 *
 * This script implements BOTH:
 *   1. The V-AMM Rust code (1:1 port, as-is)
 *   2. The canonical Curve Finance math (from 3Pool Vyper)
 *
 * Then tests both against the project's own docs (07-walkthrough.md).
 *
 * Run: cd vamm/app && pnpm tsx lib/__tests__/math_investigation.ts
 */

/* ═══════════════════════════════════════════════════════════════════════════
   CANONICAL CURVE FINANCE (from StableSwap3Pool.vy, adapted for N=2)
   ═══════════════════════════════════════════════════════════════════════ */

const N = 2n;

/**
 * Canonical get_D from Curve 3Pool Vyper (line 203-226):
 *
 *   Ann = amp * N_COINS
 *   D_P = D * D / (x * N_COINS)   for each x in xp
 *   D = (Ann * S + D_P * N_COINS) * D / ((Ann - 1) * D + (N_COINS + 1) * D_P)
 *
 * NOTE: In Curve Vyper, the amp parameter ALREADY includes A_PRECISION.
 * i.e. amp = A * A_PRECISION. The Vyper `_A()` function returns `initial_A`
 * which was stored as `_A` in constructor — NOT divided by A_PRECISION.
 *
 * So in Curve:  Ann = amp * N_COINS  (where amp = A * A_PRECISION or just A)
 *
 * The V-AMM Rust does: ann = amp * N_COINS * N_COINS = amp * 4
 * Then divides by A_PRECISION=100 in both numerator and denominator.
 */
function canonical_get_D(xp: [bigint, bigint], amp: bigint): bigint {
  const S = xp[0] + xp[1];
  if (S === 0n) return 0n;

  // In canonical Curve: Ann = amp * N_COINS
  // But we need to be careful about A_PRECISION
  // Curve stores A already scaled (A_PRECISION is applied externally)
  // For our comparison, we'll pass amp as the "effective A" (unscaled)
  const Ann = amp * N;

  let D = S;
  for (let i = 0; i < 255; i++) {
    let D_P = D;
    for (const _x of xp) {
      D_P = (D_P * D) / (_x * N);
    }
    const Dprev = D;
    // D = (Ann * S + D_P * N_COINS) * D / ((Ann - 1) * D + (N_COINS + 1) * D_P)
    D = ((Ann * S + D_P * N) * D) / ((Ann - 1n) * D + (N + 1n) * D_P);

    const diff = D > Dprev ? D - Dprev : Dprev - D;
    if (diff <= 1n) break;
  }
  return D;
}

/**
 * Canonical get_y from Curve (reconstructed from the invariant formula).
 *
 * For N=2 coins, solving for y given x:
 *   Ann·n·S + D = Ann·D + D^(n+1) / (n^n · ∏xi)
 *
 * Rearranged as Newton-Raphson on y:
 *   c = D^(n+1) / (n^n · x_known · n)   (for N=2: c = D^3 / (4 · x · 2))
 *       Wait, let me derive carefully.
 *
 * For n=2, the invariant is:
 *   4A(x+y) + D = 4AD + D³/(4xy)
 *
 * Solving for y:
 *   4Ay + D³/(4xy) = 4AD + D - 4Ax
 *   4Axy² + D³/4 = (4AD + D - 4Ax) · xy
 *   Let b = x + D/(4A), c = D³/(16A · x)
 *   y² + by - D - c = 0  ... hmm, this gets messy.
 *
 * Let me just follow Curve's actual code pattern.
 * In Curve 3Pool get_y (for N_COINS=3), the pattern is:
 *
 *   c = D
 *   for each known reserve x_k (all except j):
 *     c = c * D / (x_k * N_COINS)
 *   c = c * D / (Ann * N_COINS)    <-- NOTE: divided by Ann, NOT by N_COINS alone!
 *
 *   b = S_ + D / Ann               <-- S_ = sum of known reserves
 *
 *   y = D
 *   y_new = (y*y + c) / (2*y + b - D)
 *
 * For N=2 with 1 known reserve x:
 *   S_ = x
 *   c = D * D / (x * N) * D / (Ann * N)
 *     = D³ / (x * 2 * Ann * 2) = D³ / (4 * x * Ann)
 *   b = x + D / Ann
 */
function canonical_get_y(
  i: 0 | 1,
  j: 0 | 1,
  x: bigint,
  xp: [bigint, bigint],
  amp: bigint,
): bigint {
  const D = canonical_get_D(xp, amp);
  const Ann = amp * N;

  // c = D^3 / (x * N * Ann * N) = D^3 / (4 * x * Ann)
  let c = D;
  c = (c * D) / (x * N);       // D^2 / (x*2)
  c = (c * D) / (Ann * N);     // D^3 / (x*2 * Ann*2) = D^3 / (4*x*Ann)

  // b = x + D/Ann
  const b = x + D / Ann;

  let y = D;
  for (let _i = 0; _i < 255; _i++) {
    const y_prev = y;
    y = (y * y + c) / (2n * y + b - D);
    const diff = y > y_prev ? y - y_prev : y_prev - y;
    if (diff <= 1n) break;
  }

  return y;
}

function canonical_getDy(
  xp: [bigint, bigint],
  i: 0 | 1,
  j: 0 | 1,
  dx: bigint,
  amp: bigint,
): bigint {
  const x = xp[i] + dx;
  const y = canonical_get_y(i, j, x, xp, amp);
  const dy = xp[j] - y - 1n;
  return dy < 0n ? 0n : dy;
}


/* ═══════════════════════════════════════════════════════════════════════════
   V-AMM RUST (1:1 port, exactly as in math/mod.rs)
   ═══════════════════════════════════════════════════════════════════════ */

const A_PRECISION = 100n;

function vamm_compute_d(reserves: [bigint, bigint], amp: bigint): bigint {
  const sumX = reserves[0] + reserves[1];
  if (sumX === 0n) return 0n;

  // ann = amp * N_COINS * N_COINS = amp * 4
  const ann = amp * N * N;

  let d = sumX;
  for (let i = 0; i < 64; i++) {
    let dP = d;
    dP = (dP * d) / (reserves[0] * N);
    dP = (dP * d) / (reserves[1] * N);

    const dPrev = d;

    // numerator = ann * sumX / A_PRECISION + dP * N
    const numerator = (ann * sumX) / A_PRECISION + dP * N;

    // denominator = (ann / A_PRECISION - 1) * d / A_PRECISION + dP * (N+1)
    const denominator =
      ((ann / A_PRECISION - 1n) * d) / A_PRECISION + dP * (N + 1n);

    d = (numerator * dPrev) / denominator;

    const diff = d > dPrev ? d - dPrev : dPrev - d;
    if (diff <= 1n) break;
  }
  return d;
}

function vamm_compute_y(x: bigint, d: bigint, amp: bigint): bigint {
  const ann = amp * N * N;

  // c = d*d/N * d/N * d/(x*N) = d^4 / (N * N * x * N) = d^4 / (8x)
  const c = (((((d * d) / N) * d) / N) * d) / (x * N);

  // b = x + d * ann / A_PRECISION
  const b = x + (d * ann) / A_PRECISION;

  let y = d;
  for (let i = 0; i < 64; i++) {
    const yPrev = y;
    const numerator = y * y + c;
    const denominator = 2n * y + b - d;
    y = numerator / denominator;
    const diff = y > yPrev ? y - yPrev : yPrev - y;
    if (diff <= 1n) break;
  }
  return y;
}

function vamm_getDy(
  reserves: [bigint, bigint],
  i: 0 | 1,
  j: 0 | 1,
  dx: bigint,
  amp: bigint,
): bigint {
  const d = vamm_compute_d(reserves, amp);
  const x = reserves[i] + dx;
  const y = vamm_compute_y(x, d, amp);
  const dy = reserves[j] - y - 1n;
  return dy < 0n ? 0n : dy;
}


/* ═══════════════════════════════════════════════════════════════════════════
   TESTS
   ═══════════════════════════════════════════════════════════════════════ */

console.log("╔══════════════════════════════════════════════════════════════╗");
console.log("║  V-AMM MATH INVESTIGATION: Rust vs Canonical Curve Finance  ║");
console.log("╚══════════════════════════════════════════════════════════════╝");
console.log();

/* ─── Test 1: compute_d ─── */
console.log("━━━ TEST 1: compute_d / get_D  (balanced pool 100/100) ━━━");
console.log();

for (const A of [1n, 10n, 100n, 1000n, 10000n]) {
  const vammD = vamm_compute_d([100n, 100n], A);
  const curveD = canonical_get_D([100n, 100n], A);
  const match = vammD === curveD ? "✅" : "❌";
  console.log(
    `  A=${String(A).padStart(5)} │ V-AMM D=${String(vammD).padStart(6)} │ Curve D=${String(curveD).padStart(6)} │ ${match}`,
  );
}

console.log();

/* ─── Test 2: compute_d with unbalanced reserves ─── */
console.log("━━━ TEST 2: compute_d  (unbalanced pool 1000/10) ━━━");
console.log();

for (const A of [1n, 10n, 100n, 1000n]) {
  const vammD = vamm_compute_d([1000n, 10n], A);
  const curveD = canonical_get_D([1000n, 10n], A);
  const match = vammD === curveD ? "✅" : "❌";
  console.log(
    `  A=${String(A).padStart(5)} │ V-AMM D=${String(vammD).padStart(6)} │ Curve D=${String(curveD).padStart(6)} │ ${match}`,
  );
}

console.log();

/* ─── Test 3: get_dy — the critical test ─── */
console.log("━━━ TEST 3: get_dy  (balanced pool 100/100, swap 1 unit A→B) ━━━");
console.log();

for (const A of [1n, 10n, 100n, 1000n, 10000n]) {
  const vammDy = vamm_getDy([100n, 100n], 0, 1, 1n, A);
  const curveDy = canonical_getDy([100n, 100n], 0, 1, 1n, A);
  const match = vammDy === curveDy ? "✅" : "❌";
  console.log(
    `  A=${String(A).padStart(5)} │ V-AMM dy=${String(vammDy).padStart(4)} │ Curve dy=${String(curveDy).padStart(4)} │ ${match}`,
  );
}

console.log();

/* ─── Test 4: Larger swap ─── */
console.log("━━━ TEST 4: get_dy  (pool 100/100, swap 10 units, A=100) ━━━");
console.log();

{
  const vammDy = vamm_getDy([100n, 100n], 0, 1, 10n, 100n);
  const curveDy = canonical_getDy([100n, 100n], 0, 1, 10n, 100n);
  console.log(`  V-AMM dy = ${vammDy}`);
  console.log(`  Curve dy = ${curveDy}`);
  console.log(`  ${vammDy === curveDy ? "✅ Match" : "❌ MISMATCH"}`);
}

console.log();

/* ─── Test 5: The docs worked example ─── */
console.log("━━━ TEST 5: Docs worked example (07-walkthrough.md) ━━━");
console.log("  Pool: 1000 USDC, 10 SOL.  A=1000.  Swap 100 in (fee pre-deducted).");
console.log("  Expected: D ≈ 1010, new_y ≈ 9.05, dy ≈ 0.95");
console.log();

{
  // Note: fee-deducted amount. 100 * (1 - 5/10000) = 99.95.
  // But in integer math with smallest-unit, this would be 9995 if decimals=2.
  // The docs use whole-number units (1000 USDC, 10 SOL).
  // So the net input is 99.95 whole tokens, but since we have integer math,
  // let's scale by 100 to have 2 decimal places: pool=(100000, 1000), dx=9995
  const pool: [bigint, bigint] = [100000n, 1000n];
  const dx = 9995n; // 99.95 scaled by 100

  const vammD = vamm_compute_d(pool, 1000n);
  const curveD = canonical_get_D(pool, 1000n);
  const vammDy = vamm_getDy(pool, 0, 1, dx, 1000n);
  const curveDy = canonical_getDy(pool, 0, 1, dx, 1000n);

  console.log(`  V-AMM:  D=${vammD}, dy=${vammDy}  (dy/100 = ${Number(vammDy)/100} tokens)`);
  console.log(`  Curve:  D=${curveD}, dy=${curveDy}  (dy/100 = ${Number(curveDy)/100} tokens)`);
  console.log(`  Docs expected: D≈101000, dy≈95 (0.95 tokens)`)
}

console.log();

/* ─── Test 6: Large-scale pool (realistic 1M/1M with 6 decimals) ─── */
console.log("━━━ TEST 6: Realistic pool (1M/1M, 6 decimals, swap 10k, A=100) ━━━");
console.log();

{
  const pool: [bigint, bigint] = [1_000_000_000_000n, 1_000_000_000_000n];
  const dx = 10_000_000_000n; // 10,000 tokens with 6 decimals

  const vammDy = vamm_getDy(pool, 0, 1, dx, 100n);
  const curveDy = canonical_getDy(pool, 0, 1, dx, 100n);

  console.log(`  V-AMM  dy = ${vammDy} (${Number(vammDy)/1_000_000} tokens)`);
  console.log(`  Curve  dy = ${curveDy} (${Number(curveDy)/1_000_000} tokens)`);
  console.log(`  Expected: ~9,999 tokens (near 1:1 for balanced pool at high A)`);
  console.log(`  ${vammDy === curveDy ? "✅ Match" : "❌ MISMATCH"}`);
}

console.log();

/* ─── Test 7: Trace compute_y step by step ─── */
console.log("━━━ TEST 7: compute_y trace (pool 100/100, A=100, x=101) ━━━");
console.log();

{
  const pool: [bigint, bigint] = [100n, 100n];
  const A = 100n;

  const vammD = vamm_compute_d(pool, A);
  const curveD = canonical_get_D(pool, A);

  console.log(`  V-AMM D = ${vammD},  Curve D = ${curveD}`);

  // Now trace compute_y for x=101 (after adding 1 unit)
  const x = 101n;

  // V-AMM compute_y internals
  const v_ann = A * N * N; // 400
  const v_c = (((((vammD * vammD) / N) * vammD) / N) * vammD) / (x * N);
  const v_b = x + (vammD * v_ann) / A_PRECISION;
  console.log(`  V-AMM: ann=${v_ann}, c=${v_c}, b=${v_b}`);

  // Canonical compute_y internals
  const c_Ann = A * N; // 200
  let c_c = curveD;
  c_c = (c_c * curveD) / (x * N);     // D^2 / (x*2)
  c_c = (c_c * curveD) / (c_Ann * N); // D^3 / (4*x*Ann)
  const c_b = x + curveD / c_Ann;
  console.log(`  Curve: Ann=${c_Ann}, c=${c_c}, b=${c_b}`);
  console.log();
  console.log(`  KEY DIFFERENCE IN c:`);
  console.log(`    V-AMM c = D^4 / (N * N * x * N) = D^4 / (8x)`);
  console.log(`    Curve c = D^3 / (N * x * Ann * N) = D^3 / (4 * x * Ann)`);
  console.log(`    V-AMM c is missing the /Ann division!`);
  console.log(`    Instead V-AMM has an extra *D multiplication!`);
  console.log();
  console.log(`  KEY DIFFERENCE IN b:`);
  console.log(`    V-AMM b = x + D * ann / A_PRECISION = x + D * 4A / 100 = x + D * A / 25`);
  console.log(`    Curve b = x + D / Ann = x + D / (A * N) = x + D / (2A)`);
  console.log(`    V-AMM b is 12.5x larger (A/25 vs 1/(2A) at A=100: 4 vs 0.005)`);
}

console.log();
console.log("═══════════════════════════════════════════════════════════════");
console.log("CONCLUSION:");
console.log("  The V-AMM Rust compute_y has TWO bugs vs canonical Curve:");
console.log("  1. c formula: D^4/(8x) instead of D^3/(4·x·Ann)");
console.log("     → c is missing the 1/Ann factor and has extra D multiplied");
console.log("  2. b formula: x + D·Ann/A_PREC instead of x + D/Ann");
console.log("     → b is orders of magnitude too large");
console.log("  These cause Newton-Raphson to diverge for small pools.");
console.log("═══════════════════════════════════════════════════════════════");
