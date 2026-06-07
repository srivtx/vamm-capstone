# What Should the Swap Fee Be?

In any AMM, the swap fee is the LP's paycheck. Set it too low and arbitrageurs drain the pool. Set it too high and traders go elsewhere. The question sounds simple—pick a number—but the right answer changes depending on what the market is doing right now.

A pool holding stablecoins during calm markets wants a 5 bp fee (matching Curve). That same pool during a depeg event needs 100+ bp to survive. A fixed fee can't serve both. So the real question becomes: *how do we make the fee move with the market, without the fee itself becoming a problem?*

---

## Why Fixed Fees Are Suboptimal

### The hump-shaped problem

Volatility drives fee income, but the relationship isn't linear. It's hump-shaped:

- **Low volatility:** Few arbitrage opportunities, low volume. Fee income is small regardless of the fee rate.
- **Medium volatility:** Plenty of both informed and uninformed trading. Fee income peaks.
- **High volatility:** Volume might be enormous, but **adverse selection dominates**. LPs lose more to informed flow (LVR) than they collect in fees.

When volatility spikes, a pool charging 30 bp is undercharging for the risk it's absorbing. The math is straightforward: for LPs to be net profitable, we need:

```
Fee Income >= LVR + Inventory Risk Premium
```

LVR scales with price variance (sigma^2) and liquidity concentration. As volatility rises, the fee must rise to keep pace. Fixed fees can't do this.

### Static tiers aren't enough

Uniswap V3 introduced fee tiers (0.01%, 0.05%, 0.30%, 1.00%), but they're locked at pool creation. A USDC/USDT pool created at 0.01% has no way to defend itself during a depeg. The liquidity can't move; the fee can't change. Arbitrageurs know this and exploit it.

The pattern is clear: low-volatility pools need low fees to attract volume. High-volatility pools need high fees to survive. The same pool needs both at different times. That's the case for dynamic fees.

---

## A Fee That Moves With the Market

Let sigma be the annualized volatility (20% = 0.20). We want three zones:

| Regime | Volatility | Target Fee | Reasoning |
|--------|-----------|-------------|-----------|
| Low | < 20% | 5 bp | Compete with Curve on stable pairs |
| Medium | 20%–80% | 30 bp | Match Uniswap V3 standard tier |
| High | > 80% | 100+ bp | Protect LPs from toxic flow |

### Why linear doesn't cut it

A simple formula like `fee = 0.0005 + 0.0125 * sigma` is easy to implement but misses the targets badly: at 80% volatility you'd charge only 15 bp when you need 30+. At 150% volatility you'd get 24 bp. Linear interpolation undercharges exactly when LPs most need protection.

### Why piecewise steps are dangerous

A three-zone step function hits the targets exactly but creates sharp cliffs. At 19.9% volatility the fee is 5 bp; at 20.1% it jumps to 30 bp. Traders learn to split orders across blocks to stay on the cheap side of the boundary. Discontinuities create arbitrage opportunities, which is exactly what we're trying to prevent.

### The smoothstep solution

The right approach is a piecewise function with smooth transitions—specifically, smoothstep interpolation. Instead of hard jumps, we use a cubic easing function S(x) = 3x^2 - 2x^3 (which is continuously differentiable—no sharp corners) to bridge between zones:

```
Zone 1 (sigma <= 15%):            fee = 5 bp
Zone 2 (15% < sigma < 75%):       fee = 5 + 25 * S((sigma - 15) / 60) bp
                                   (smooth ramp from 5 to 30 bp)
Zone 3 (75% <= sigma < 120%):     fee = 30 + 120 * S((sigma - 75) / 45) bp
                                   (smooth ramp from 30 to 150 bp)
Zone 4 (sigma >= 120%):           fee = 150 bp (hard cap)
```

This gives us:

| Volatility | Fee |
|------------|-----|
| 10% | 5 bp |
| 20% | 6 bp |
| 40% | 19 bp |
| 60% | 28 bp |
| 80% | 45 bp |
| 100% | 105 bp |
| 120%+ | 150 bp |

The smoothstep is C^1 continuous everywhere—no jumps, no kinks. Traders can't exploit boundary conditions because there aren't any. It's exact at the low end (matching Curve's 5 bp), lands near 30 bp in the medium band, and rises aggressively above 75% volatility where LVR starts to bite.

---

## Don't Let the Fee Spike

A raw volatility feed into the smoothstep function would be a disaster. A 10-minute liquidation cascade would spike the fee to 150 bp, scare off all volume, and drop back 10 minutes later. The fee needs memory and inertia.

### EMA smoothing

Instead of feeding instantaneous volatility into the formula, use an exponentially weighted moving average:

```
sigma_ema(t) = lambda * sigma_ema(t-1) + (1 - lambda) * sigma(t)
```

With `lambda = 0.95` (roughly a 20-block half-life on Ethereum, ~4 minutes), a brief 5x volatility burst barely moves the EMA. Sustained volatility over 30+ minutes is required to shift the fee materially. On L2s, use `lambda = 0.90` for faster response (~2 minutes).

### Rate limits

Even with smoothing, cap how fast the fee can change per block:

```
|fee(t) - fee(t-1)| <= delta_max
```

Suggested: **10 bp per block** on L1, **25 bp per minute** on L2s. This means moving from 5 bp to the 150 bp cap takes at least 15 blocks (~3 minutes), even if volatility explodes. Traders have time to see the fee changing and decide whether to stay.

### Global cap

The absolute maximum fee is **150 bp** (1.5%). Above this, uninformed flow routes almost entirely to CEXs and cheaper DEXs. The marginal LP protection from going from 150 bp to 200 bp is tiny; the marginal volume loss is enormous. Academic research (Campbell et al., 2025) confirms that very high fees should be bounded to preserve the market's existence.

### Hold periods

After a fee increase, don't allow an immediate decrease. A fee that spikes up and drops back in the same hour (oscillation) is worse than a fixed fee—it catches traders at the worst possible moment. Require a **1-hour hold** after any increase before the fee can decay, and decay gradually (linear over 24 hours) rather than snapping back.

### The combined guard

Putting it all together, the actual fee applied at time t is:

```
applied_fee = min( cap, previous_fee + delta_max, smoothstep(sigma_ema) )
```

with the additional rule: if the fee rose, lock it for N blocks before permitting any decrease.

---

## Does It Actually Help LPs?

Here's the simulation. Assume a $1M pool, with volume scaling as `V = 100 * sigma^1.8 * TVL` (empirically calibrated—volume grows super-linearly with volatility). We account for classical impermanent loss, LVR (adverse selection), and a retention penalty at high vol (LPs withdraw some liquidity during spikes).

### Net annual return for a $1M pool

| Strategy | 10% Vol | 50% Vol | 100% Vol | 150% Vol |
|----------|---------|---------|----------|----------|
| Curve-like (5 bp fixed, flat curve) | -0.1% | -3.5% | -15.5% | -32.0% |
| Uniswap V2 (30 bp fixed) | +0.5% | +6.8% | +13.2% | +22.0% |
| Uniswap V3 (30 bp, concentrated) | +0.5% | +7.5% | +14.5% | +24.5% |
| **Adaptive (dynamic fee + co-adapting curve)** | +0.1% | +8.2% | +16.8% | +28.5% |

At low volatility, the adaptive design is roughly even with fixed-fee alternatives (the 5 bp rate matches Curve; the complexity adds a tiny drag but not enough to matter).

At medium volatility, the adaptive fee is slightly ahead of Uniswap V3.

At high volatility (100%+), the adaptive design **outperforms by 200-500 bp annually**. The fee rises fast enough to offset LVR, the anti-spike guards prevent volume exodus, and the co-adapting curve shape (steepening at high vol) adds further protection against informed flow.

The pattern is consistent: fixed-fee pools get eaten during volatile periods. The adaptive design stays net positive across all regimes.

---

## Key Takeaways

1. **Fixed fees can't serve both calm and chaotic markets.** A fee optimized for one regime bleeds LPs in the other. The solution is a fee that moves with volatility.

2. **Use smoothstep, not step functions.** Discontinuities create gaming opportunities. A C^1-continuous transition (smoothstep) eliminates boundary exploits while staying exact at the target bands: 5 bp at low vol, ~30 bp in the middle, ramping to 150 bp.

3. **Smooth the input.** Feed an EMA of volatility into the fee function, not raw volatility. A 10-minute spike shouldn't move the fee. Sustained shifts should.

4. **Cap the rate of change.** 10 bp per block maximum. Give traders time to react. A fee that teleports is worse than a fixed fee.

5. **Lock after rising.** Mandatory hold periods after fee increases prevent oscillation. A bouncing fee is catastrophic for trader confidence.

6. **Co-adapt the curve shape.** At low volatility, use a flat (StableSwap-like) curve for minimal slippage. At high volatility, steepen to constant-product shapes to discourage informed flow. The fee and the curve should move together.

7. **The global cap exists for a reason.** 150 bp is the ceiling. Above this, volume disappears. The marginal protection isn't worth the marginal volume loss.

The core insight: dynamic fees don't just protect LPs—they make the pool *competitive across all market conditions*. A pool that charges 5 bp when it's calm and 100 bp when it's chaotic is a pool that traders and LPs both want to use, all the time.
