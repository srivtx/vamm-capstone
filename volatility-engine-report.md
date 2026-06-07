# On-Chain Volatility Detection Engine for Solana AMMs
## Technical Design & Research Report

**Date:** 2026-05-21  
**Target Platform:** Solana (BPF / SVM)  
**Context:** Constant-function or concentrated-liquidity AMMs needing manipulation-resistant realized volatility (RV) for dynamic fees, position sizing, or liquidation triggers.

---

## 1. Realized Volatility Calculation

### 1.1 Definition in AMM Context
**Realized Volatility (RV)** measures the magnitude of price movements actually observed in trade data over a fixed time window. Unlike *implied volatility* (derived from options prices), RV is backward-looking and non-subjective, making it ideal for on-chain risk engines.

In an AMM we do not have continuous OHLC (Open-High-Low-Close) candles; we observe a stream of discrete swap events:

```
… (t_i, P_i, V_i) …
```

where `t_i` is the timestamp (or slot), `P_i` is the effective average execution price of the swap, and `V_i` is the volume. We must sample or bucket these events into a regular time grid to compute returns.

### 1.2 Core Formulas

**Log Return**

Given two consecutive sampled prices `P_t` and `P_{t-Δt}`:

```
r_t = ln(P_t / P_{t-Δt})
```

**Realized Variance & Volatility**

Over a window of `N` returns:

```
RV² = Σ_{i=1}^{N} r_i²
RV  = sqrt(RV²)
```

**Annualized Volatility**

To compare across windows:

```
σ_annual = RV * sqrt( seconds_per_year / window_seconds )
        = RV * sqrt( 31,536,000 / window_seconds )
```

### 1.3 The Tick Trick (On-Chain Log Returns without `ln`)

Native floating-point (`ln`, `exp`, `sqrt` on `f64`) is unavailable in Solana BPF. Computing a logarithm via polynomial approximation is expensive (~500–1,000 CUs).

**Key Insight:** Uniswap-style *ticks* are already logarithmic.

```
tick = log_{1.0001}(price)
```

Therefore:

```
ln(P_t / P_{t-1}) = (tick_t - tick_{t-1}) * ln(1.0001)
                  ≈ Δtick * 0.00009999500033…
```

For variance we only need `r²`:

```
r² = (Δtick)² * c²          where c = ln(1.0001) ≈ 1e-4
```

We can absorb the constant `c²` into the final scaling factor and simply accumulate **squared tick differences** on-chain. This reduces the per-return cost from a `ln` approximation to a single integer subtraction and multiplication.

### 1.4 Optimal Time Window

| Window | Characteristics | Recommended Use |
|---|---|---|
| **1 hour** | Very noisy; microstructure noise dominates; easy to spike | High-frequency EWMA for dynamic swap fees only |
| **4 hours** | Responsive but smoothed; good balance | Primary on-chain RV for position sizing / margin |
| **6 hours** | Lower noise, slight lag | Liquidation thresholds, funding-rate calculations |
| **24 hours** | Very smooth, very lagged | Long-term protocol risk parameters |

**Recommendation:** Maintain an **EWMA** with a half-life of ~1 hour for reactive fee adjustment, and a **4-hour rolling window** for liquidation and collateral risk.

---

## 2. On-Chain Implementation Challenges

### 2.1 Timestamping Trades

Solana does not expose a monotonic nanosecond clock inside a transaction. Two sources exist:

| Source | Granularity | Best For |
|---|---|---|
| `Clock::get()?.unix_timestamp` | ~1 second (POSIX time) | Time-window boundaries, human-readable intervals |
| `Clock::get()?.slot` | ~400 ms (leader schedule) | Ordering, anti-replay, sub-second granularity |

**Problem:** All transactions inside the same block (or near the same leader slot) can share the same `unix_timestamp`.

**Solutions:**
1. **Bucket Aggregation:** If multiple trades share a timestamp, aggregate them into a single bucket price (e.g., volume-weighted average tick, `tick_vwap`) before feeding the volatility engine. This prevents division-by-zero when computing returns and dampens same-block wash trading.
2. **Dual Key:** Store `(slot, timestamp)` and use `slot` for ordering, `timestamp` for window expiry.

### 2.2 PDA Storage Constraints

Solana account limits (Agave runtime):

| Limit | Value |
|---|---|
| Max account data | 10 MiB |
| Max data growth per instruction | 10 KiB |
| Rent-exempt minimum | `(size + 128) * 3,480 * 2` lamports |

**Observation Struct Design**

```rust
#[repr(C)]
pub struct Observation {
    pub timestamp: u32,   // POSIX time, overflows in 2106 (acceptable)
    pub tick:      i32,   // Current pool tick (log price)
    pub volume:    u64,   // Swap volume in token0 or token1 lamports
}
// Total: 16 bytes per observation
```

**Capacity Examples**

| Granularity | 4-Hour Window Size | Storage | Rent-Exempt SOL |
|---|---|---|---|
| 1 bucket / slot (~400ms) | 36,000 obs | 576 KB | ~4.0 SOL |
| 1 bucket / second | 14,400 obs | 230 KB | ~1.6 SOL |
| 1 bucket / minute | 240 obs | 3.8 KB | ~0.03 SOL |

A ring buffer of 65,535 observations (like Uniswap V3) fits in ~1 MiB and covers ~18 hours at 1-second granularity. This is trivial relative to the 10 MiB limit.

### 2.3 Rolling Window vs. Exponentially Weighted Moving Average (EWMA)

| Method | Storage | Per-Update Compute | Manipulation Resistance | Drift |
|---|---|---|---|---|
| **Rolling Window** | O(N) ring buffer | O(1) with Welford + removal | High (harder to skew old buckets) | None |
| **EWMA** | O(1) (variance + last price) | O(1), extremely cheap | Medium (infinite memory, old events decay slowly) | Minimal over short horizons |

**Recommendation for Solana:**

Use **EWMA as the primary hot path** (updated every swap or every slot via crank). Use a **small rolling buffer** (e.g., 60 minutes of 1-minute buckets) as a fallback / sanity-check source for TWAP and outlier rejection.

---

## 3. Manipulation Resistance

### 3.1 Attack Vectors

| Attack | Mechanism | Cost to Attacker |
|---|---|---|
| **Wash Trading** | Trader buys and sells back and forth in rapid succession | Primarily swap fees + slippage + JITM sandwich risk |
| **Flash Loan / JIT Manipulation** | Borrow large capital, push price in one direction, hope oracle records it, reverse trade | Must sustain distortion for the *entire observation window*; loses fees + slippage on full size |
| **Oracle Delay Gaming** | Force timestamp collisions or empty slots to create stale price buckets | Requires validator-level coordination; mitigated by slot-based ordering |

### 3.2 Defensive Layers

| Defense | How It Works | Effectiveness |
|---|---|---|
| **TWAP-based Variance** | Compute returns using time-weighted average tick per bucket instead of last-trade tick | **High.** Attacker must hold distorted price for the entire bucket duration. |
| **Median-of-Buckets** | Within each bucket, take the median tick of all trades before emitting the bucket price | **High.** Immune to a single outlier trade inside a bucket. |
| **Outlier Rejection (Winsorization)** | Cap any individual bucket return at `±k%` (e.g., ±5%). Clamped values are fed into the variance engine. | **Medium-High.** Prevents flash-crash/spike from dominating variance. |
| **Minimum Volume / Trade Size** | Ignore buckets with total volume below a threshold (e.g., $100 equivalent). | **Medium.** Raises cost of spamming zero-value wash trades. |
| **Observation Cardinality Incentives** | Allow anyone to pay rent to grow the observation ring buffer (Uniswap V3 pattern). Longer history = longer TWAP = more expensive manipulation. | **High.** Democratizes manipulation resistance. |

### 3.3 Existing Deployed Research

- **Uniswap V3 Oracle** (Ethereum): The canonical on-chain manipulation-resistant price history. Uses cumulative `tick * time` and `secondsPerLiquidity`. It does **not** compute variance natively, but its observation structure is the blueprint for any on-chain RV engine.
- **Euler Finance** (pre-v2 hack): Used Uniswap V3 TWAP with configurable windows for collateral pricing. Demonstrated that TWAP resistance scales with window length.
- **Deri Protocol / Lyra / Primitive**: These DeFi options protocols require volatility. They predominantly rely on **off-chain implied volatility** or **off-chain computed RV** pushed on-chain via custom oracle networks. A fully autonomous *on-chain* RV oracle remains largely uncharted territory, especially on Solana.

---

## 4. Compute Efficiency

### 4.1 Solana Compute Budget Context

| Parameter | Value |
|---|---|
| Max CU per transaction | 1,400,000 |
| Default CU per instruction | 200,000 |
| CU cost of a `u64` add/mul | ~1–2 |
| CU cost of a `u128` mul | ~5–10 |
| CU cost of a `u128` div | ~50–100 |
| CU cost of one `sqrt` iteration (u128 Babylonian) | ~20–30 |
| CU cost of reading `Clock` sysvar | ~100 |
| CU cost of a PDA account read/write | ~500–1,000 |

### 4.2 EWMA Update Pseudocode (O(1))

```rust
// SCALE = 1_000_000_000_000 (1e12) for Q64.64-ish fixed point
const LAMBDA_Q64: u128 =  999_000_000_000_000; // ≈ 0.999, decay factor
const ONE_MINUS_LAMBDA: u128 = SCALE - LAMBDA_Q64;

pub struct VolatilityState {
    pub last_slot: u64,
    pub last_tick: i32,
    pub variance_q: u128,      // EWMA variance in fixed point
    pub last_price_q: u128,    // Optional: scaled absolute price
}

/// Called per swap or per crank
pub fn update_ewma(state: &mut VolatilityState, current_tick: i32, current_slot: u64) {
    let dt = (current_slot - state.last_slot) as i64;
    if dt == 0 { return; } // Same slot: defer to bucket aggregation

    // 1. Compute tick difference (proxy for log return)
    let delta_tick = (current_tick - state.last_tick) as i128;

    // 2. Squared return (absorb ln(1.0001)^2 into final scaling)
    let return_sq = (delta_tick * delta_tick) as u128; // ~1 CU

    // 3. EWMA update in fixed point
    // variance = lambda * old_variance + (1-lambda) * return_sq
    let new_var = (
        LAMBDA_Q64 * state.variance_q +
        ONE_MINUS_LAMBDA * return_sq
    ) / SCALE;

    state.variance_q = new_var;
    state.last_tick = current_tick;
    state.last_slot = current_slot;
}

pub fn annualized_volatility(state: &VolatilityState, seconds_per_bucket: u64) -> u128 {
    // RV = sqrt(variance)
    // Annualize: RV * sqrt(seconds_per_year / bucket_seconds)
    // Uses integer square root (Babylonian method, ~10 iterations)
    let rv = integer_sqrt(state.variance_q);
    let annualization_factor = sqrt(31_536_000 / seconds_per_bucket) * SCALE;
    (rv * annualization_factor) / SCALE
}
```

**Estimated CU Cost per Update:**
- Subtractions / multiplications: ~20 CU
- One `u128` division: ~80 CU
- `integer_sqrt` (u128, 10 iterations): ~250 CU
- Sysvar read + account write: ~1,500 CU
- **Total: ~1,800–2,500 CU** (negligible against 1.4M budget).

### 4.3 Welford’s Online Algorithm (Rolling Window)

Useful if you need an exact, unweighted rolling variance and store a ring buffer.

```rust
pub struct RollingVariance {
    pub n: u64,
    pub mean: i128,   // mean of tick changes
    pub m2: u128,     // sum of squares of differences from mean
}

impl RollingVariance {
    pub fn add(&mut self, x: i128) {
        self.n += 1;
        let old_mean = self.mean;
        self.mean += (x - old_mean) / self.n as i128;
        self.m2 += ((x - old_mean) * (x - self.mean)) as u128;
    }

    pub fn remove(&mut self, x: i128) {
        // Reverse Welford for sliding window
        let old_n = self.n;
        self.n -= 1;
        let delta = x - self.mean;
        let old_mean = self.mean - delta / old_n as i128;
        self.mean = old_mean;
        self.m2 -= ((x - old_mean) * (x - self.mean)) as u128;
    }

    pub fn variance(&self) -> u128 {
        if self.n < 2 { return 0; }
        self.m2 / self.n as u128
    }
}
```

**Estimated CU Cost:** ~400–700 CU for `add`, similar for `remove`.

### 4.4 Full Recalculation (Do Not Use On-Chain)

Iterating over `N` observations to recompute variance costs **O(N)**. For `N = 14,400` (4 hours at 1s), expect **~500,000–800,000 CU**—doable within one transaction but wasteful and jitter-prone. Always prefer incremental methods.

---

## 5. Volatility Oracle Alternatives

### 5.1 Pyth Network

- **Solana Availability:** Native. Pyth price feeds are pushed on-chain via the Pyth program.
- **Volatility Data:** Pyth Core primarily publishes **price, confidence, and status**. Confidence is a measure of dispersion among publishers, *not* realized volatility of the underlying market. As of 2026, Pyth does **not** publish a canonical RV feed for every asset.
- **Path Forward:** You can subscribe to a **custom Pyth Pro** channel that aggregates off-chain RV and posts it via the Pyth pull model. This shifts trust to the Pyth publisher set.

### 5.2 Switchboard

- **Solana Availability:** Native.
- **Volatility Data:** Switchboard allows **custom oracle jobs**. You can define a job that pulls 1-minute candles from Binance/OKX, computes RV, and pushes the result on-chain via an aggregator.
- **Trade-off:** Highly flexible, but introduces trust in the Switchboard validator network and the job definition. Best when the computation is too heavy for on-chain (e.g., multi-exchange aggregated RV).

### 5.3 Chainlink

- **Solana Availability:** Chainlink OCR runs natively on Solana for **price feeds**.
- **Volatility Data:** Chainlink offers "Rate and Volatility Feeds" on EVM chains. On Solana, these are **not widely deployed** as of current documentation. Check the [Chainlink Solana feed registry](https://docs.chain.link/data-feeds/price-feeds/addresses?network=solana) for availability.

### 5.4 Trade-Off Summary

| Approach | Freshness | Manipulation Resistance | Trust Assumption | On-Chain Compute | Best For |
|---|---|---|---|---|---|
| **On-chain EWMA** | High (per swap) | Medium (fee burn, TWAP-ish) | None | Very Low (~2k CU) | Dynamic fees, reactive risk |
| **On-chain Rolling Window** | Medium (per bucket) | High (long TWAP, median) | None | Medium (~5k CU + storage) | Liquidations, collateral ratios |
| **Pyth (custom)** | Very High | High (publisher stake) | Pyth data providers | Low | Protocols already using Pyth |
| **Switchboard (custom)** | High | Medium (consensus) | Switchboard oracle network | Low | Complex multi-source RV |
| **Chainlink (if available)** | High | High | Chainlink node operators | Low | Institutional-grade compliance |

---

## 6. Recommended Hybrid Architecture

For a production Solana AMM, we propose a **three-tier** design:

```
┌──────────────────────────────────────────────────────┐
│  TIER 1: HOT PATH (On-Chain, per Swap or Crank)     │
│  • EWMA Variance (O(1) update)                       │
│  • 1-minute bucket ring buffer (60 obs, ~1 KB)       │
│  • TWAP tick per bucket, outlier clamping at ±5%     │
│  • Stored in the AMM pool PDA                        │
├──────────────────────────────────────────────────────┤
│  TIER 2: WARM PATH (On-Chain, Permissionless Crank) │
│  • 4-hour rolling window RV using Welford + buffer   │
│  • Updated every N slots by a keeper incentive       │
│  • Used for position health / liquidation checks     │
├──────────────────────────────────────────────────────┤
│  TIER 3: COLD PATH (Off-Chain → On-Chain Oracle)    │
│  • Optional Switchboard/Pyth job for multi-CEX RV  │
│  • Acts as circuit breaker / sanity bound            │
│  • If on-chain EWMA deviates >20% from oracle, pause │
└──────────────────────────────────────────────────────┘
```

### 6.1 Storage Layout (Pool PDA)

```rust
#[account]
pub struct PoolState {
    // ... existing pool fields ...

    // Tier 1: EWMA
    pub ewma_variance_q: u128,      // Q64.64 scaled variance
    pub ewma_last_tick: i32,
    pub ewma_last_slot: u64,
    pub ewma_lambda_q: u64,         // e.g., 0.999 * 1e12

    // Tier 1: 1-minute bucket ring buffer
    pub bucket_cursor: u16,
    pub buckets: [Bucket; 60],      // 60 minutes

    // Tier 2: 4-hour rolling window metadata
    pub rolling_window_obs: [Observation; 240], // 4h @ 1min
    pub rolling_cursor: u16,
    pub rolling_m2: u128,
    pub rolling_mean: i128,
}

#[repr(C)]
pub struct Bucket {
    pub timestamp: u32,
    pub tick_cumulative: i64,     // tick * seconds inside bucket
    pub volume: u64,
}
```

### 6.2 Gas & Rent Economics

| Component | Storage | Rent (SOL) | CU per Update |
|---|---|---|---|
| EWMA state | 48 bytes | ~0.0003 | ~2,000 |
| 60-min ring buffer | 60 × 16 = 960 B | ~0.007 | ~3,000 (add + TWAP close) |
| 4-hour rolling buffer | 240 × 16 = 3.8 KB | ~0.03 | ~5,000 (Welford add+remove) |
| **Total** | **~5 KB** | **~0.04 SOL** | **< 10,000 CU** |

These costs are negligible compared to typical AMM swap instruction budgets.

---

## 7. Manipulation Scenario Analysis

### Scenario A: 1-Minute Flash Spike

- **Attacker:** Swaps $5M to move the pool tick +10% in one transaction.
- **Impact on EWMA:** One bucket return = +10%. If EWMA half-life is 1 minute, this spikes the variance significantly.
- **Defense:**
  1. Outlier cap clamps the bucket return to +5%. Effective injected variance is slashed.
  2. TWAP for the bucket: if the attacker cannot sustain the price for the full 60 seconds, the bucket TWAP reverts toward true price.
  3. Attacker pays 0.3%–1% swap fees on $5M = $15k–$50k for a temporary noise signal that is largely ignored.

### Scenario B: Sustained 1-Hour Wash-Trading

- **Attacker:** Wants to artificially *depress* reported volatility (to trick options sellers) or *inflate* it (to trigger liquidations).
- **Cost:** Must trade back and forth continuously for the full observation window, paying fees both ways.
- **Defense:**
  1. 4-hour rolling window means the attacker must sustain the manipulation for 4 hours.
  2. TWAP and median make single-direction spikes ineffective; the attacker must literally move the true market clearing price, which arbitrageurs will oppose.
  3. Minimum volume filters ignore dust trades.

### Scenario C: Empty Block / Timestamp Collision

- **Attacker:** Spams transactions to fill blocks and prevent legitimate trades from being recorded, creating stale price buckets.
- **Defense:** Solana’s leader rotation and high throughput make sustained block-filling expensive. The AMM can allow a **permissionless crank** to close buckets: if no swap occurs for 60 seconds, anyone can call `close_bucket()` and push the TWAP forward, earning a micro-reward.

---

## 8. Conclusion

Building an on-chain volatility engine on Solana is **computationally feasible** and **storage-cheap**, but requires careful fixed-point design and anti-manipulation layering.

1. **Use EWMA as the default engine** (O(1), <2,500 CU) for anything updated every swap.
2. **Use ticks, not raw prices**, to avoid expensive `ln` approximations.
3. **Bucket trades into 1-minute TWAP + median buckets** before feeding the variance engine.
4. **Clamp returns** (e.g., ±5%) to neutralize flash spikes.
5. **Maintain a small on-chain history** (4-hour ring buffer) for rolling window liquidation risk.
6. **Consider a hybrid oracle** (Switchboard / custom Pyth) as a circuit breaker for mission-critical applications.

This design yields a manipulation-resistant, compute-efficient, and fully transparent realized volatility oracle native to the Solana runtime.
