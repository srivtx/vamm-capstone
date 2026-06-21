/**
 * PoolSimulator — offline sandbox that mirrors on-chain state transitions.
 *
 * This runs the exact same math as the Anchor program but in the browser,
 * no wallet / RPC needed.  Perfect for demoing the volatility brain.
 *
 * Usage:
 *   const sim = PoolSimulator.create({ ... })
 *   const result = sim.swap(1_000_000n, true)   // swap 1 USDC → USDT
 *   sim.crankVolatility()                        // permissionless brain tick
 *   sim.crankCurve()                             // advance A ramp
 */

import {
  computeD,
  getDy,
  getPrice,
} from "./stableswap";

import {
  SCALE,
  updateEwma,
  tickToReturnSq,
  annualizeVolatility,
  sigmaToA,
  computeFee,
  smoothFee,
  limitFeeChange,
  priceX64ToTick,
} from "./ewma";

/* ─────────────────────────── types ────────────────────────────────────── */

export interface PoolConfig {
  /** Maximum amplification parameter (e.g. 100) */
  aMax: bigint;
  /** Volatility sensitivity (e.g. 200 for k=2.0 scaled by 100) */
  k: bigint;
  /** Base fee in bps (e.g. 5) */
  baseFeeBps: bigint;
  /** Initial reserve A (e.g. 1_000_000_000n for 1000 USDC with 6 decimals) */
  reserveA: bigint;
  /** Initial reserve B */
  reserveB: bigint;
}

export interface Snapshot {
  slot: bigint;
  reserveA: bigint;
  reserveB: bigint;
  curveA: bigint;
  curveATarget: bigint;
  feeBps: bigint;
  ewma15min: bigint;
  sigma: bigint;         // annualized vol (SCALE-based)
  priceX64: bigint;
  spotPrice: bigint;     // 1e18 scaled
  d: bigint;
  /** last swap details (if this snapshot was taken after a swap) */
  swapIn?: bigint;
  swapOut?: bigint;
  swapDirection?: "A→B" | "B→A";
}

export interface SwapResult {
  amountOut: bigint;
  feeAmount: bigint;
  feeBps: bigint;
  priceImpact: number;   // percentage
}

/* ─────────────────────────── simulator ────────────────────────────────── */

export class PoolSimulator {
  /* ─── pool state ─── */
  reserveA: bigint;
  reserveB: bigint;
  totalLpShares: bigint;

  curveACurrent: bigint;
  curveATarget: bigint;
  curveAStart: bigint;
  rampStartSlot: bigint;
  rampEndSlot: bigint;

  baseFeeBps: bigint;
  currentFeeBps: bigint;
  feeEma: bigint;

  protocolFeesA: bigint;
  protocolFeesB: bigint;

  lastSwapSlot: number;
  lastSwapPriceX64: bigint;

  aMax: bigint;
  k: bigint;

  /* ─── volatility state ─── */
  ewma15min: bigint;
  lastTick: number;

  /* ─── sim metadata ─── */
  slot: number;
  history: Snapshot[];

  /* ─── constructor ─── */
  private constructor(cfg: PoolConfig) {
    this.reserveA = cfg.reserveA;
    this.reserveB = cfg.reserveB;
    this.totalLpShares = cfg.reserveA + cfg.reserveB; // initial D approx

    this.curveACurrent = cfg.aMax;
    this.curveATarget = cfg.aMax;
    this.curveAStart = cfg.aMax;
    this.rampStartSlot = 0n;
    this.rampEndSlot = 0n;

    this.baseFeeBps = cfg.baseFeeBps;
    this.currentFeeBps = cfg.baseFeeBps;
    this.feeEma = cfg.baseFeeBps * SCALE;

    this.protocolFeesA = 0n;
    this.protocolFeesB = 0n;

    this.lastSwapSlot = 0;
    this.lastSwapPriceX64 = 0n;

    this.aMax = cfg.aMax;
    this.k = cfg.k;

    this.ewma15min = 0n;
    this.lastTick = 0;

    this.slot = 0n;
    this.history = [];

    // Take initial snapshot
    this.snapshot();
  }

  static create(cfg: PoolConfig): PoolSimulator {
    return new PoolSimulator(cfg);
  }

  /* ─── helpers ─── */

  private reserves(): [bigint, bigint] {
    return [this.reserveA, this.reserveB];
  }

  private priceX64(): bigint {
    if (this.reserveA === 0n) return 0n;
    return (this.reserveB << 64n) / this.reserveA;
  }

  snapshot(swapIn?: bigint, swapOut?: bigint, direction?: "A→B" | "B→A"): Snapshot {
    const sigma = annualizeVolatility(this.ewma15min, 900n);
    const snap: Snapshot = {
      slot: this.slot,
      reserveA: this.reserveA,
      reserveB: this.reserveB,
      curveA: this.curveACurrent,
      curveATarget: this.curveATarget,
      feeBps: this.currentFeeBps,
      ewma15min: this.ewma15min,
      sigma,
      priceX64: this.priceX64(),
      spotPrice: getPrice(this.reserves(), this.curveACurrent),
      d: computeD(this.reserves(), this.curveACurrent),
      swapIn,
      swapOut,
      swapDirection: direction,
    };
    this.history.push(snap);
    return snap;
  }

  /* ─── sync curve (linear interpolation) ─── */

  syncCurve(): void {
    if (this.slot >= this.rampEndSlot) {
      this.curveACurrent = this.curveATarget;
      return;
    }
    if (this.slot <= this.rampStartSlot) return;

    const elapsed = BigInt(this.slot - this.rampStartSlot);
    const duration = BigInt(this.rampEndSlot - this.rampStartSlot);
    if (duration === 0n) {
      this.curveACurrent = this.curveATarget;
      return;
    }

    if (this.curveATarget > this.curveAStart) {
      const diff = this.curveATarget - this.curveAStart;
      const progress = (diff * elapsed) / duration;
      this.curveACurrent = this.curveAStart + (progress < diff ? progress : diff);
    } else {
      const diff = this.curveAStart - this.curveATarget;
      const progress = (diff * elapsed) / duration;
      this.curveACurrent = this.curveAStart - (progress < diff ? progress : diff);
    }
  }

  /* ─── swap ─── */

  swap(amountIn: bigint, isAToB: boolean): SwapResult {
    if (amountIn <= 0n) throw new Error("amountIn must be > 0");
    if (this.reserveA === 0n || this.reserveB === 0n) {
      throw new Error("Pool has zero reserves");
    }

    // Sync curve
    this.syncCurve();

    // Each swap is a Solana transaction — advance slot by 1
    this.slot += 1n;

    // Fee
    const feeBps = this.currentFeeBps;
    const feeAmount = (amountIn * feeBps) / 10_000n;
    const amountInAfterFee = amountIn - feeAmount;

    // StableSwap output
    const [i, j]: [0 | 1, 0 | 1] = isAToB ? [0, 1] : [1, 0];
    const dy = getDy(this.reserves(), i, j, amountInAfterFee, this.curveACurrent);

    // Price impact
    const spotBefore = getPrice(this.reserves(), this.curveACurrent);

    // Update reserves
    if (isAToB) {
      this.reserveA += amountIn;
      this.reserveB -= dy;
    } else {
      this.reserveB += amountIn;
      this.reserveA -= dy;
    }

    // Fee split: 90% LP, 10% protocol
    const lpFee = (feeAmount * 9n) / 10n;
    const protocolFee = feeAmount - lpFee;
    if (isAToB) {
      this.protocolFeesA += protocolFee;
    } else {
      this.protocolFeesB += protocolFee;
    }

    // Update price breadcrumb
    const priceX64 = this.priceX64();
    this.lastSwapSlot = this.slot;
    this.lastSwapPriceX64 = priceX64;

    // Update EWMA
    const tick = priceX64ToTick(priceX64);
    const deltaTick = tick - this.lastTick;
    const returnSq = tickToReturnSq(deltaTick);
    this.ewma15min = updateEwma(
      this.ewma15min,
      returnSq,
      950_000_000_000n, // λ = 0.95
    );
    this.lastTick = tick;

    // Price impact %
    const spotAfter = getPrice(this.reserves(), this.curveACurrent);
    const priceImpact =
      spotBefore > 0n
        ? Number((spotAfter - spotBefore) * 10_000n / spotBefore) / 100
        : 0;

    // Snapshot
    this.snapshot(amountIn, dy, isAToB ? "A→B" : "B→A");

    return {
      amountOut: dy,
      feeAmount,
      feeBps,
      priceImpact: Math.abs(priceImpact),
    };
  }

  /* ─── crank: update_volatility ─── */

  crankVolatility(): {
    sigma: bigint;
    targetA: bigint;
    targetFee: bigint;
    appliedFee: bigint;
    rampStarted: boolean;
  } {
    this.slot += 1n;
    const sigma = annualizeVolatility(this.ewma15min, 900n);
    const clampedSigma = sigma < 5_000_000_000_000n ? sigma : 5_000_000_000_000n;

    // Target A
    const targetA = sigmaToA(clampedSigma, this.aMax, this.k);

    // Target fee
    const targetFee = computeFee(clampedSigma);

    // Smooth fee
    const smoothedFee = smoothFee(targetFee, this.feeEma, 900_000_000_000n);

    // Rate limit
    const limitedFee = limitFeeChange(smoothedFee, this.currentFeeBps, 10n);

    // Apply
    this.currentFeeBps = limitedFee;
    this.feeEma = smoothedFee * SCALE;

    // Check if A ramp needed (>10% difference)
    let rampStarted = false;
    const aDiff =
      targetA > this.curveATarget
        ? targetA - this.curveATarget
        : this.curveATarget - targetA;

    if (aDiff > this.curveATarget / 10n) {
      this.curveAStart = this.curveACurrent;
      this.curveATarget = targetA;
      this.rampStartSlot = this.slot;
      this.rampEndSlot = this.slot + 9000; // ~1 hour
      rampStarted = true;
    }

    this.snapshot();

    return { sigma: clampedSigma, targetA, targetFee, appliedFee: limitedFee, rampStarted };
  }

  /* ─── crank: update_curve ─── */

  crankCurve(): { oldA: bigint; newA: bigint } {
    const oldA = this.curveACurrent;
    this.slot += 1n;
    this.syncCurve();
    this.snapshot();
    return { oldA, newA: this.curveACurrent };
  }

  /* ─── advance slot ─── */

  advanceSlots(n: number): void {
    this.slot += n;
  }

  /* ─── reset ─── */

  reset(cfg: PoolConfig): void {
    const fresh = PoolSimulator.create(cfg);
    Object.assign(this, fresh);
  }

  /* ─── formatted getters for the UI ─── */

  /** Human-readable sigma as a percentage string. */
  get sigmaPercent(): string {
    const sigma = annualizeVolatility(this.ewma15min, 900n);
    // sigma is SCALE-based: 1.0 = SCALE = 100%
    const pct = Number(sigma * 10_000n / SCALE) / 100;
    return pct.toFixed(2);
  }

  /** Human-readable spot price. */
  get spotPriceFormatted(): string {
    const p = getPrice(this.reserves(), this.curveACurrent);
    return (Number(p) / 1e18).toFixed(6);
  }

  /** D invariant. */
  get dInvariant(): bigint {
    return computeD(this.reserves(), this.curveACurrent);
  }
}
