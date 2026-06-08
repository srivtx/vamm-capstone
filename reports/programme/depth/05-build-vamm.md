# Step 5: From AMM to V-AMM

The AMM we built in Step 4 is static. Its A and fee are chosen at launch and never change. V-AMM adds a brain that watches the market and adjusts both.

---

## Part A: The core problem with static AMMs

A pool launched during calm markets (A=1000, fee=5 bps) is perfect for months of stable trading. Then volatility spikes. Now the flat curve is dangerous — arbs drain the pool at tight prices. The 5 bps fee doesn't cover LP losses.

A pool launched during volatility (A=10, fee=100 bps) protects LPs but when things calm down, traders go elsewhere — your slippage and fees are too high.

**The pool needs to be both, at different times.** The question: what signal tells the pool which mode to be in?

Answer: **realized volatility** — how much the price has actually been moving.

---

## Part B: Why separate VolatilityState?

We could put EWMA and ring buffers directly in PoolState. Why a separate account?

**Reason 1: Write cost.** Every swap writes to PoolState (reserves, fees, last_swap_slot). If volatility data were also in PoolState, every swap would write an extra ~250 bytes (the ring buffers). Separate accounts = optional write cost. Swaps that don't need volatility data can skip the extra write.

**Reason 2: Permissionless access.** `update_volatility` needs to read EWMA and write A/fee targets. It doesn't need reserves or LP data. A separate VolatilityState means the crank reads/writes one small account instead of the full PoolState.

**Reason 3: Data size.** PoolState is already ~416 bytes. Adding 4 buckets × 2 ring buffers × 32 bytes = 256 more bytes. Smaller accounts are cheaper to read and write.

```rust
VolatilityState {
    pool: Pubkey,                    // backlink to pool
    bump: u8,

    // 15-minute ring buffer
    bucket_15min_cursor: u16,        // which slot is current
    bucket_15min_count: u16,         // how many are populated
    buckets_15min: [PriceBucket; 4], // 4 buckets = 1 hour of 15-min data

    // 1-hour ring buffer
    bucket_1hour_cursor: u16,
    bucket_1hour_count: u16,
    buckets_1hour: [PriceBucket; 4], // 4 buckets = 4 hours of data

    ewma_15min: u128,                // EWMA variance (scaled by 1e12)
    ewma_1hour: u128,

    last_tick: i32,
    last_slot: u64,
    paused: bool,
}

PriceBucket {
    tick_cumulative: i64,            // sum of (tick × slot) for TWAP
    volume: u64,                     // total trading volume in this window
    timestamp_start: i64,
    timestamp_end: i64,
}
```

**Why two ring buffers (15-min and 1-hour)?** The 15-min buffer provides fast response for fee adjustments. The 1-hour buffer provides a manipulation-resistant cross-check. If the EWMA says 500% volatility but the 1-hour buffer shows only 3 trades, something is wrong — likely manipulation.

**Why 4 buckets each?** 4 × 15 min = 1 hour of short-range data. 4 × 1 hour = 4 hours of long-range data. More buckets = more precision but more storage cost. 4 is the sweet spot.

---

## Part C: How the volatility engine works (per-swap)

Every swap writes a breadcrumb. Here's what happens each time:

```
1. CALCULATE NEW PRICE
   price = reserve_b / reserve_a
   [This is the pool's internal price after the swap executes]

2. APPROXIMATE THE TICK
   tick ≈ log₂(price) × 6931 / 10000
   [Using leading_zeros() for approximate log₂
    then converting to log₁.₀₀₀₁ base via constant]
   [swap.rs:228-231]

3. COMPUTE SQUARED RETURN
   delta_tick = tick - vol_state.last_tick
   r² = delta_tick² × LN_10001²
   [LN_10001 = ln(1.0001) ≈ 0.000099995, a constant]
   [math/mod.rs: tick_to_return_sq()]

4. UPDATE EWMA
   variance = 0.95 × old_variance + 0.05 × r²
   [95% old, 5% new — smooths out single-trade spikes]
   [math/mod.rs: update_ewma()]

5. RECORD IN 15-MIN BUCKET
   bucket = &buckets_15min[cursor]
   bucket.tick_cumulative += tick × current_slot
   bucket.volume += amount_in
   [swap.rs:241-249]

6. STORE
   vol_state.ewma_15min = variance
   vol_state.last_tick = tick
   vol_state.last_slot = current_slot
```

**Why EWMA and not a simple rolling average?** A simple average of the last N trades requires storing all N trades. On Solana, every byte of storage costs rent. EWMA uses O(1) storage — just one `ewma_15min` field that updates in place. It also weights recent data more (λ=0.95), which is exactly what we want — recent volatility matters more than volatility from hours ago.

**Why λ=0.95?** 0.95 means each update keeps 95% of the old value. After ~14 trades, an old data point's influence is halved. Fast enough to respond to regime changes (minutes), slow enough to ignore single spikes.

**Why squared returns (r²)?** Volatility measures magnitude, not direction. Up 5% and down 5% are equally volatile. Squaring makes everything positive and amplifies large moves (a 10% move gives 4× the r² of a 5% move).

---

## Part D: How update_volatility converts σ into A and fee

Anyone can call `update_volatility`. It reads the EWMA and computes what A and fee should be.

```
1. ANNUALIZE THE VARIANCE
   σ = sqrt(ewma_15min) × sqrt(31,536,000 / 900)
     = sqrt(variance) × sqrt(35040)
     ≈ sqrt(variance) × 187
   [scale to annual terms for standard comparison]
   [math/mod.rs: annualize_volatility()]

2. CLAMP
   σ = min(σ, 500%)
   [prevent arithmetic overflow, downstream safety]

3. MAP σ TO TARGET A
   target_A = A_max × (1 - k × σ)
   target_A = max(target_A, 1)
   [A = A_max when σ=0 (calm). A ≈ 1 when σ is high (volatile)]
   [math/mod.rs: sigma_to_a()]

4. MAP σ TO RAW FEE
   if σ ≤ 15%:          raw_fee = 5 bps
   if 15% < σ < 75%:    raw_fee = smoothstep(5 → 30 bps)
   if 75% ≤ σ < 120%:   raw_fee = smoothstep(30 → 100 bps)
   if σ ≥ 120%:         raw_fee = 100 bps (capped)
   [math/mod.rs: compute_fee()]

5. EMA SMOOTH THE FEE
   smoothed = 0.9 × fee_ema_scaled + 0.1 × raw_fee_scaled
   [don't let fee twitch on every volatility change]

6. RATE LIMIT
   delta = smoothed - current_fee
   delta = clamp(delta, -10, +10)
   new_fee = current_fee + delta
   [max 10 bps change per slot]
   [math/mod.rs: limit_fee_change()]

7. UPDATE POOL STATE
   pool.current_fee_bps = new_fee
   pool.fee_ema = smoothed (scaled by 1e12)

8. CHECK IF A NEEDS RAMPING
   if |target_A - current_target_A| > current_target_A / 10:
       // More than 10% difference — start a ramp
       pool.curve_a_start = pool.curve_a_current
       pool.curve_a_target = target_A
       pool.curve_ramp_start_slot = current_slot
       pool.curve_ramp_end_slot = current_slot + 9000
```

**Why smoothstep and not linear?** A linear ramp from 5 to 30 bps would undershoot at the boundaries — at 20% volatility you'd charge less than the research says is optimal. Smoothstep stays exact at the target bands and transitions smoothly between them. No cliffs that arbitrageurs can exploit.

**Why 10% A change threshold?** Without it, every tiny wiggle in σ would trigger a new ramp. The pool would be constantly ramping — never stable. The threshold says "only change A if market conditions have meaningfully shifted."

**Why 9000 slots (~1 hour) for A ramp?** If A jumped instantly, an arbitrageur could sandwich the change. 9000 slots means A moves ~0.01% per slot — no profitable arb window. Fast enough to respond to real market changes, slow enough to prevent exploitation.

**Why max 10 bps/slot for fee changes?** Same principle. A full shift from 5 to 100 bps takes ~10 slots (~4 seconds). The fee responds but doesn't jump. An attacker can't spike fees to grief traders.

---

## Part E: Why permissionless cranks?

Both `update_volatility` and `update_curve` can be called by anyone.

**Why not restrict to an admin key?**
- Admin key can be lost, stolen, or its holder can go offline
- Permissionless = always available. Anyone can run a keeper bot.
- No trust required — the instructions only do what the math allows. A malicious keeper can't drain funds or set arbitrary parameters.

**Why not automate in every swap?** Computing A and fee from EWMA on every swap would add ~2000 CU per trade. By separating it into a crank, swaps stay cheap (~500 CU for the breadcrumb) and the full computation runs independently.

**How keepers work in practice:**

```
A keeper bot does this every ~400ms (once per slot):
  1. Call update_curve()   — interpolate A one step forward
  2. Call update_volatility() — if conditions changed, recalculate targets
  3. Pay ~0.000005 SOL in transaction fees

Anyone can run one. Multiple keepers = redundancy.
```

---

## Part F: The V-AMM CPI map (with volatility)

Adding the volatility engine doesn't change the existing CPIs. It adds state writes:

```
SWAP (already existed):
  SPL Token: transfer(user→vault)         authority: user
  SPL Token: transfer(vault→user)         authority: PoolAuthority PDA
  Write: PoolState (reserves, fee_growth, last_swap)
  Write: VolatilityState (EWMA, bucket, last_tick)   ← NEW

UPDATE_VOLATILITY (new):
  Read:  VolatilityState (EWMA, paused)
  Write: PoolState (current_fee_bps, fee_ema, A targets)

UPDATE_CURVE (new):
  Read:  PoolState (A ramp parameters)
  Read:  Clock sysvar (current slot)
  Write: PoolState (curve_a_current)
```

---

## What we built

A static AMM became a living system. The pool watches its own price history, computes volatility, and adjusts its curve shape and fees accordingly. No oracle. No admin. No governance. Just math and cranks.

| Component | Static AMM | V-AMM |
|---|---|---|
| Curve shape | Fixed A | A ramps based on σ |
| Swap fee | Fixed bps | Smoothstep based on σ, EMA-smoothed, rate-limited |
| Price tracking | None | EWMA + ring buffers per swap |
| Maintenance | None needed | Permissionless cranks keep pool calibrated |
| Attack surface | Static parameters | Gradual ramps + rate limits prevent manipulation |

---

[← Prev — Step 4 Building an AMM](04-build-amm.md) · [Next → Step 6 — Full System Walkthrough](06-full-system.md)
