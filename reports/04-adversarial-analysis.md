# Adversarial Analysis: Volatility-Adaptive AMM

The V-AMM adjusts its curve shape and fee schedule dynamically based on realized volatility measured from its own trade history. This is a **reflexive system**: traders influence the volatility signal, which changes the curve and fees, which changes how future traders behave. This feedback loop creates attack surfaces that static-curve AMMs simply don't have.

Below we walk through six attack vectors, how each works, and the corresponding mitigations.

---

## 1. Volatility Manipulation via Wash Trading

**What it is.** An attacker executes rapid back-and-forth trades (wash trading) to inflate the on-chain volatility reading, tricking the AMM into high-fee mode. They then harvest inflated fees as an LP.

**How it works.** In flat-curve mode, slippage is near zero for small trades. The attacker alternates buy/sell trades to create artificial price variance. The realized volatility formula `σ² = (1/N) * Σ (ln(P_t / P_{t-1}))²` registers an elevated σ. Once the protocol switches to 100 bps fees, organic traders pay the inflated rate and the attacker — holding a large LP share — collects a proportional cut.

A concrete example: pool depth $10M, attacker LP share 40%, organic volume $5M, high fee 1%, wash trade size $1,000. Revenue: `0.40 × 0.01 × $5M = $20,000`. Cost (50 trades at 5 bps): `50 × 2 × 0.0005 × $1,000 = $50`. Net profit: **~$19,950** per cycle. The costs are trivial because fees paid on wash trades are partially rebated back to the attacker as an LP.

**Mitigation.**
- **Volume-weighted volatility.** A $1,000 trade contributes `($1K/$1M)²` to variance, not `1/N`. Micro-wash trades become statistically invisible.
- **Minimum trade size threshold.** Only trades above a floor (e.g., 0.1% of pool depth) count toward the volatility calculation.
- **Fee-accrual lag.** The fee a trade pays is determined by volatility state *before* the trade, not after. No one-trade pump-and-dump on fees.
- **Robust statistics.** Use Median Absolute Deviation (MAD) instead of standard deviation. MAD tolerates up to 49% outliers.

---

## 2. Sandwich Attacks in Flat-Curve Mode

**What it is.** A flat curve makes sandwich attacks dramatically more profitable because frontrunning is cheaper and victim trades are larger.

**How it works.** In a standard constant-product pool, the attacker pays meaningful slippage to frontrun. In flat-curve mode, the attacker buys a large position with near-zero slippage. Meanwhile, a victim with a 1% slippage tolerance can route 10x more volume through the flat pool (it appears deeper). The attacker frontruns cheaply, the large victim trade moves the price, and the attacker backruns at a profit.

| Curve Type | Victim Trade at 1% Slippage | Frontrun Cost | Attacker Profit |
|------------|------------------------------|---------------|-----------------|
| Steep (CPMM) | $50K | High | ~$3,000 |
| Flat (Stable) | $500K | Near zero | ~$25,000 |

**The mid-sandwich transition variant** is the most dangerous. The attacker frontruns on the *flat* curve (cheap entry), the protocol detects high activity and steepens, the victim executes on the *steep* curve (massive slippage), and the attacker backruns into the dislocated pool. The attacker pays flat-curve prices and sells into steep-curve dislocation.

**Mitigation.**
- **Slippage-lock on transition.** Pending transactions have their slippage checks revalidated against the *new* curve before execution. No mid-block surprises.
- **Commit-reveal for large trades.** Big orders commit in block `t`, execute in block `t+k` with curve parameters frozen at commit time.
- **Flat-curve MEV tax.** Apply an extra fee on trades exceeding a size-to-depth ratio threshold while in flat mode.

---

## 3. Curve Transition Arbitrage

**What it is.** When the AMM transitions from flat to steep (or vice versa), a mechanical price gap opens. Arbitrageurs can front-run this transition for risk-free profit.

**How it works.** In stable-swap math, the marginal price depends on the amplification parameter `A`. At high `A` (flat), the curve forces price toward the peg. At low `A` (steep), the curve approaches constant-product pricing: `P = y/x`. If reserves are imbalanced (e.g., 60/40 after a large trade), reducing `A` causes the pool price to mechanically diverge from the market.

Example: a pool is 60/40 imbalanced at $1.00 market price.
- Flat mode (`A = 1000`): Pool price ≈ $0.95
- Steep mode (`A = 1`): Pool price = 0.4/0.6 = $0.667

That's a **42.5% arbitrage gap** created purely by the transition math. An attacker who sees the transition coming can front-run it: buy the undervalued asset from the pool at $0.667, sell externally at $1.00. Extractable value for a $10M pool at 60/40 imbalance: roughly $1M.

**Mitigation.**
- **Gradual `A` transition.** Don't switch discretely. Ramp `A` linearly over N blocks: `A_t = A_old + (A_new - A_old) × t/N`. Smooths the discontinuity.
- **Virtual reserve adjustment.** When steepening, adjust the virtual reserves (the `D` parameter) so the marginal price equals the last traded price before applying the new `A`. Eliminates the mechanical gap entirely.
- **Atomic transition + swap.** The transition and its pricing effects must happen in the same transaction that triggers it. No inter-block observation window.

---

## 4. Oracle Manipulation

**What it is.** If volatility is computed from a simple rolling window of trade prices, an attacker can pollute the window with fake trades at trivial cost.

**How it works.** For a trade-history oracle using the last `K = 20` trades at 5 bps:
- Each fake trade costs `0.0005 × trade_size`.
- At $100 per trade: `20 × 0.0005 × $100 = $1`.
- Even at $10K per trade: `20 × 0.0005 × $10K = $100`.

One dollar buys full control over the protocol's volatility reading. The attacker can sustain false high volatility for 100 blocks for ~$100.

For a TWAP-based volatility oracle (10-block window), the cost is higher — roughly `(0.05)² × $10M × 5 = $125,000` to create a 5% price variance on a $10M pool — because the attacker must move actual prices, not just log trades. But for trade-count-based windows, manipulation is essentially free.

**Mitigation.**
- **Volume-weighted standard deviation.** A $100 wash trade contributes `($100/$1M)² = 10⁻⁸` to variance. Invisible.
- **External oracle augmentation.** Combine on-chain history with a CEX implied volatility feed or a deep Uniswap v3 TWAP. Use the MAX of the two — external oracles don't respond to wash trades, setting an un-suppressible floor.
- **Sybil-resistant weighting.** Weight each trade's σ contribution by total fees paid. A legitimate $100K trade (50 fee units) drowns out a wash $1K trade (0.05 units).

---

## 5. Fee Gaming

**What it is.** An attacker deliberately triggers high fees to drive traffic away from the V-AMM toward their own venue, or locks the protocol in unfavorable states to extract optionality.

**How it works — competitive fee spiking.** The attacker deposits minimal liquidity, wash-trades to inflate volatility, and the AMM enters 100 bps fee mode. Aggregators (1inch, Jupiter) see the high fee and route around the V-AMM. The attacker's competing venue captures the diverted flow. Cost: wash-trading fees on small trades (~$1,000 for 100 blocks). Gain: capturing even a few hundred thousand in routed flow can be profitable.

**How it works — flat-locking.** The attacker wants to enter a large position with minimal slippage. They suppress the volatility signal (e.g., by trading against any directional moves) to keep the curve flat. After entering, they spike volatility to steepen the curve and raise fees, locking competitors out. This requires absorbing directional flow, which can be expensive if large liquidations arrive.

**Mitigation.**
- **Volatility floor from external oracle.** The on-chain reading cannot drop below the external oracle's reported vol. Prevents "flat-locking" entirely.
- **Fee spike cooldown.** Once fees spike, they cannot spike again for N blocks without sustained organic volatility.
- **Griefing surcharge.** If a single address accounts for >X% of trades in a window, charge them an extra fee that is burned. Makes wash-to-grief expensive even for LPs.

---

## 6. LP Extraction via Toxic Flow

**What it is.** When the market moves sharply but the AMM is still in flat mode (volatility detection has lag), arbitrageurs dump toxic assets into the pool at stale favorable prices. LPs absorb the loss.

**How it works.** The AMM is in flat mode. External market price gaps down 30%. The on-chain volatility calculation lags by several blocks. Before the AMM detects the spike and steepens, arbitrageurs sell the depreciating asset into the flat pool. Because the flat curve resists price deviation, the pool offers prices near the old peg.

Example: $10M pool, 30% crash, `A = 100` (flat):
- To move the pool price from $1.00 to $0.70 requires selling ~$2.5M of the asset.
- The pool absorbs this at an average price of ~$0.85.
- Arbitrageur profit: `($0.85 - $0.70) × $2.5M = $375,000`.

In constant-product mode, the same 30% move requires selling only ~$1.2M — the steep curve protects LPs by making toxic flow expensive. The flat curve does the opposite.

**LP frontrunning during transition.** If the AMM is scheduled to transition from flat to steep with imbalanced reserves, the LP share value drops because steep mode prices the imbalance honestly. An LP who withdraws *before* the transition receives the inflated flat-mode share price; remaining LPs eat the correction. For a 70/30 imbalanced pool, the gap can be 5–15% of TVL.

**Mitigation.**
- **Emergency steepening (circuit breaker).** If a single trade moves the pool price by >2%, immediately drop `A` to minimum and spike fees for N blocks. Stops toxic flow in its tracks.
- **Transition-lock for LPs.** LPs cannot withdraw within M blocks before or after a curve transition. Prevents frontrunning the virtual price change.
- **Imbalance tax.** If reserves deviate from 50/50 by more than Z%, charge an extra fee distributed to LPs. Makes dumping expensive.

---

## Cross-Cutting Mitigation Architecture

The six vectors share common patterns. A defense-in-depth approach layers protections:

**Layer 1 — Oracle hardening.** Volume-weighted stats, external oracle augmentation, robust statistics (MAD, trimmed mean). The volatility signal must be expensive to manipulate.

**Layer 2 — Transition safety.** Gradual `A` ramping, virtual reserve adjustments at boundaries, LP withdrawal locks around transitions. The curve should never create a mechanical gap an arbitrageur can exploit.

**Layer 3 — Anti-griefing economics.** Fee-accrual lags, griefing surcharges on anomalous addresses, dual-track fee calculation using MAX(endogenous, exogenous) volatility. Attackers should pay more than they extract.

**Layer 4 — Circuit breakers.** Emergency steepening on large single-trade impact, rebalancing fees to compensate LPs, pro-rata protection during black-swan events. The protocol must detect and react to attacks faster than attackers can profit.

**Layer 5 — Economic design.** Insurance fund funded by a fraction of fees, dynamic coverage for toxic flow events, co-payment models where LPs bear first-loss to discourage passive free-riding on flat-mode exposure.

---

## Key Takeaways

1. **Volatility manipulation is trivially cheap** unless the oracle uses volume-weighting. A $1 wash trade can carry the same statistical weight as a $1M legitimate swap. Volume-weighted and median-based statistics are non-negotiable.

2. **Flat curves amplify sandwich attacks.** Lower frontrun costs + larger victim trades = higher MEV extraction. Slippage-locks and commit-reveal for large orders are the primary defenses.

3. **Curve transitions create mechanical arbitrage.** A discrete `A` change on imbalanced reserves opens a price gap of 10–40%. Gradual ramping and virtual reserve adjustments eliminate this vector.

4. **External oracles are essential.** On-chain trade history alone is a reflexive signal that adversaries control. A CEX vol feed or deep Uniswap v3 TWAP provides an ungameable floor.

5. **The flat curve is dangerous during real volatility.** When the market moves faster than the oracle can detect, the flat curve offers stale favorable prices that arbitrageurs exploit. Circuit breakers on single-trade price impact are a must.

6. **LP extraction is the ultimate risk.** Whether through transition frontrunning or toxic flow absorption, LPs are the target. Lock-up periods around transitions and insurance funds convert concentrated tail risk into a smoothed, manageable cost.

**The V-AMM is a control system with feedback loops.** Without hardened oracles, safe transitions, and anti-griefing economics, the adaptive mechanism becomes an adaptive vulnerability.
