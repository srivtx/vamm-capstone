# 06 — From AMM to V-AMM: Adding the Brain

A standard AMM is static. Its curve shape and fees are frozen at launch. V-AMM adds a volatility engine that watches every trade and adjusts both parameters automatically.

## What we're adding

On top of the standard AMM from part 5, V-AMM adds four things:

1. **VolatilityState** — a separate PDA that tracks price history
2. **EWMA engine** — computes realized volatility from trade data
3. **A mapping** — converts volatility into a target amplification value
4. **Fee synthesis** — converts volatility into a dynamic swap fee

And two permissionless instructions to keep everything updated:
5. **update_volatility** — recalculates A target and fee from the EWMA
6. **update_curve** — progresses the A ramp one step

## The VolatilityState account

```
VolatilityState {
    pool: Pubkey,                    // which pool this belongs to
    bump: u8,

    // 15-minute ring buffer (4 buckets = 1 hour of history)
    bucket_15min_cursor: u16,
    bucket_15min_count: u16,
    buckets_15min: [PriceBucket; 4],

    // 1-hour ring buffer (4 buckets = 4 hours of history)
    bucket_1hour_cursor: u16,
    bucket_1hour_count: u16,
    buckets_1hour: [PriceBucket; 4],

    // EWMA variance (scaled by 1e12)
    ewma_15min: u128,
    ewma_1hour: u128,

    // Last observed tick and slot
    last_tick: i32,
    last_slot: u64,

    paused: bool,
}

PriceBucket {
    tick_cumulative: i64,    // sum of (tick * slot) for TWAP
    volume: u64,             // total volume in this bucket
    timestamp_start: i64,
    timestamp_end: i64,
}
```

This is separate from PoolState because:
- The ring buffers take significant space (~250 bytes each)
- Volatility updates happen independent of pool operations
- Permissionless cranks only need to read/write VolatilityState, not the entire pool

## What happens during every swap (the added part)

After the standard AMM swap logic runs (transfers, reserve updates, fee accrual), V-AMM does one more thing:

```
// After swap completes, record the volatility breadcrumb:

price = reserve_b / reserve_a                    // new pool price
tick = approximate_log_1_0001(price)             // convert to tick

delta_tick = tick - volatility_state.last_tick   // how much did price move?

r_squared = delta_tick² × constant²              // squared return (always positive)

// Update the EWMA:
variance = 0.95 × volatility_state.ewma_15min + 0.05 × r_squared

// Record in the 15-minute bucket:
bucket = &volatility_state.buckets_15min[cursor]
bucket.tick_cumulative += tick × current_slot
bucket.volume += amount_in

volatility_state.ewma_15min = variance
volatility_state.last_tick = tick
volatility_state.last_slot = current_slot
```

That's it. Every swap writes ~200 bytes of volatility data. The compute cost is tiny (~300-500 CU). Over hundreds of swaps, the EWMA builds a picture of how volatile the market is.

## What update_volatility does (the crank)

Anyone can call this. It reads the EWMA and computes what A and fee should be:

```
1. Read ewma_15min from VolatilityState
2. Annualize: σ = sqrt(ewma) × sqrt(31536000 / 900)
3. Clamp: σ = min(σ, 500%)  // cap at 500% annualized

4. Compute target A:
   target_A = A_max × (1 - k × σ)
   target_A = max(target_A, 1)  // minimum A is 1 (near CPMM behavior)

5. Compute target fee:
   if σ <= 15%:  raw_fee = 5 bps
   if 15% < σ < 75%:  raw_fee = smoothstep(5 → 30 bps)
   if 75% <= σ < 120%:  raw_fee = smoothstep(30 → 100 bps)
   if σ >= 120%:  raw_fee = 100 bps

6. EMA smooth the fee:
   smoothed_fee = 0.9 × fee_ema + 0.1 × raw_fee

7. Rate limit:
   delta = smoothed_fee - current_fee_bps
   delta = clamp(delta, -10, +10)   // max 10 bps change per slot
   new_fee = current_fee_bps + delta

8. Update pool state:
   pool.current_fee_bps = new_fee
   pool.fee_ema = smoothed_fee (scaled)

9. If |target_A - current_target_A| > 10%:
   Start a new A ramp:
       pool.curve_a_start = pool.curve_a_current
       pool.curve_a_target = target_A
       pool.curve_ramp_start_slot = current_slot
       pool.curve_ramp_end_slot = current_slot + 9000

10. volatility_state.last_slot = current_slot
```

## What update_curve does (the crank)

Even simpler. Reads the current slot and interpolates A:

```
1. If current_slot >= curve_ramp_end_slot:
       curve_a_current = curve_a_target
       return  // ramp complete

2. If current_slot <= curve_ramp_start_slot:
       return  // ramp hasn't started yet

3. elapsed = current_slot - curve_ramp_start_slot
   duration = curve_ramp_end_slot - curve_ramp_start_slot
   progress = elapsed / duration

4. curve_a_current = curve_a_start + (curve_a_target - curve_a_start) × progress
```

Each call moves A forward by one slot's worth. Over 9000 slots (~1 hour), A slides from old value to new value.

## Why the system works together

```
Swap happens
  │
  ├── Standard AMM: transfer tokens, update reserves, accrue fees
  │
  └── V-AMM addition: write price breadcrumb to VolatilityState
       │
       ▼
  EWMA tracks variance over time (smoothed, manipulation-resistant)
       │
       ▼
  update_volatility (anyone can call):
       │
       ├── σ → target_A → ramp over 1 hour → curve shape changes
       │
       └── σ → raw_fee → EMA smooth → rate limit → fee changes
       
  The pool is now calibrated for current market conditions.
  Calm → flat curve + cheap fees.
  Volatile → curved pool + expensive fees.
  No oracle. No admin. No governance.
```

---

[← Prev — 05 Building an AMM](05-building-an-amm.md) · [Next → 07 — Full System Walkthrough](07-walkthrough.md)
