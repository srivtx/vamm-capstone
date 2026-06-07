# 05 — On-Chain Volatility

> *How to measure how jumpy the price is — using only integer math.*

---

## The constraint

Solana programs run inside something called BPF (Berkeley Packet Filter). BPF has no support for floating-point numbers. You can't write `3.14` or `sqrt(2.0)` or `ln(price)`. No decimals, no logs, no exponentials.

Everything must be done with whole numbers — `u64` and `u128` integers. We need to compute "how much did the price move" using only addition, multiplication, and division.

## Step 1: What is a "tick"?

Before Uniswap V3, prices in AMMs were stored as raw numbers — "1 SOL costs 100 USDC." Uniswap V3 introduced **ticks**, which are a compressed way to store prices:

```
tick = log₁.₀₀₀₁(price)
```

This means: "the tick is the exponent you raise 1.0001 to, to get the price."

Concretely:
- A price of 1.0 has tick 0 (because 1.0001⁰ = 1)
- A price of ~1.0001 has tick 1
- A price of ~1.0002 has tick 2
- A price of 2.0 has tick ~6931 (because 1.0001⁶⁹³¹ ≈ 2)

Ticks are already logarithmic. This is the key insight: **a tick difference is already a percentage return.** If the tick moves from 6931 to 7000, the price increased by about 1% — we can compute that without ever calling `ln()`.

```
Price return = (tick₂ − tick₁) × ln(1.0001)
             ≈ Δtick × 0.000099995
```

Since `ln(1.0001)` is a known constant (~0.0001), we can just multiply the tick difference by that constant. No logarithm needed at runtime.

## Step 2: Getting volatility from tick changes

Volatility measures the "average size of price moves." We don't care about direction — up 5% and down 5% both contribute the same amount. So we square the returns:

```
r = Δtick × 0.0001      (the return)
r² = (Δtick)² × constant²  (the squared return — always positive)
```

The squared return `r²` tells us how big a price move was, regardless of direction. A 10-tick move gives r² = 100 × constant². A 2-tick move gives r² = 4 × constant². Bigger moves produce much bigger squared values.

## Step 3: Tracking the average with EWMA

We don't want to react to every single trade. One large whale swap shouldn't suddenly make the pool think the market is wild. We want a **smoothed average** that weights recent data more heavily than old data.

EWMA (Exponentially Weighted Moving Average) does exactly this:

```
variance_new = 0.95 × variance_old + 0.05 × r²
```

Every swap updates the variance. 95% of the old value is kept; 5% is replaced by the new data point. This means:
- A single spike barely moves the average
- Sustained large moves push it up over many trades
- Old data slowly decays away (each update multiplies old values by 0.95)

Think of it like a slow-moving dial. You can't jerk it with one push, but sustained pressure moves it steadily.

## Step 4: The full pipeline per swap

```
Swap happens
  │
  ├→ Extract price from reserves (price = reserve_B / reserve_A)
  │
  ├→ Approximate tick:
  │     log₂(price) ≈ 128 − price.leading_zeros()  (count leading zero bits)
  │     tick ≈ log₂ × 6931 / 10000                 (convert log₂ to log₁.₀₀₀₁)
  │
  ├→ Compute squared tick change:
  │     r² = (tick_new − tick_old)² × constant²
  │
  ├→ Update EWMA:
  │     variance = 0.95 × variance_old + 0.05 × r²
  │
  └→ Record in 15-minute bucket (for later verification)
```

## Step 5: Turning variance into annualized volatility

The EWMA tracks variance over a 15-minute window. But "15-minute volatility" isn't a standard number. We want **annualized volatility** — "if this level of jumpiness continued for a full year, what would it look like?"

```
σ_annual = √variance × √(seconds_per_year / 900)
         = √variance × √(31,536,000 / 900)
         = √variance × √35040
         ≈ √variance × 187
```

The `√` (square root) is done with integer approximation — the Babylonian method, which is just iteratively refining a guess. Works entirely with integers.

## Step 6: Sanity checks with time buckets

The EWMA alone can be tricked. An attacker could make many small trades at manipulated prices to slowly push the variance up.

To catch this, we also maintain **ring buffers** of 15-minute and 1-hour buckets:

```
15-min buffer: [bucket_0] [bucket_1] [bucket_2] [bucket_3]
                ↓
1-hour buffer:  [hour_bucket_0]  [hour_bucket_1]  [...]  [...]
```

Each bucket stores the cumulative tick × time and volume. Every 15 minutes, we close the current 15-min bucket, advance the cursor, and potentially roll up into an hour bucket.

If the EWMA says volatility is 500% but the 1-hour bucket only saw one trade, something is wrong — it's likely manipulation. The buckets act as a cross-check.

## Step 7: Clamping

Finally, we cap the volatility reading:

```
σ_final = min(σ_annual, 500%)
```

No matter what the math says, the system won't register more than 500% annualized volatility. This prevents arithmetic overflow and makes the downstream A/fee calculations safe.

## Why this works on Solana

- **No oracle required** — the pool watches its own trade history
- **No floating point** — every operation is u128 integer math
- **Manipulation-resistant** — EWMA smooths single spikes, buckets verify long-term signal
- **Cheap** — each swap adds maybe 300–500 compute units of work
- **Self-contained** — the volatility state lives in its own account, updated atomically with each swap

## What we now have

A single number: **σ**, the annualized realized volatility. Updated every swap. Ranging from 0% (dead calm) to 500% (chaos). Computed entirely on-chain with integer math.

Now: how do we turn σ into a fee?

---

[← Prev — 04 Why Volatility Matters](04-why-volatility-matters.md) · [Next → 06 — Dynamic Fees](06-dynamic-fees.md)
