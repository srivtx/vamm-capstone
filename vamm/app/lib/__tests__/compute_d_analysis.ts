/**
 * Detailed analysis: WHY V-AMM compute_d diverges from Curve's get_D
 *
 * Run: cd vamm/app && pnpm tsx lib/__tests__/compute_d_analysis.ts
 */

const N = 2n;
const A_PRECISION = 100n;

console.log("╔════════════════════════════════════════════════╗");
console.log("║  compute_d DETAILED ANALYSIS: V-AMM vs Curve  ║");
console.log("╚════════════════════════════════════════════════╝");
console.log();

/**
 * Let's trace the V-AMM compute_d line by line for A=100, pool=[100,100]
 */
{
  const amp = 100n;
  const reserves: [bigint, bigint] = [100n, 100n];
  const sumX = reserves[0] + reserves[1]; // 200

  console.log("━━━ V-AMM compute_d trace (A=100, pool=[100,100]) ━━━");
  console.log();

  // V-AMM: ann = amp * N_COINS * N_COINS = 100 * 2 * 2 = 400
  const v_ann = amp * N * N;
  console.log(`  ann = amp * N * N = ${amp} * ${N} * ${N} = ${v_ann}`);

  // Curve: Ann = amp * N_COINS = 100 * 2 = 200
  const c_Ann = amp * N;
  console.log(`  (Curve would use Ann = amp * N = ${amp} * ${N} = ${c_Ann})`);
  console.log();

  // V-AMM NUMERATOR:
  //   ann * sumX / A_PRECISION + dP * N
  //   = 400 * 200 / 100 + dP * 2
  //   = 800 + 2*dP
  console.log("  V-AMM Newton-Raphson formula:");
  console.log("    numerator = ann * S / A_PRECISION + dP * N");
  console.log(`             = ${v_ann} * ${sumX} / ${A_PRECISION} + dP * ${N}`);
  console.log(`             = ${v_ann * sumX / A_PRECISION} + 2*dP`);
  console.log();

  // V-AMM DENOMINATOR:
  //   (ann / A_PRECISION - 1) * d / A_PRECISION + dP * (N+1)
  //   = (400/100 - 1) * d / 100 + dP * 3
  //   = 3 * d / 100 + 3*dP
  //   = d * 0.03 + 3*dP
  console.log("    denominator = (ann / A_PREC - 1) * d / A_PREC + dP * (N+1)");
  console.log(`               = (${v_ann}/${A_PRECISION} - 1) * d / ${A_PRECISION} + dP * ${N + 1n}`);
  console.log(`               = ${v_ann / A_PRECISION - 1n} * d / ${A_PRECISION} + 3*dP`);
  console.log(`               = d * ${Number(v_ann / A_PRECISION - 1n)}/${Number(A_PRECISION)} + 3*dP`);
  console.log();

  // Curve NUMERATOR:
  //   (Ann * S + D_P * N) * D  / ((Ann - 1) * D + (N + 1) * D_P)
  //   = (200 * 200 + dP * 2) * D / ((200 - 1) * D + 3 * dP)
  //   = (40000 + 2*dP) * D / (199*D + 3*dP)
  console.log("  Curve Newton-Raphson formula:");
  console.log("    D_new = (Ann * S + D_P * N) * D / ((Ann - 1) * D + (N+1) * D_P)");
  console.log(`         = (${c_Ann} * ${sumX} + dP * ${N}) * D / ((${c_Ann} - 1) * D + ${N + 1n} * dP)`);
  console.log(`         = (${c_Ann * sumX} + 2*dP) * D / (${c_Ann - 1n}*D + 3*dP)`);
  console.log();

  // V-AMM rearranged:
  //   D_new = (800 + 2*dP) * D / (0.03*D + 3*dP)
  //
  // Curve:
  //   D_new = (40000 + 2*dP) * D / (199*D + 3*dP)
  //
  // The V-AMM has:
  //   numerator_constant = ann * S / A_PREC = 4*A*S/100 = A*S/25
  //   denominator_D_coeff = (ann/A_PREC - 1) / A_PREC = (4A/100 - 1) / 100
  //
  // The Curve has:
  //   numerator_constant = Ann * S = A*N*S = 2AS
  //   denominator_D_coeff = Ann - 1 = 2A - 1
  //
  // For A=100:
  //   V-AMM:  num_const = 100*200/25 = 800,   denom_D_coeff = (4-1)/100 = 0.03
  //   Curve:  num_const = 200*200   = 40000,  denom_D_coeff = 199

  console.log("  COMPARISON:");
  console.log("    V-AMM numerator constant = A*S/25    = " + Number(amp) * Number(sumX) / 25);
  console.log("    Curve numerator constant = A*N*S     = " + Number(amp * N * sumX));
  console.log("    → Curve is 50x larger");
  console.log();
  console.log("    V-AMM denominator D coeff = (4A/100-1)/100");
  console.log("    Curve denominator D coeff = 2A-1 = " + Number(c_Ann - 1n));
  console.log("    → Curve is ~6633x larger");
  console.log();
  console.log("  The V-AMM A_PRECISION=100 is applied TWICE:");
  console.log("    1. Once in the numerator: ann*S/A_PREC");
  console.log("    2. Once more in the denominator: (ann/A_PREC-1)*d/A_PREC");
  console.log();
  console.log("  In Curve, A_PRECISION is NOT used internally.");
  console.log("  Curve's _A() returns A already at the right scale.");
  console.log("  The V-AMM copied the formula structure but added");
  console.log("  A_PRECISION divisions that don't belong.");
}

console.log();
console.log("━━━ SUMMARY OF ALL BUGS ━━━");
console.log();
console.log("  BUG 1: compute_d — A_PRECISION applied wrong");
console.log("    Rust: ann = amp * 4, then divides by A_PREC=100 in");
console.log("    both numerator AND denominator. This effectively");
console.log("    scales the amplification down by 2500x vs Curve.");
console.log("    For A=100: V-AMM effective_A ≈ 0.04, Curve effective_A = 100.");
console.log("    Result: D is wildly wrong (316 vs 200 for balanced 100/100).");
console.log();
console.log("  BUG 2: compute_y — c formula wrong");
console.log("    Rust: c = D^4 / (8x)           (4 multiplies by D, 3 divides by N/N/xN)");
console.log("    Curve: c = D^3 / (4 * x * Ann)  (3 multiplies by D, divided by Ann)");
console.log("    Missing: /Ann. Extra: *D.");
console.log();
console.log("  BUG 3: compute_y — b formula wrong");
console.log("    Rust: b = x + D * ann / A_PREC  = x + D * 4A / 100");
console.log("    Curve: b = x + D / Ann           = x + D / (2A)");
console.log("    At A=100: V-AMM b ≈ x+4D, Curve b ≈ x+D/200.");
console.log("    Off by ~800x.");
console.log();
console.log("  BUG 4: sigma_to_a — floor check in wrong units");
console.log("    Rust: if exponent >= SCALE (where exponent is unitless ~4, SCALE=1e12)");
console.log("    Should: if (k * sigma / 100) >= SCALE");
console.log("    The floor never triggers, so A stays near A_max at all volatilities.");
console.log();
console.log("  CONCLUSION: All 4 bugs stem from incorrect A_PRECISION scaling.");
console.log("  The V-AMM Rust was likely written by an AI that saw A_PRECISION");
console.log("  in Curve v2 contracts and applied it inconsistently.");
console.log("  The Curve 3Pool Vyper does NOT use A_PRECISION internally —");
console.log("  it stores A at full scale and computes Ann = A * N directly.");
