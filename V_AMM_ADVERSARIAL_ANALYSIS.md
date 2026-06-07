# Adversarial Analysis: Volatility-Adaptive AMM (V-AMM)

**Protocol Definition**
- **Curve Morphing**: The AMM transitions between a flat stable-swap curve (low slippage, suitable for pegged assets) and a steep constant-product curve (high slippage, suitable for volatile assets) based on an on-chain volatility signal.
- **Dynamic Fees**: Trading fees adapt continuously from a baseline of 5 bps (stable regime) up to 100+ bps (volatile regime) based on the same volatility signal.
- **Volatility Oracle**: Realized volatility is calculated from recent trade history (price variance over a rolling window of trades/blocks).

**Key Design Tension**: The protocol uses *endogenous* data (its own trade history) to parameterize *future* execution conditions. This creates reflexivity: traders affect the volatility signal, which affects the curve shape and fees, which affects future traders.

---

## Severity Matrix

| # | Attack Vector | Severity | Exploitability | Profitability | Likelihood | Impact Scope |
|---|---------------|----------|----------------|---------------|------------|--------------|
| 1 | Volatility Manipulation (Wash Trading) | **High** | High | Medium | Medium | Fee griefing / LP yield manipulation |
| 2 | Sandwich Amplification | **Critical** | High | High | High | Direct trader losses |
| 3 | Curve Transition Arbitrage | **Critical** | Medium | Very High | Medium | Protocol / LP value extraction |
| 4 | Griefing Attacks (Fee Spiking) | **Medium** | High | Low | High | Trader UX degradation |
| 5 | Liquidity Migration Attacks | **High** | Medium | High | Low | LP impermanent loss amplification |
| 6 | Volatility Oracle Manipulation | **Critical** | Medium | High | Medium | Systemic parameter manipulation |

---

## 1. Volatility Manipulation (Wash Trading)

### Core Question
Can an attacker artificially inflate on-chain volatility readings to trigger high-fee mode, and can they profit from this manipulation?

### Attack Scenario (Step-by-Step)

**Phase 1: Positioning**
1. Attacker deposits significant liquidity into the V-AMM pool, targeting a large share of the fee revenue (e.g., 30-50% of TVL).
2. Attacker ensures the pool is currently in low-volatility, low-fee mode (5 bps).

**Phase 2: Volatility Inflation**
3. Attacker executes a rapid sequence of small trades back and forth (wash trading) within the same block or across consecutive blocks.
4. Each trade is sized to minimize slippage cost while maximizing the recorded price variance.
5. The on-chain volatility calculator, which uses trade-history price variance, registers an elevated σ.

**Phase 3: Fee Harvesting**
6. The AMM transitions into high-volatility mode. Fees jump from 5 bps to 50-100 bps.
7. Organic traders arriving after the manipulation pay the inflated fees.
8. Attacker, as a major LP, collects a pro-rata share of these inflated fees.

**Phase 4: Cooldown**
9. After sufficient fee extraction, attacker stops wash trading. Volatility readings decay back to normal.
10. Attacker can withdraw liquidity or repeat the cycle.

### Mathematical Feasibility Analysis

**Volatility Model (Simplified)**

Assume the protocol computes annualized realized volatility from the last `N` trades:

```
σ²_window = (1/N) * Σ (ln(P_t / P_{t-1}))²
```

where `P_t` is the marginal price after trade `t`.

For small wash trades of size `δ` relative to pool depth `D`:
- Price impact per trade: `ΔP/P ≈ k * (δ/D)` where `k` depends on curve shape.
- For a stable-swap in flat mode, `k` is very small (e.g., `k ≈ 0.001` for deep pools).
- Log return per trade: `|ln(P_t/P_{t-1})| ≈ k * δ/D`.

After `M` alternating buy/sell trades of size `δ`:
- Each trade creates a price wiggle of magnitude `ε = k * δ/D`.
- If the attacker alternates direction, they create `M` price movements of size `ε`.
- Realized variance contribution: `M * ε²` (assuming uncorrelated, which they are by construction).

**Cost of Manipulation**

For each round-trip (buy + sell):
- Trading fee paid: `2 * f * δ` where `f` is the current fee (5 bps in low-vol mode).
- Slippage loss: In a stable-swap, the curvature is minimal near equilibrium, so slippage is approximately zero for small `δ`. The attacker buys at `P + ΔP/2` and sells at `P - ΔP/2`, losing approximately `(ΔP)² / (2 * P)` in value per trade due to convexity.
- Round-trip slippage cost per trade pair: `≈ (k * δ/D)² * δ`.

Total cost to maintain elevated volatility for `M` trades:
```
Cost = M * [2 * f * δ + (k*δ/D)² * δ]
     = 2Mfδ + Mk²δ⁵/D²
```

**Revenue from Manipulation**

Assume the AMM transitions to high-fee mode `f_high` (e.g., 100 bps) and organic volume `V_organic` arrives while in this mode.
- Attacker's fee revenue: `α * f_high * V_organic` where `α` is their LP share.
- Organic volume is attracted/deterred by fees, but assume `V_organic` is inelastic in the short term (e.g., arbitrageurs, liquidations).

**Profitability Condition**

```
α * f_high * V_organic > M * (2f_low*δ + k²δ⁵/D²)
```

**Numerical Example**
- Pool depth `D = $10M`
- Attacker LP share `α = 40%`
- Organic volume in high-fee window: `V = $5M`
- Low fee `f_low = 0.0005`, high fee `f_high = 0.01`
- Wash trade size `δ = $1,000` (0.01% of pool)
- Price impact factor in flat mode `k = 1` (stableswap near peg)
- Trades needed to trigger threshold `M = 50` (arbitrary protocol threshold)

Revenue: `0.40 * 0.01 * $5,000,000 = $20,000`
Cost: `50 * (2 * 0.0005 * $1,000 + 0) ≈ $50`

**Net profit: ~$19,950 per cycle.**

The cost is negligible because slippage in flat mode is essentially zero for small trades, and fees paid are partially rebated to the attacker as an LP.

**The "Victim" Question**

> *Can the attacker then trade as a "victim" during high-fee periods?*

No. Fees are higher for **everyone** during high-vol mode. The attacker gains not by being a victim but by being a **liquidity provider** harvesting the inflated fees paid by organic traders (arbitrageurs, liquidators, unsophisticated users). The attacker is a fee landlord, not a fee victim.

### Severity Rating: **HIGH**

- **Exploitability**: Very high. Wash trading is permissionless and cheap in flat-curve mode.
- **Profitability**: Medium-to-high. Profit scales with organic volume and attacker LP share.
- **Impact**: Extracts value from organic traders and may cause them to route elsewhere, degrading protocol competitiveness.

### Mitigation Mechanisms

1. **Volume-Weighted Volatility (VWAP-based σ)**: Calculate volatility using volume-weighted price returns. A $1,000 wash trade contributes `($1,000/$1M)²` to variance, not `1/N`. This makes small wash trades statistically invisible.

2. **Trade-Size Minimum for σ Contribution**: Only trades above a minimum size threshold (e.g., 0.1% of pool depth) contribute to the volatility calculation. This filters out micro-wash trades.

3. **Fee-Accrual Lag**: The fee charged on a trade is determined by the volatility state *before* the trade executes, but the volatility update from that trade only affects the *next* block. This prevents the attacker from paying low fees and immediately causing high fees for others in the same block.

4. **Attacker-Resistant σ**: Use the median absolute deviation (MAD) instead of standard deviation. MAD is more robust to a small number of outlier trades.

5. **Dynamic Minimum Fee Floor**: Even in "high vol" mode, if the volume is dominated by a single address or a small cluster of addresses, cap the fee multiplier. This requires Sybil-resistant heuristics.

---

## 2. Sandwich Amplification

### Core Question
Does the flat curve make sandwich attacks more profitable? Can the attacker manipulate the curve shape mid-sandwich?

### Attack Scenario (Step-by-Step)

**Scenario A: Flat-Curve Sandwich (Amplified)**
1. A victim submits a large swap transaction (e.g., $500K USDC → ETH).
2. The pool is in flat (stable-swap) mode. The victim expects low slippage.
3. Attacker frontruns with a buy of ETH, moving the pool along the flat curve. Because the curve is flat, the attacker moves a large amount of ETH with minimal slippage.
4. Victim's swap executes. Because the curve is still flat, the victim's trade size is larger than it would be on a constant-product curve (for the same slippage tolerance). The victim suffers a larger absolute price impact than on a steep curve, but less *percentage* impact.
5. Attacker backruns with a sell of ETH, reversing the trade.
6. Attacker profit = (victim's worse execution price - frontrun price) * attacker size - fees.

**Scenario B: Triggering Flatness to Enable Larger Victim Trades**
1. Attacker monitors mempool for a large swap that would fail slippage checks on a steep curve.
2. Attacker first manipulates the volatility reading down (if possible) or waits for a natural lull, causing the AMM to flatten.
3. The victim's now-acceptable slippage tolerance permits a larger trade.
4. Attacker sandwiches the now-larger victim trade on the flat curve.

**Scenario C: Mid-Sandwich Curve Transition**
1. Attacker frontruns a victim trade.
2. During the same block (or next block), the volatility signal crosses a threshold.
3. The AMM transitions from flat to steep (or vice versa) *before* the victim's trade executes.
4. The victim's slippage calculation, which may have been based on the old curve, is now invalid. The victim receives a drastically worse execution.

### Mathematical Feasibility Analysis

**Sandwich Profit Mechanics**

For a constant-product AMM (steep curve), the sandwich profit on a victim trade of size `Δx` is bounded by the slippage tolerance `s` (typically 0.5-2%).

```
Profit_steep ≈ s * Δx * (attacker_size / victim_size)
```

For a stable-swap (flat curve), the marginal price `P` is much less sensitive to reserves:

```
d²P/dR² ≈ 0  (near equilibrium)
```

This means:
1. **Frontrun is cheaper**: The attacker can buy a large position with minimal slippage, paying a price very close to the current mid.
2. **Victim's trade is larger**: A victim with slippage tolerance `s` can trade much more volume on a flat curve before hitting the limit. If the victim is a router/aggregator, it will route MORE volume through the flat pool because it appears more liquid.
3. **Profit per dollar of frontrun is lower, but total profit is higher**: The flat curve allows the attacker to frontrun with a larger absolute size, capturing a wider spread on a larger victim trade.

**Quantitative Comparison**

| Curve Type | Victim Trade ($500K, 1% slippage) | Attacker Frontrun Cost | Attacker Profit | Profit/Cost Ratio |
|------------|-----------------------------------|------------------------|-----------------|-------------------|
| Steep (CPMM) | $50K can execute within 1% | High (significant slippage) | $3,000 | 6% |
| Flat (Stable) | $500K executes within 1% | Low (minimal slippage) | $25,000 | 25% |

*Note: These are illustrative. The flat curve allows 10x more victim volume, and the attacker can scale their frontrun proportionally.*

**Mid-Sandwich Curve Transition**

If the curve can transition between the frontrun and the victim trade:
- Attacker frontruns on the **flat** curve (cheap entry).
- Protocol detects "high activity" (the frontrun itself) and steepens the curve.
- Victim now executes on the **steep** curve (massive slippage).
- Attacker backruns on the steep curve (high exit price due to victim's steep-curve suffering).

This is the **most dangerous variant**: the attacker pays flat-curve prices and sells into a steep-curve-dislocated pool.

### Severity Rating: **CRITICAL**

- **Exploitability**: High. MEV searchers already run sandwich bots; they will adapt to curve dynamics.
- **Profitability**: Very high in flat mode. The flat curve is a larger surface area for sandwich attacks.
- **Impact**: Direct extraction from victim traders. May cause protocols/aggregators to blacklist the V-AMM.

### Mitigation Mechanisms

1. **Slippage-Lock on Curve Transition**: When the curve transitions, all pending transactions must have their slippage checks revalidated against the *new* curve before execution. This prevents mid-block curve transitions from surprising users.

2. **Fee Burn on Extreme Transitions**: If the curve transitions by more than `X%` in a single block, a portion of fees in that block is burned rather than distributed. This reduces the incentive to trigger transitions for sandwiching.

3. **Aggregator-Level Circuit Breakers**: Encourage integrators to check the current curve regime before routing. If the pool is near a transition boundary, route elsewhere.

4. **Commit-Reveal for Large Trades**: Large trades must be committed in block `t` and can only execute in block `t+k` with the curve parameters fixed at commit time. This prevents mid-sandwich transitions.

5. **Flat-Curve Sandwich Tax**: In flat mode, apply an additional MEV tax (e.g., 10 bps) on trades that exceed a certain size threshold relative to pool depth. This directly taxes sandwich profitability.

---

## 3. Curve Transition Arbitrage

### Core Question
When the AMM transitions from flat to steep (or vice versa), does an arbitrage gap appear between the pool price and the market price? Can an attacker front-run or back-run the transition?

### Attack Scenario (Step-by-Step)

**Scenario A: Flat → Steep Transition (Volatility Spike)**
1. The pool is in flat mode. Market price of the volatile asset is $1,000. The pool price is also $1,000 (flat curve enforces tight peg).
2. External volatility occurs (e.g., Binance price jumps to $1,100).
3. The AMM detects elevated trade variance and begins transitioning from flat to steep.
4. During the transition, the effective "A" parameter (amplification coefficient) drops from `A_high` to `A_low`.
5. The pool's implied price for the same reserves **changes** because the pricing formula depends on `A`.

For the same reserves `(x, y)`, the marginal price `P = dy/dx` is a function of `A`:
- At `A → ∞` (perfectly flat): `P → 1` (for stable pairs)
- At `A → 0` (constant product): `P = y/x`

If the reserves are imbalanced (e.g., more y than x due to recent trading), reducing `A` causes the marginal price to shift toward `y/x`, which may diverge significantly from the external market.

6. Arbitrageur sees that the transition will cause the pool price to dislocate.
7. Arbitrageur front-runs the transition transaction with a trade that profits from the known post-transition price.

**Scenario B: Front-Running the Transition Trigger**
1. Attacker observes that the volatility threshold is about to be breached (e.g., 49/50 "volatility points" accumulated).
2. Attacker executes a small trade to push the volatility signal over the threshold.
3. The AMM transitions to steep mode in the next block.
4. The steep mode pricing, applied to current (possibly imbalanced) reserves, creates a price dislocation.
5. Attacker backruns with an arbitrage trade that corrects this dislocation, pocketing the difference.

### Mathematical Feasibility Analysis

**Stable-Swap Price Sensitivity to A**

The stable-swap invariant for two assets is:

```
A * n^n * Σx_i + D = A * D * n^n + D^(n+1) / (n^n * Πx_i)
```

For `n=2`:
```
A * 4 * (x + y) + D = A * D * 4 + D³ / (4xy)
```

Solving for marginal price `P = -dy/dx` at constant `D`:
```
P = (A * 4 + D³/(4x²y)) / (A * 4 + D³/(4xy²))
```

As `A → ∞`: `P → y/x`? No, as `A → ∞`, the equation forces `x + y → D/2` and `x ≈ y`, so `P → 1`.
As `A → 0`: `P → y/x` (constant product).

**Price Gap at Transition**

Assume reserves are imbalanced due to a prior trade: `x = 0.6D`, `y = 0.4D` (in value terms, assuming both assets are pegged at $1 for simplicity).
- At `A = 1000` (flat): The curve strongly penalizes imbalance. Marginal price `P_flat ≈ 0.95` (slight discount for the scarce asset).
- At `A = 1` (steep): The curve acts like constant product. Marginal price `P_steep = y/x = 0.4/0.6 = 0.667`.

If the external market price is $1.00, the pool was trading near $1.00 in flat mode. After transitioning to `A=1`, the pool's internal pricing mechanism suddenly values the scarce asset at $0.667, even though the market still values it at $1.00.

This creates an **instant arbitrage gap of ~42.5%** relative to the flat-mode price.

**Arbitrage Profit**

Attacker with capital `K`:
1. Before transition: Pool price = $1.00. Attacker does nothing (or subtly imbalances the pool).
2. Transition occurs: Pool price mechanically drops to $0.667.
3. Attacker buys the now-undervalued asset from the pool at $0.667.
4. Attacker sells on the external market at $1.00.
5. Profit per unit: `1.00 - 0.667 = $0.333` (minus fees).
6. Maximum extractable: limited by the depth of the price dislocation. For a $10M pool with 60/40 imbalance, the attacker can extract roughly `0.10 * TVL = $1M` in value before the pool rebalances.

**Transition Lag Exploit**

If the transition is triggered by a trade and the pricing update is not atomic:
1. Victim trades in block `t` (last trade before threshold).
2. Protocol updates volatility in block `t+1` and transitions.
3. The new curve is applied to old reserves.
4. Arbitrageur in block `t+2` extracts the gap.

The profit is pure arbitrage with zero directional risk.

### Severity Rating: **CRITICAL**

- **Exploitability**: Medium. Requires understanding of stable-swap math and monitoring transition thresholds.
- **Profitability**: Very high. Transition gaps can be 10-40% of TVL.
- **Impact**: Direct value extraction from LPs. The LPs suffer the arbitrage loss as the pool is drained at unfavorable prices.

### Mitigation Mechanisms

1. **Gradual A Transition**: Do not switch `A` discretely. Transition linearly over `N` blocks (e.g., `A_t = A_old + (A_new - A_old) * t/N`). This smooths the price discontinuity.

2. **Transition-Triggered Rebalancing Fee**: Apply a one-time "reorganization fee" to trades in the first block after a transition. This fee is distributed to LPs to compensate for the arbitrage gap.

3. **Virtual Reserve Adjustment**: When transitioning to a steeper curve, adjust the virtual reserves (the `D` parameter) to align the marginal price with the last traded price before applying the new `A`. This eliminates the mechanical price gap.

4. **Atomic Transition + Swap**: Ensure that the curve transition cannot be observed and reacted to in a separate block. The transition and its pricing effects must occur atomically within the same transaction that triggers it, preventing inter-block arbitrage.

5. **Transition Oracle**: Use an external price oracle at the moment of transition to verify the pool price is within `X%` of the market. If not, delay the transition or apply a correction.

---

## 4. Griefing Attacks (Fee Spiking)

### Core Question
Can an attacker deliberately trigger high fees to deter other traders? Can they lock the AMM into an unfavorable curve mode?

### Attack Scenario (Step-by-Step)

**Scenario A: Competitive Fee Spiking**
1. Attacker operates a competing DEX or is a market maker on another venue.
2. Attacker wants to prevent organic flow from routing through the V-AMM.
3. Attacker deposits a small amount of liquidity, then wash-trades to spike the volatility reading.
4. The V-AMM enters 100 bps fee mode.
5. An aggregator (e.g., 1inch, Jupiter) evaluating the V-AMM sees the 100 bps fee and routes the trade to the attacker's preferred venue instead.
6. Attacker withdraws their small LP position. The high fees persist until organic flow cools down the volatility reading.

**Scenario B: Liquidity Locking**
1. Attacker wants to enter a large position but wants to do so on a flat curve (low slippage).
2. Attacker manipulates the volatility down to keep the curve flat.
3. After entering their position, they immediately spike volatility to steepen the curve.
4. Other traders now face high slippage and high fees, unable to compete with the attacker's position.

**Scenario C: Optionality Extraction**
1. Attacker holds a large options position (e.g., straddle) on the pool's underlying assets.
2. Attacker knows that if the V-AMM enters high-vol mode, market sentiment shifts and the realized volatility increases.
3. Attacker manipulates the V-AMM volatility signal to trigger high-vol mode.
4. The psychological/market signal causes actual volatility, making the attacker's options profitable.

### Mathematical Feasibility Analysis

**Fee Griefing Cost**

Attacker's cost to spike fees for `T` blocks:
```
Cost = Gas_cost * T + Wash_trading_fees * T
```

If the attacker holds no LP position:
- They pay full fees on wash trades.
- Cost per block: `2 * f * δ` (one round-trip).
- For `f = 5 bps`, `δ = $10K`, `T = 100` blocks: `Cost = 100 * 2 * 0.0005 * $10K = $1,000`.

**Attacker Gain**
- If they route just `$100K` of flow to their own venue at a 20 bps markup: `$200`.
- Over 100 blocks, if they capture `$1M` of flow: `$2,000`.
- **Net profit: ~$1,000** for relatively low cost.

The attack is more profitable if:
- The attacker is a large LP on the competing venue.
- The attacker has a market-making agreement with another DEX.
- The attacker is hedging a large OTC trade.

**Curve Locking**

Keeping the curve flat artificially:
- Requires suppressing the volatility signal.
- Attacker must ensure no large trades occur, or actively trade against large moves to neutralize price variance.
- This is a "volatility sink" attack: the attacker absorbs directional flow to prevent the AMM from detecting it.
- Cost scales with the size of directional flow they must absorb.
- If a large liquidation is incoming, the attacker must trade against it to keep prices stable, which is extremely costly.

### Severity Rating: **MEDIUM**

- **Exploitability**: High. Very low cost to grief.
- **Profitability**: Low-to-medium. Profit is indirect (competitive advantage, optionality).
- **Impact**: Degrades UX and can cause the V-AMM to lose market share to competitors.

### Mitigation Mechanisms

1. **Volatility Floor**: The volatility signal has a minimum value based on external oracle data (e.g., Chainlink). The on-chain calculation cannot be suppressed below the oracle's reported 1-hour realized vol. This prevents "flat-locking."

2. **Fee Spike Cooldown**: Once fees spike, they cannot spike again for `N` blocks without a sustained volatility increase. This prevents rapid cycling between griefing and normal modes.

3. **Griefing Tax**: If a single address accounts for >`X%` of trades in a window, its trades are charged an additional "griefing surcharge" that is burned. This makes wash-trading to spike fees expensive even for LPs.

4. **Dual-Track Volatility**: Maintain two volatility signals—one from trade history and one from external oracle. The AMM uses the MAX of the two. This prevents suppression attacks (external oracle is hard to manipulate) and makes inflation attacks less effective (external oracle caps the minimum).

5. **Trader Rebate for Griefing**: If the protocol detects a griefing pattern, it issues fee rebates to organic traders who were affected, funded by the attacker's slashed LP rewards.

---

## 5. Liquidity Migration Attacks

### Core Question
If the AMM is in flat mode and receives a large volatile trade, what happens? Can an attacker drain liquidity by exploiting mismatched curve/volatility states?

### Attack Scenario (Step-by-Step)

**Scenario A: Flat-Curve Toxic Flow**
1. The AMM is in flat mode (`A` is high) because recent volatility was low.
2. External market price suddenly gaps down 30% (e.g., black swan event).
3. The AMM's on-chain volatility calculation has a lag (e.g., 5-block rolling window).
4. Before the AMM detects the volatility and transitions to steep mode, arbitrageurs dump the depreciating asset into the flat-curve pool.
5. Because the curve is flat, the arbitrageur receives a price very close to the old peg, even though the market has moved 30%.
6. The pool absorbs the toxic flow at a massive loss. LPs suffer because the flat curve offered insufficient price protection.

**Scenario B: Attack-Induced Mismatch**
1. Attacker observes that the V-AMM has a 5-block volatility lag.
2. Attacker triggers a large price dislocation on an external venue (e.g., a perp market) via a market order.
3. Simultaneously, the attacker trades against the V-AMM in the same block.
4. The V-AMM, still in flat mode, offers the attacker a much better price than a steep-mode AMM would.
5. The AMM only transitions to steep mode in block `t+1`, after the attacker has already extracted value.

**Scenario C: LP Exit During Mismatch**
1. The AMM is in flat mode but has accumulated significant imbalance (e.g., 70/30) due to a recent large trade.
2. The volatility threshold is breached, and the AMM is scheduled to transition to steep mode in the next block.
3. An LP observes that their position will be worth less in steep mode (because steep mode prices the imbalance more harshly).
4. The LP frontruns the transition by withdrawing liquidity in flat mode.
5. After the LP exits, the remaining LPs bear the full brunt of the steep-mode price correction.

### Mathematical Feasibility Analysis

**Toxic Flow Extraction in Flat Mode**

For a pool with reserves `(x, y)` where `y` is the depreciating asset:
- Market price after crash: `P_market = 0.7 * P_before`.
- In flat mode, the pool price `P_pool ≈ P_before` (flat curve resists deviation).
- Arbitrageur sells `y` to the pool until `P_pool` aligns with `P_market`.

But because the curve is flat, aligning `P_pool` with `P_market` requires selling a **massive** amount of `y`.

For stable-swap with `A = 100`, `D = $10M`:
- To move the price from $1.00 to $0.70 requires selling approximately `Δy ≈ 0.25 * D = $2.5M` worth of the asset.
- The pool absorbs this at an average price of ~$0.85.
- Arbitrageur profit: `($0.85 - $0.70) * $2.5M = $375,000`.
- LP loss: `$375,000` (plus the 30% write-down on remaining inventory).

**Comparison with Steep Mode**

In constant-product mode, the same 30% price move requires selling only `Δy ≈ 0.12 * D = $1.2M`.
- The pool suffers less volume at bad prices.
- Arbitrageur profit is smaller because slippage protects LPs.

The flat curve is **dangerous in volatile regimes** because it invites large toxic flow by offering attractive prices far from market.

**LP Frontrunning During Transition**

At the moment of transition from flat to steep, the pool's "virtual price" (value per LP token) changes.

For a 70/30 imbalanced pool:
- Flat mode virtual price: `V_flat = f_flat(x, y)` — higher because the curve assumes reversion to peg.
- Steep mode virtual price: `V_steep = 2√(xy)` — lower because it prices the imbalance honestly.

An LP withdrawing in flat mode receives `V_flat` per share.
An LP remaining receives `V_steep` per share after transition.

The difference: `V_flat - V_steep` can be 5-15% of TVL for significant imbalances.

### Severity Rating: **HIGH**

- **Exploitability**: Medium. Requires timing and capital.
- **Profitability**: High. Can extract 5-20% of TVL in a single event.
- **Impact**: LPs suffer sudden, concentrated losses. Can trigger bank runs.

### Mitigation Mechanisms

1. **Emergency Steepening (Circuit Breaker)**: If a single trade moves the pool price by >`X%` (e.g., 2%), immediately drop `A` to minimum and spike fees to maximum for the next `N` blocks. This prevents large toxic flow from exploiting the flat curve.

2. **Dynamic A Based on Instantaneous Divergence**: Rather than pure trade-history volatility, use `A = f(max(|P_pool - P_oracle|, σ_history))`. If the pool price diverges from an external oracle by more than `Y%`, ignore the historical volatility and enter emergency steep mode.

3. **Transition-Lock for LPs**: LPs cannot withdraw within `M` blocks before or after a curve transition. This prevents frontrunning the virtual price change.

4. **Imbalance Tax**: If reserves deviate from 50/50 by more than `Z%`, an extra fee is charged and distributed to LPs. This taxes toxic flow entering at bad prices.

5. **Insurance Fund for Flat-Mode Toxic Flow**: A portion of all fees (e.g., 20%) is reserved for an insurance fund that pays out to LPs who suffer sudden losses during flat-to-steep transitions caused by external volatility.

---

## 6. Volatility Oracle Manipulation

### Core Question
If using TWAP for volatility: how many blocks of manipulation are needed? If using trade history: how many fake trades are needed? What is the minimum cost to maintain false volatility for X blocks?

### Attack Scenario (Step-by-Step)

**Scenario A: TWAP-Based Volatility Manipulation**
1. Protocol uses an N-block TWAP of prices to compute volatility.
2. Attacker trades against the pool for `N/2` consecutive blocks, pushing the TWAP in one direction.
3. Then reverses direction for `N/2` blocks, creating variance.
4. The TWAP registers high volatility even though the attacker's net position is flat.

**Scenario B: Trade-History Volatility Manipulation**
1. Protocol maintains a ring buffer of the last `K` trade prices.
2. Attacker executes `K` small trades with alternating directions, each at a slightly different price.
3. The calculated standard deviation of these `K` prices is artificially high.
4. The protocol enters high-volatility, high-fee mode.

**Scenario C: Sustained False Volatility**
1. Attacker wants to keep the AMM in high-fee mode for `X` blocks (e.g., to grief a competitor's launch).
2. Every `K` trades, the attacker injects a new fake trade to keep the rolling window polluted.
3. The cost is the sum of all fake trade fees and slippage.

### Mathematical Feasibility Analysis

**TWAP Manipulation Cost**

For an `N`-block TWAP:
- To create an apparent price variance `σ²`, the attacker must create price deviations of magnitude `δ` over the window.
- The TWAP after `N` blocks of manipulation: `P_Twap = (1/N) * Σ P_i`.
- To manipulate the TWAP by `δ` from true price `P*`, the attacker must trade at `P* ± δ` for `m` blocks.
- Cost is quadratic in the manipulation magnitude: `Cost ≈ (δ² / η) * TVL * m`, where `η` is a liquidity constant.

For a 10-block TWAP on a $10M pool:
- To create a 5% price variance: `Cost ≈ (0.05)² * $10M * 5 = $125,000`.
- This is a lower bound; actual cost is higher due to fees and competitor arbitrage.

**Trade-History Manipulation Cost**

If the protocol uses the last `K=20` trades:
- Attacker needs to be the sole or dominant trader in the window.
- Each fake trade costs `f * trade_size` in fees.
- To maximize price variance with minimal cost, the attacker should:
  - Use the smallest possible trade size that still registers (e.g., $100).
  - Alternate direction every trade.
  - Space trades to avoid being filtered as wash trading.

Cost for `K=20` trades at 5 bps, $100 each: `20 * 0.0005 * $100 = $1`.
This is **trivially cheap** unless the protocol filters by trade size.

If there is a minimum size threshold of 0.1% of TVL ($10K for a $10M pool):
- Cost: `20 * 0.0005 * $10K = $100`.
- Still very cheap.

**Sustained Manipulation for X Blocks**

If the attacker must maintain false volatility for `X` blocks, and the window is `K` trades:
- The attacker must inject at least one manipulative trade every block (or every trade slot) to keep the window populated.
- For `X = 100` blocks, 1 trade per block:
  - Total cost: `100 * f * δ`.
  - For `f = 5 bps`, `δ = $1K`: `100 * 0.0005 * $1K = $50`.
  - For `δ = $10K`: `100 * 0.0005 * $10K = $500`.

**Minimum Cost Summary**

| Window Type | Blocks/Trades | Min Trade Size | Fee | Cost per Block | Cost for 100 Blocks |
|-------------|---------------|----------------|-----|----------------|---------------------|
| TWAP (10-block) | 5 active | $10K | 5 bps | $50 | $5,000 |
| Trade History (20 trades) | 20 trades | $1K | 5 bps | $1 | $100 |
| Trade History (20 trades) | 20 trades | $10K | 5 bps | $10 | $1,000 |
| TWAP (100-block) | 50 active | $100K | 5 bps | $5,000 | $500,000 |

### Severity Rating: **CRITICAL**

- **Exploitability**: Medium. Very cheap for trade-history-based oracles.
- **Profitability**: High (indirect via fee extraction or griefing).
- **Impact**: Can distort protocol behavior for extended periods at trivial cost.

### Mitigation Mechanisms

1. **Volume-Weighted Standard Deviation**: Replace simple price variance with volume-weighted variance. A $100 wash trade contributes `($100 / $1M)² = 10⁻⁸` to the variance, rendering it invisible.

2. **Median Price + MAD**: Use the median of trade prices over the window and the Median Absolute Deviation as the volatility measure. MAD is robust to up to 49% outliers.

3. **Minimum Effective Trade Size**: Only trades that move the pool price by at least `ε` (e.g., 0.01%) contribute to volatility. This filters out all micro-wash trades.

4. **Sybil-Resistant Identity via Fee Weighting**: Weight each trade's contribution to σ by the total fees paid. A wash trader paying 5 bps on $1K contributes `0.05` units; a legitimate $100K trade contributes `50` units. The legitimate signal drowns out the noise.

5. **External Oracle Augmentation**: Combine on-chain trade history with an external volatility oracle (e.g., Deribit implied vol, or a Uniswap v3 TWAP from a deep pool). The protocol uses the higher of the two values. This sets a floor that cannot be suppressed and makes inflation attacks redundant (the external oracle doesn't respond to wash trades).

6. **Manipulation-Proof TWAP**: Use a geometric TWAP (`Π(P_i)^(1/N)`) rather than arithmetic. Geometric TWAPs are more resistant to single-block manipulation because outliers are dampened by the multiplicative nature. Alternatively, use the Liquidity-Weighted Average Price (LWAP) from Uniswap v3, which weights by liquidity depth.

---

## Cross-Cutting Mitigation Architecture

### Layer 1: Oracle Hardening
- Use volume-weighted or liquidity-weighted volatility measures.
- Augment endogenous signals with exogenous oracles (CEX implied vol, deep Uniswap v3 TWAP).
- Apply robust statistics (MAD, trimmed mean) instead of standard variance.

### Layer 2: Curve Transition Safety
- Gradual `A` transitions over multiple blocks.
- Virtual reserve adjustments at transition boundaries to eliminate mechanical arbitrage.
- LP withdrawal locks around transition events.

### Layer 3: Fee Anti-Griefing
- Fee accrual lags (trade pays fee based on pre-trade state).
- Griefing surcharges on addresses with anomalous trade patterns.
- Dual-track fee calculation using MAX(endogenous, exogenous) volatility.

### Layer 4: Emergency Circuit Breakers
- Instant steepening if single-trade price impact exceeds threshold.
- Transition-based rebalancing fees to compensate LPs for arbitrage gaps.
- Pro-rata LP protection during black-swan events.

### Layer 5: Economic Design
- Insurance fund funded by a portion of all trading fees.
- Dynamic coverage: if the pool suffers toxic flow, fees auto-increase and a fraction is directed to affected LPs.
- Co-payment: LPs bear first `X%` of transition-induced IL to discourage passive free-riding.

---

## Conclusion

The Volatility-Adaptive AMM introduces a powerful mechanism for liquidity optimization, but it also creates **new attack surfaces that do not exist in static-curve AMMs**. The core vulnerability is **reflexivity**: the AMM's internal state (curve, fees) is parameterized by its own history, which adversaries can write.

**Key Findings:**

1. **Wash trading to manipulate volatility is extremely cheap** in flat-curve mode and highly profitable if the attacker holds LP shares. Volume-weighted statistics are essential.

2. **Sandwich attacks are amplified by flat curves** because they allow larger victim trades and cheaper frontruns. The V-AMM may become a preferred target for MEV searchers.

3. **Curve transitions create mechanical arbitrage gaps** that can be front-run for 5-20% of TVL. Gradual transitions and virtual reserve adjustments are mandatory.

4. **Fee griefing is low-cost and high-impact** for protocol competitiveness. External oracle floors prevent trivial manipulation.

5. **Flat-curve + volatile market = toxic flow amplification**. The stable-swap curve is dangerous during volatility spikes because it offers insufficient price protection. Emergency steepening is critical.

6. **On-chain volatility oracles are trivially manipulable** at low cost unless protected by volume-weighting, size thresholds, and external cross-checks.

**The V-AMM is not merely a modified AMM; it is a control system with feedback loops.** Without robust oracle design, transition safety, and anti-griefing economics, the adaptive mechanism becomes an adaptive vulnerability.

---

*Report generated for adversarial design review. All models are stylized approximations; production implementations require formal verification and quantitative stress testing.*
