# On-Chain Realized Volatility on Solana

## Why This Is Hard (and Why It Matters)

Measuring how volatile a token is — right now, on-chain — sounds simple: just compute the standard deviation of recent price changes. On Solana, several things make this uniquely difficult:

- **No floating-point math.** The BPF runtime lacks `f64` operations. No `ln`, no `exp`, no `sqrt` on floats. Everything must use integers and fixed-point arithmetic.
- **Discrete, irregular trades.** AMMs don't produce clean candles. Price observations arrive at unpredictable times and must be bucketed into a regular grid.
- **Attackers want to game you.** If your protocol uses volatility for liquidations or dynamic fees, someone will try to manipulate it. A single large swap can temporarily spike reported volatility.

Despite these challenges, on-chain volatility is a critical primitive. Dynamic swap fees adapt to market conditions. Lending protocols need it for position sizing and liquidation thresholds. Options protocols require it as a pricing input.

## 1. Realized Volatility Defined

Realized volatility (RV) measures how much an asset's price actually moved over a fixed time window. It's backward-looking and non-subjective — unlike implied volatility, which depends on options pricing models.

Given two consecutive prices `P_t` and `P_{t-1}`, the log return is:

```
r_t = ln(P_t / P_{t-1})
```

Over a window of N returns:

```
RV² = Σ r_i²        (sum of squared returns)
RV  = √(RV²)
```

Annualized for comparison across windows:

```
σ_annual = RV × √(31,536,000 / window_seconds)
```

## 2. The Tick Trick — Log Returns Without `ln`

Solana BPF has no `f64` log function. Computing `ln` via polynomial approximation costs ~500–1,000 CU — prohibitive per swap.

Uniswap V3 introduced ticks as a compressed price representation:

```
tick = log₁.₀₀₀₁(price)
```

This is already logarithmic. The log return between two observations is simply:

```
ln(P_t / P_{t-1}) = (tick_t - tick_{t-1}) × ln(1.0001)
                  ≈ Δtick × 0.000099995
```

Since we only need the squared return for variance:

```
r² = (Δtick)² × c²      where c = ln(1.0001) ≈ 10⁻⁴
```

We absorb the constant `c²` into the final scaling factor. On-chain, we accumulate nothing but **squared tick differences** — a single integer subtraction and multiplication per update.

## 3. EWMA — Exponentially Weighted Moving Average

A full rolling window (storing N observations, removing old ones) uses O(N) storage. An **EWMA** uses O(1) storage and O(1) compute — ideal for the hot path.

The EWMA variance update given a new squared return `r²` and a decay factor `λ`:

```
variance_new = λ × variance_old + (1-λ) × r²
```

Choosing `λ`:

- **`λ ≈ 0.999`** (half-life ~1 hour) — responsive, good for dynamic swap fees
- **`λ ≈ 0.9999`** (half-life ~10 hours) — smooth, good for liquidation risk metrics

All arithmetic runs in Q64.64 fixed point (multiply values by a scale factor like 10¹², store in u128).

To retrieve current volatility:

```
RV = √(variance)                               (integer sqrt, Babylonian)
σ_annual = RV × √(31,536,000 / bucket_seconds) (annualize)
```

**Cost per update:** ~2,000 CU — about 0.15% of the 1.4M CU transaction budget.

## 4. Time Bucketing with Ring Buffers

Trades arrive at irregular intervals. Multiple trades can land in the same Solana slot (~400ms). Feeding raw per-trade returns into the variance engine amplifies noise and allows same-slot wash trading.

**Solution: bucketing.** Group trades into fixed time windows and emit one aggregate observation per bucket.

### 15-Minute Ring Buffer (Short-Range)

- 15 buckets of 1-minute data → responds quickly to regime changes
- Compute the **time-weighted average tick (TWAP)** over the bucket
- Optional: take the **median tick** within the bucket to reject single-outlier trades
- Feed per-bucket tick changes into the EWMA

### 1-Hour Ring Buffer (Long-Range)

- 60 buckets of 1-minute data → smooths out microstructure noise
- Used for liquidation risk, collateral ratios, and funding rate calculations
- A separate EWMA with slower decay can also serve this role

**Handling empty buckets:** If no trades occur in a bucket, carry forward the previous bucket's TWAP tick. This prevents zero-return gaps from artificially smoothing the volatility signal.

### Observation Struct (16 bytes)

```
{ timestamp: u32, tick: i32, volume: u64 }
```

A full volatility engine fits in under 5 KB — about 0.04 SOL in rent.

## 5. Annualization

Raw RV is window-dependent. A 1-hour RV looks smaller than a 24-hour RV simply because there's been less time for price to move. Annualization normalizes this:

```
σ_annual = RV × √(T_year / T_window)
```

Where `T_year = 31,536,000` seconds. The square root is computed via an integer Babylonian method (~10 iterations, ~250 CU). The result is dimensionless — 0.80 means 80% annualized volatility.

## 6. Manipulation Resistance

### Attack Vectors and Defenses

**Flash Spike.** Attacker executes one large swap, pushing the pool tick +10%, hoping the volatility engine records it before the price reverts.

| Defense | How It Works |
|---|---|
| **Outlier clamping** | Cap any single bucket return at ±5%. Clamped value enters EWMA. |
| **TWAP per bucket** | Bucket emits time-weighted average tick, not last-trade tick. A 2-second spike in a 60-second bucket gets diluted by 30×. |
| **Cost friction** | Attacker pays 0.3–1% swap fees + slippage for a signal that barely registers. |

**Sustained Wash Trading.** Attacker trades back and forth continuously to inflate or depress reported volatility.

| Defense | How It Works |
|---|---|
| **Minimum volume filter** | Ignore buckets with total volume below a threshold (e.g., $100). |
| **Longer windows** | A 1-hour ring buffer means manipulation must be sustained. Arbitrageurs oppose persistent distortion. |
| **EWMA decay** | Each wash trade pair (buy + sell) nets to near-zero tick movement if completed within the same bucket. |

**Slot / Timestamp Gaming.** Attacker spams transactions to fill blocks, preventing legitimate trades and creating stale buckets.

| Defense | How It Works |
|---|---|
| **Permissionless crank** | Anyone can call `close_bucket()` if no swap has occurred for 60 seconds. Earns a micro-reward; ensures buckets advance. |
| **Slot-based ordering** | Use `slot` for sequencing to prevent timestamp collisions within the same block. |

### Defense Effectiveness

| Defense | Mechanism | Effectiveness |
|---|---|---|
| TWAP per bucket | Time-weighted average, not last-trade tick | High |
| Outlier clamping ±5% | Cap per-bucket returns | High |
| Minimum volume threshold | Ignore dust buckets | Medium |
| Permissionless crank | Anyone can advance stale buckets | High |
| Bucket median filtering | Median tick within each bucket | High |

## 7. Solana-Specific Constraints

### No Floats

Every operation uses integers:
- Ticks are `i32` — already logarithmically scaled
- Variance accumulates as `u128` with a fixed-point scale (e.g., multiply by 10¹²)
- Square roots use Babylonian iteration on `u128` (~10 iterations, ~250 CU)

### Slot-Based Time

Solana's `Clock::unix_timestamp` has 1-second granularity. All transactions in the same block can share the same timestamp.

**Solution:** Use `slot` (~400ms) for ordering and deduplication. Use `unix_timestamp` only for window-boundary decisions ("is this observation older than 1 hour?"). When multiple trades land in the same slot, aggregate them into a single bucket price before feeding the volatility engine.

### Storage and Rent

| Component | Size | Approx. Rent |
|---|---|---|
| EWMA state (variance, last_tick, last_slot) | ~48 B | ~0.0003 SOL |
| 15-minute ring buffer (15 × 16 B) | 240 B | ~0.002 SOL |
| 1-hour ring buffer (60 × 16 B) | 960 B | ~0.007 SOL |
| **Total** | **~1.2 KB** | **~0.01 SOL** |

### Compute Budget

| Operation | Approx. CU |
|---|---|
| EWMA update (subtract, multiply, divide) | ~100 |
| Integer sqrt (10 Babylonian iterations) | ~250 |
| Sysvar read + PDA account write | ~1,500 |
| **Total per update** | **~2,000 CU** |

Solana's per-transaction limit is 1,400,000 CU. The volatility engine uses ~0.15% of budget.

## Key Takeaways

1. **Ticks give you log returns for free.** `Δtick × ln(1.0001)` replaces an expensive `ln` call. Just accumulate squared tick differences.

2. **EWMA is the right default engine.** O(1) storage, O(1) compute, ~2,000 CU per swap. Tune the decay factor λ for your use case — faster for fee adjustments, slower for liquidation risk.

3. **Bucket before you compute.** Group trades into 1-minute buckets with TWAP ticks and optional median filtering. Only feed bucket-level observations into the variance engine.

4. **Clamp returns at ±5%.** This single defense neutralizes flash-loan price spikes without affecting legitimate volatility measurement.

5. **Make buckets permissionless.** A crank incentive ensures buckets advance even when no organic trades occur, preventing oracle staleness.

6. **Storage and compute are negligible.** The full engine fits in ~1.2 KB (~0.01 SOL rent) and uses ~2,000 CU per update — less than 0.2% of a transaction's budget.

7. **Consider a hybrid oracle for production.** Use on-chain EWMA + ring buffers as the primary signal. Add an off-chain oracle (Switchboard/Pyth) as a circuit breaker if on-chain volatility deviates >20% from the external feed.
