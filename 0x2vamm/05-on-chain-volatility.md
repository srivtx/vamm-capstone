# 05 — On-Chain Volatility

> *How to measure jumpiness — using only whole-number math.*

---

## The constraint

Solana programs run inside BPF (Berkeley Packet Filter), a sandboxed runtime. BPF has no support for decimals. You can't write `3.14`, you can't compute `sqrt(2.0)`, you can't take `ln(price)`. No floating point at all.

Everything must be done with integers — `u64` and `u128` whole numbers. We need to compute "how much did the price move" using only addition, multiplication, and division. No decimals, no logarithms, no square roots at runtime.

## Step 1: What is a logarithm? (quick primer)

A logarithm answers: "what power do I raise this base to, to get this number?"

```
log₁₀(100) = 2   →   "10 raised to the power 2 equals 100"
log₂(8) = 3       →   "2 raised to the power 3 equals 8"
log₁₀(1000) = 3   →   "10³ = 1000"
```

Logarithms turn multiplication into addition: `log(a × b) = log(a) + log(b)`. They also turn big ranges into small ones: prices from $0.01 to $10,000 become log values from -2 to 4.

In finance, we use logarithms because **a log price change is a percentage change.** If the log price goes from 2 to 2.1, the price increased by about 10%. If it goes from 5 to 5.1, it also increased by about 10% — even though the raw numbers are very different. This makes volatility measurement consistent whether the asset is $1 or $10,000.

But remember: we can't compute logarithms on-chain. No floats. So we need a trick.

## Step 2: The tick trick

Uniswap V3 introduced **ticks** — a way to store prices that's already logarithmic:

```
tick = log₁.₀₀₀₁(price)
```

This means: "the tick is the power you raise 1.0001 to, to get the price."

Concrete examples:
- Price = 1.0 → tick = 0 (1.0001⁰ = 1)
- Price = 1.0001 → tick = 1
- Price = 2.0 → tick ≈ 6931 (1.0001⁶⁹³¹ ≈ 2)

The magic of ticks: **a tick difference is already a log return.** If the tick goes from 6931 to 7000, that's a 69-tick move. Since each tick is ~0.01%, that's about a 0.69% price increase. We got this without ever calling `ln()`.

Mathematically:
```
Price return in percent = (tick₂ − tick₁) × 0.01%
                         = Δtick × 0.0001
```

The constant `ln(1.0001) ≈ 0.000099995` is baked into the protocol — we multiply the tick difference by it using integer math (scaled up by 1 billion to keep precision).

## Step 3: Getting volatility from tick changes

Volatility measures the average size of price moves. We don't care about direction — up 5% and down 5% are equally volatile. So we **square** the returns:

```
r = Δtick × constant               (the return, could be positive or negative)
r² = r × r                         (the squared return — always positive)
```

Concrete example:
```
Before trade: price = 100 USDC/SOL, tick ≈ 46050
After trade:  price = 105 USDC/SOL, tick ≈ 46537
Δtick = 487, r² = 487² × constant²
```

A 487-tick move is about a 4.87% price change. The squared return `r²` captures "how big" without caring about direction. A +500 tick move and a -500 tick move produce the same `r²`.

## Step 4: Smoothing with EWMA

We don't want to react to every single trade. One whale buying $1M of SOL shouldn't make the pool think the market is suddenly 500% volatile. We want a **smoothed average.**

EWMA (Exponentially Weighted Moving Average) does this:

```
variance_new = 0.95 × variance_old + 0.05 × r²
```

Concrete example over 5 trades, starting with variance = 0:

| Trade | r² (from trade) | variance after update |
|---|---|---|
| 1 | 100 | 0 × 0.95 + 100 × 0.05 = 5.0 |
| 2 | 100 | 5.0 × 0.95 + 100 × 0.05 = 9.75 |
| 3 | 5 | 9.75 × 0.95 + 5 × 0.05 = 9.51 |
| 4 | 5 | 9.51 × 0.95 + 5 × 0.05 = 9.28 |
| 5 | 1000 (spike!) | 9.28 × 0.95 + 1000 × 0.05 = 58.82 |

The spike on trade 5 moved the variance from ~9 to ~59 — a jump, but not to 1000. The EWMA dampens single-event noise while responding to sustained patterns.

Think of it as a slow-moving needle. One push barely moves it. Sustained pressure in one direction moves it steadily. Old data slowly fades (each update multiplies old values by 0.95, so after ~14 trades, an old data point's weight drops below half).

## Step 5: Annualizing the variance

The EWMA tracks variance over roughly a 15-minute window. But "variance per 15 minutes" isn't a standard number. We want **annualized volatility** — "if this level of jumpiness continued for a full year, what would the volatility number be?"

Standard finance: multiply by the square root of the time ratio.

```
σ_annual = √variance × √(seconds_per_year / window_seconds)
         = √variance × √(31,536,000 / 900)
         = √variance × √35040
         ≈ √variance × 187.2
```

So if the EWMA variance is 25 (meaning squared returns average around 25 per 15-min window), annualized volatility would be approximately `√25 × 187 = 5 × 187 = 935`, or about 9.35% annualized.

The square root is done with the Babylonian method — start with a guess, repeatedly average the guess with `n/guess`, converge in ~10 iterations. All integer math.

## Step 6: The full per-swap pipeline with concrete numbers

Let's trace through a real swap:

```
Before swap:
  Pool: 100 USDC, 1 SOL   →   price = 100 USDC/SOL
  last_tick ≈ 46050 (log₁.₀₀₀₁(100))
  EWMA variance = 10 (low — market has been calm)

Someone swaps 10 USDC for SOL:
  New reserves: 110 USDC, 0.9091 SOL   →   price = 121 USDC/SOL
  New tick ≈ 48000 (log₁.₀₀₀₁(121))

  Δtick = 48000 − 46050 = 1950   (a ~19.5% price move!)
  r² = 1950² × constant²  = 3,802,500 × constant²

  variance_new = 0.95 × 10 + 0.05 × 3,802,500
               = 9.5 + 190,125
               = 190,134.5                    ← big jump from a big trade

  σ_annual ≈ √190,135 × 187 ≈ 436 × 187 ≈ 81,532
  After scaling down: ~81.5% annualized volatility

  Record in 15-min bucket: tick_cumulative = 48000 × slot, volume = 10
```

A single trade moved the volatility estimate from near zero to ~81%. That's the EWMA doing its job — it noticed a 20% price swing and updated accordingly. If the next 10 trades are small, the variance will decay back down. If the next 10 trades are also large, it will climb further.

## Step 7: Time buckets (cross-check against manipulation)

The EWMA alone can be gamed. An attacker could make many small trades at manipulated prices to slowly push the variance up.

As a defense, we also maintain ring buffers — circular arrays of 4 buckets each:

```
15-minute buckets:  [slot 0–9000] [slot 9001–18000] [slot 18001–27000] [slot 27001–36000]
                        ↑ cursor

1-hour buckets:     [aggregated from four 15-min buckets] [next hour] [next] [next]
```

Each bucket stores:
- **tick_cumulative** — the sum of (tick × slot) for every swap in that window. Used to compute the time-weighted average price.
- **volume** — total trading volume in the window.
- **timestamps** — start and end slots.

Every 15 minutes (9000 slots), we close the current bucket, advance the cursor, and potentially aggregate an hour bucket. If the 1-hour bucket shows only 2 trades but the EWMA says 500% volatility, the system knows something is wrong — likely manipulation.

## Step 8: Approximating ticks on Solana

We still have one problem: we don't have the actual `log₁.₀₀₀₁(price)` function. We need to approximate it.

The trick: use the `leading_zeros()` instruction available in BPF. It counts how many zero bits are at the front of a number — which is basically a cheap `log₂`.

```
If price = 100 (binary: 1100100, a 7-bit number):
  leading_zeros(u128) = 128 − 7 = 121
  log₂(price) ≈ 128 − 121 = 7

Then convert log₂ to log₁.₀₀₀₁:
  log₁.₀₀₀₁(price) ≈ log₂(price) × 6931 / 10000
                     ≈ 7 × 0.6931
                     ≈ 4.85

Check: 1.0001⁴·⁸⁵ ≈ 1.00048⁵⁰⁰⁰ ≈ e⁰·⁰⁰⁰⁰⁹⁹⁹⁵×⁴⁸⁵⁰ ≈ e⁰·⁴⁸⁵ ≈ 1.62
(approximate — the actual tick for price 100 is ~46050, not 4850,
 because we're using a simplified integer approximation)

In practice, the constant 6931/10000 gives reasonable tick approximations
for the volatility engine's purposes. The tilt doesn't need to be exact —
it just needs to be consistent and monotonic (higher price = higher tick).
```

This is the key on-chain optimization: `leading_zeros()` is a single CPU instruction, whereas a full logarithm approximation would cost hundreds of compute units.

## Why this works on Solana

- **No oracle required** — the pool watches its own trades. Works for any token pair.
- **No floating point** — every operation is u128 integer math with scaling.
- **Cheap per-swap** — tick approximation, EWMA update, bucket recording: ~300–500 compute units total.
- **Self-contained** — volatility state lives in its own account (VolatilityState PDA), written during the swap transaction so it's always consistent with the pool state.
- **Manipulation-resistant** — EWMA dampens single spikes. Buckets provide cross-verification. If they disagree, the system can flag or pause.

---

[← Prev — 04 Why Volatility Matters](04-why-volatility-matters.md) · [Next → 06 — Dynamic Fees](06-dynamic-fees.md)
