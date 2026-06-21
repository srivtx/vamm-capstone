/**
 * DEFINITIVE TEST: Which c formula preserves the StableSwap invariant?
 *
 * The invariant (from Curve's get_D at convergence):
 *   Ann * S = (Ann - 1) * D + D_P
 *   where D_P = D³/(4·x·y), Ann = amp * N, S = x + y
 *
 * After a swap, reserves change but D must stay the same.
 * Whichever c formula gives a y that preserves D is correct.
 *
 * Run: cd vamm/app && pnpm tsx lib/__tests__/invariant_test.ts
 */

const N = 2n;

/* ─── get_D (same for both, already proven correct) ─── */
function get_D(xp: [bigint, bigint], amp: bigint): bigint {
  const S = xp[0] + xp[1];
  if (S === 0n) return 0n;
  const Ann = amp * N;
  let D = S;
  for (let i = 0; i < 255; i++) {
    let D_P = D;
    D_P = (D_P * D) / (xp[0] * N);
    D_P = (D_P * D) / (xp[1] * N);
    const Dprev = D;
    D = ((Ann * S + D_P * N) * D) / ((Ann - 1n) * D + (N + 1n) * D_P);
    const diff = D > Dprev ? D - Dprev : Dprev - D;
    if (diff <= 1n) break;
  }
  return D;
}

/* ─── Formula A (current code): c = D³/(4·x·Ann) ─── */
function get_y_formulaA(x: bigint, D: bigint, amp: bigint): bigint {
  const Ann = amp * N;
  // c = D * D / (x * N) * D / (Ann * N) = D³ / (4·x·Ann)
  let c = D;
  c = (c * D) / (x * N);
  c = (c * D) / (Ann * N);
  const b = x + D / Ann;
  let y = D;
  for (let i = 0; i < 255; i++) {
    const yp = y;
    y = (y * y + c) / (2n * y + b - D);
    const diff = y > yp ? y - yp : yp - y;
    if (diff <= 1n) break;
  }
  return y;
}

/* ─── Formula B (claimed fix): c = D³/(2·x·Ann) ─── */
function get_y_formulaB(x: bigint, D: bigint, amp: bigint): bigint {
  const Ann = amp * N;
  // c = D³ / (x * Ann * N)  — only ONE /N instead of two
  //   = D³ / (2·x·Ann)
  let c = (D * D * D) / (x * Ann * N);
  const b = x + D / Ann;
  let y = D;
  for (let i = 0; i < 255; i++) {
    const yp = y;
    y = (y * y + c) / (2n * y + b - D);
    const diff = y > yp ? y - yp : yp - y;
    if (diff <= 1n) break;
  }
  return y;
}

/* ─── Formula C (what if b = x + D/amp, c = D³/(x·amp·N))? ─── */
function get_y_formulaC(x: bigint, D: bigint, amp: bigint): bigint {
  // This is what the Vyper quote literally says:
  // c = D³ * A_PRECISION / (x * _amp * N_COINS)  with A_PRECISION=1
  // b = x + D / _amp
  // where _amp = amp (raw A), NOT Ann
  const c_val = (D * D * D) / (x * amp * N);
  const b = x + D / amp;
  let y = D;
  for (let i = 0; i < 255; i++) {
    const yp = y;
    y = (y * y + c_val) / (2n * y + b - D);
    const diff = y > yp ? y - yp : yp - y;
    if (diff <= 1n) break;
  }
  return y;
}

/* ═══════════════════════════════════════════════════════════════════════════
   INVARIANT PRESERVATION TEST
   ═══════════════════════════════════════════════════════════════════════ */

console.log("╔══════════════════════════════════════════════════════════════╗");
console.log("║  INVARIANT PRESERVATION TEST: which c formula is correct?   ║");
console.log("╚══════════════════════════════════════════════════════════════╝");
console.log();

interface TestCase {
  name: string;
  pool: [bigint, bigint];
  amp: bigint;
  dx: bigint;
}

const tests: TestCase[] = [
  { name: "Balanced 100/100, A=100, swap 50",      pool: [100n, 100n],       amp: 100n,  dx: 50n },
  { name: "Balanced 100/100, A=100, swap 10",       pool: [100n, 100n],       amp: 100n,  dx: 10n },
  { name: "Balanced 100/100, A=10, swap 10",        pool: [100n, 100n],       amp: 10n,   dx: 10n },
  { name: "Balanced 100/100, A=1000, swap 50",      pool: [100n, 100n],       amp: 1000n, dx: 50n },
  { name: "Unbalanced 1000/10, A=100, swap 100",    pool: [1000n, 10n],       amp: 100n,  dx: 100n },
  { name: "Unbalanced 1000/10, A=1000, swap 100",   pool: [1000n, 10n],       amp: 1000n, dx: 100n },
  { name: "Realistic 1M/1M 6dec, A=100, swap 10k",  pool: [1_000_000_000_000n, 1_000_000_000_000n], amp: 100n, dx: 10_000_000_000n },
  { name: "Realistic 1M/1M 6dec, A=100, swap 100k", pool: [1_000_000_000_000n, 1_000_000_000_000n], amp: 100n, dx: 100_000_000_000n },
  { name: "Realistic 1M/1M 6dec, A=2000, swap 10k", pool: [1_000_000_000_000n, 1_000_000_000_000n], amp: 2000n, dx: 10_000_000_000n },
];

console.log("For each test, we compute y with each formula, then re-compute D");
console.log("from the post-swap reserves. The formula that preserves D is correct.");
console.log();

for (const t of tests) {
  const D_before = get_D(t.pool, t.amp);
  const x_new = t.pool[0] + t.dx;

  const yA = get_y_formulaA(x_new, D_before, t.amp);
  const yB = get_y_formulaB(x_new, D_before, t.amp);
  const yC = get_y_formulaC(x_new, D_before, t.amp);

  const dyA = t.pool[1] - yA;
  const dyB = t.pool[1] - yB;
  const dyC = t.pool[1] - yC;

  const D_afterA = get_D([x_new, yA], t.amp);
  const D_afterB = get_D([x_new, yB], t.amp);
  const D_afterC = get_D([x_new, yC], t.amp);

  const diffA = D_afterA > D_before ? D_afterA - D_before : D_before - D_afterA;
  const diffB = D_afterB > D_before ? D_afterB - D_before : D_before - D_afterB;
  const diffC = D_afterC > D_before ? D_afterC - D_before : D_before - D_afterC;

  const okA = diffA <= 1n ? "✅" : "❌";
  const okB = diffB <= 1n ? "✅" : "❌";
  const okC = diffC <= 1n ? "✅" : "❌";

  console.log(`━━━ ${t.name} ━━━`);
  console.log(`  D_before = ${D_before}`);
  console.log(`  Formula A (c=D³/4xAnn):  y=${yA}, dy=${dyA}, D_after=${D_afterA}, diff=${diffA} ${okA}`);
  console.log(`  Formula B (c=D³/2xAnn):  y=${yB}, dy=${dyB}, D_after=${D_afterB}, diff=${diffB} ${okB}`);
  console.log(`  Formula C (c=D³/xAN,b=x+D/A): y=${yC}, dy=${dyC}, D_after=${D_afterC}, diff=${diffC} ${okC}`);
  console.log();
}

console.log("═══════════════════════════════════════════════════════════════");
console.log("The formula that keeps |D_after - D_before| ≤ 1 is correct.");
console.log("A diff > 1 means the invariant is broken → wrong formula.");
console.log("═══════════════════════════════════════════════════════════════");
