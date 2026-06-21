# Step 6: Full System Walkthrough

A USDC/SOL pool goes from creation → liquidity → swaps → volatility spike → rebalancing → withdrawal. Every instruction, every state change, every account update. With code references to the actual source.

---

## Step 1: Pool Creation

Alice calls `initialize_pool(pool_id=0, base_fee_bps=5, a_max=1000, k=2)`.

**Source:** `instructions/initialize_pool.rs`

**Accounts created (6 total):**

| Account | Seeds | Source line |
|---|---|---|
| PoolState | `["pool", usdc_mint, sol_mint, [0,0]]` | `initialize_pool.rs:16-22` |
| VolatilityState | `["volatility", pool_state]` | `initialize_pool.rs:25-31` |
| PoolAuthority | `["authority", pool_state]` | `initialize_pool.rs:35-38` |
| LpMint | `["lp_mint", pool_state]` | `initialize_pool.rs:41-48` |
| VaultA | `["vault_a", pool_state]` | `initialize_pool.rs:51-58` |
| VaultB | `["vault_b", pool_state]` | `initialize_pool.rs:61-68` |

**PoolState after init (`initialize_pool.rs:87-128`):**

```
bump: computed during init
status: 0 (active)
pool_id: 0
token_mint_a: USDC mint address
token_mint_b: SOL mint address
token_vault_a: VaultA address (cross-reference)
token_vault_b: VaultB address (cross-reference)
lp_mint: LpMint address
pool_authority: PoolAuthority address
reserve_a: 0
reserve_b: 0
total_lp_shares: 0
curve_a_current: 1000
curve_a_target: 1000
curve_a_start: 1000
curve_ramp_start_slot: current_slot
curve_ramp_end_slot: current_slot
base_fee_bps: 5
current_fee_bps: 5
fee_ema: 5 × 10^12 = 5,000,000,000,000
fee_growth_global_a: 0
fee_growth_global_b: 0
protocol_fees_a: 0
protocol_fees_b: 0
last_swap_slot: current_slot
last_swap_price_x64: 0
a_max: 1000
k: 2
volatility_state: VolatilityState PDA address
last_update_slot: current_slot
```

**VolatilityState after init (`initialize_pool.rs:130-144`):**

```
pool: PoolState PDA address
bump: computed during init
bucket_15min_cursor: 0
bucket_15min_count: 0
buckets_15min: [default; 4]  (all zeros)
bucket_1hour_cursor: 0
buckets_1hour: [default; 4]
ewma_15min: 0
ewma_1hour: 0
last_tick: 0
last_slot: current_slot
paused: false
```

**Cost:** Alice pays rent for 6 accounts. Approximately 0.02 SOL total. The SOL stays in the accounts as rent-exempt balance — she doesn't get it back unless accounts are closed.

---

## Step 2: First LP Adds Liquidity

Bob calls `add_liquidity(amount_a=1000 USDC, amount_b=10 SOL)`.

**Source:** `instructions/add_liquidity.rs`

**Before:** PoolState reserves = (0, 0), total_lp_shares = 0.
VaultA = 0 USDC. VaultB = 0 SOL.

**During:**

```
1. Sync curve: a_current = 1000 (no ramp active)
   [add_liquidity.rs:105]

2. Transfer tokens to vaults (CPIs):
   Token::Transfer(Bob_USDC → VaultA, 1000)  authority: Bob
   Token::Transfer(Bob_SOL → VaultB, 10)     authority: Bob
   [add_liquidity.rs:108-127]

3. Since total_lp_shares == 0 (first LP):
   shares = D(1000, 10, A=1000)
   [add_liquidity.rs:130-136]
   [math/mod.rs: StableSwap::compute_d()]

   The D solver runs Newton-Raphson:
   amp = 1000, sum = 1010
   D starts at 1010 (initial guess = sum of reserves)
   After ~5 iterations: D ≈ 1010

   shares = 1010

4. Mint LP tokens to Bob:
   Token::MintTo(LpMint → Bob_LP, 1010) authority: PoolAuthority PDA
   [add_liquidity.rs:171-182]
   Seeds used for PDA signing: ["authority", pool_state_key, bump]

5. Create PositionState PDA:
   seeds = ["position", pool_state, Bob, [0]]
   [add_liquidity.rs:73-78]

   PositionState:
     owner: Bob
     pool: pool_state
     bump: computed
     nonce: 0
     shares: 1010
     fee_growth_inside_a_last: 0   (snapshot at deposit)
     fee_growth_inside_b_last: 0   (snapshot at deposit)
     uncollected_fees_a: 0
     uncollected_fees_b: 0
     entry_a: 1000
   [add_liquidity.rs:185-193]

6. Update PoolState:
   reserve_a: 1000 (was 0)
   reserve_b: 10 (was 0)
   total_lp_shares: 1010 (was 0)
   [add_liquidity.rs:158-161]
```

**After:** Pool is seeded. 1000 USDC and 10 SOL in vaults. Price: 100 USDC/SOL. Bob holds 1010 LP tokens (100% of pool). Bob's position tracks his share and has a fee snapshot at zero.

---

## Step 3: A Trader Swaps

Charlie calls `swap(amount_in=100, min_amount_out=0.9, is_a_to_b=true)`.

**Source:** `instructions/swap.rs`

**Before:** reserves=(1000, 10), A=1000, fee=5 bps. VolState: last_tick=92103, EWMA=0.

**During:**

```
1. Validate inputs:
   amount_in=100 > 0 ✓
   reserves both > 0 ✓
   token accounts match pool mints ✓
   [swap.rs:77-84]

2. Sync curve: a_current = 1000
   [swap.rs:87]

3. Fee calculation:
   fee = 100 × 5 / 10000 = 0.05 USDC
   net_in = 100 - 0.05 = 99.95 USDC
   [swap.rs:90-99]

4. StableSwap output:
   D = compute_d([1000, 10], 1000) ≈ 998.07
       [math/mod.rs: StableSwap::compute_d()]
       (D < sum of reserves because the pool is imbalanced 100:1;
        for a balanced pool D = sum)

   New reserve A = 1000 + 99.95 = 1099.95
   New reserve B = compute_y(1099.95, 998.07, 1000) ≈ 1.09
       [math/mod.rs: StableSwap::compute_y(), ~8 Newton iterations]
       (for a balanced 1000/1000 pool with the same A and trade, the output would be 99.94)

   dy = 10 - 1.09 - 1 = 7.91 SOL (round down by 1)
       [math/mod.rs: StableSwap::get_dy(), line 181-185]

5. Slippage check:
   dy=0.949 >= min_out=0.9 ✓
   [swap.rs:115]

6. Transfer input (CPI):
   Token::Transfer(Charlie_USDC → VaultA, 100) authority: Charlie
   [swap.rs:118-130]

7. Transfer output (CPI):
   Token::Transfer(VaultB → Charlie_SOL, 0.949) authority: PoolAuthority PDA
   Seeds: ["authority", pool_state_key, bump]
   [swap.rs:133-156]

8. Update reserves:
   reserve_a: 1100 (1000 + 100)
   reserve_b: 9.051 (10 - 0.949)
   [swap.rs:159-165]

9. Fee accrual:
   lp_fee = 0.05 × 0.9 = 0.045 USDC
   protocol_fee = 0.05 × 0.1 = 0.005 USDC

   fee_growth_global_a = 0 + 0.045 × 2^64 / 1010
                        = 830,103,483,315 (scaled fixed-point)
   protocol_fees_a = 0.005
   [swap.rs:168-189]

10. Volatility breadcrumb:
    new_price = 1100 / 9.051 ≈ 121.53 USDC/SOL
    tick ≈ log₁.₀₀₀₁(121.53) ≈ 94450
    delta_tick = 94450 - 92103 = 2347
    r² = 2347² × LN_10001²

    EWMA = 0.95 × 0 + 0.05 × r² = small_positive_value
    [swap.rs:218-264, update_volatility_bucket()]

    last_swap_slot = current_slot
    last_swap_price_x64 = 121.53 × 2^64 (Q64.64 format)
    vol_state.last_tick = 94450
    vol_state.ewma_15min = EWMA value
```

**After:** Pool reserves shifted. Bob has earned ~0.045 USDC in fees (not yet visible in his position — it's in the fee_growth_global_a delta). EWMA has a small positive value from one 23% price move.

---

## Step 4: Volatility Spike

Over the next 30 minutes, many swaps happen. Price swings between 90 and 130 USDC/SOL. Each swap updates the EWMA.

After ~50 swaps with average 5% price moves:

**VolatilityState:**
- ewma_15min: equivalent to ~60% annualized volatility
- buckets_15min: all 4 slots populated
- last_tick: ~95000

**PoolState (unchanged from admin perspective):**
- current_fee_bps: still 5 (no crank has run)
- curve_a_current: still 1000 (no crank has run)
- reserves: shifted due to trades (e.g., 1200 USDC, 9.2 SOL)

The market is volatile but the pool hasn't adapted yet. This is where the crank matters.

---

## Step 5: Keeper Updates Volatility

A keeper bot calls `update_volatility()`.

**Source:** `instructions/update_volatility.rs`

```
1. Read VolatilityState (EWMA ≈ equivalent to 60% annualized)
   [update_volatility.rs:24-27]

2. Annualize:
   σ = sqrt(ewma_15min) × sqrt(31536000/900)
     ≈ 60%
   [update_volatility.rs:37-40]
   [math/mod.rs: annualize_volatility()]

3. Clamp: 60% < 500% max, no clamp needed
   [update_volatility.rs:43]

4. Compute target A:
   target_A = 1000 × (1 - 2 × 0.60) = 1000 × (1 - 1.20) = -200
   Clamped to 1 (minimum)
   [update_volatility.rs:46-50]
   [math/mod.rs: sigma_to_a()]

5. Compute raw fee:
   σ=60% → in 15%-75% band
   t = (60-15)/60 = 0.75
   smoothstep(0.75) = 3×0.75² - 2×0.75³ = 1.6875 - 0.84375 = 0.84375
   raw_fee = 5 + 25 × 0.84375 = 26.09 bps
   [update_volatility.rs:53]
   [math/mod.rs: compute_fee(), smoothstep()]

6. EMA smooth:
   old_fee_ema = 5 × 10^12 (scaled)
   raw_fee_scaled = 26.09 × 10^12
   smoothed = 0.9 × 5×10^12 + 0.1 × 26.09×10^12
            = 7.109 × 10^12
   → 7.109 bps
   [update_volatility.rs:56-60]
   [math/mod.rs: smooth_fee()]

7. Rate limit:
   delta = 7.109 - 5 = 2.109, under 10 bps cap
   new_fee = 7 bps (rounded down)
   [update_volatility.rs:63-67]
   [math/mod.rs: limit_fee_change()]

8. Update pool:
   current_fee_bps = 7
   fee_ema = 7.109 (scaled)
   [update_volatility.rs:70-73]

9. Check A ramp:
   |1 - 1000| = 999, which is 99.9% of 1000 → exceeds 10% threshold
   Start ramp:
     curve_a_start = 1000
     curve_a_target = 1
     curve_ramp_start_slot = current_slot
     curve_ramp_end_slot = current_slot + 9000
   [update_volatility.rs:76-89]

10. Update volatility:
    vol_state.last_slot = current_slot
    [update_volatility.rs:91]
```

**After:** Fee starts rising (5 → 7 bps). A ramp begins (1000 → 1 over 9000 slots). The pool is now adapting.

---

## Step 6: Another Swap After Changes

Diana calls `swap(amount_in=500, min_amount_out=3, is_a_to_b=true)`.

**Before:** reserves=(1200, 9.2), A ramping (currently ~990 after a few slots), fee=7 bps.

**During:**

```
1. Sync A: a_current ≈ 990 (ramp ~1% complete after a few slots)
   [state.rs: sync_curve()]

2. Fee = 500 × 7 / 10000 = 0.35 USDC
   net_in = 499.65 USDC

3. StableSwap output:
   With A=990 (slightly lower than A=1000), the curve is slightly steeper.
   Output ≈ 3.85 SOL

4. Volatility:
   Another large price move → EWMA rises further.
```

**After:** Diana paid 7 bps instead of 5 bps. The A ramp continues. The EWMA keeps climbing. Next `update_volatility` call will push fees higher.

---

## Step 7: Recovery

Over the next 12 hours, volatility subsides to ~5%. The keeper keeps calling `update_volatility` and `update_curve`.

**Over multiple crank calls:**

```
Call 1: σ=40% → target_A=200, fee target=~19 bps
        (A ramp reverses: was heading to 1, now heading to 200)

Call 2: σ=15% → target_A=700, fee target=~10 bps
        (A continues rising, fee sliding down via rate limit)

Call 3: σ=5% → target_A=900, fee target=5 bps
        (Near calm — A almost back, fee returning to minimum)

Call 4: σ=3% → target_A=1000, fee target=5 bps
        (Fully calm — A at max, fee at minimum)
```

**After recovery:** A=1000, fee=5 bps. Pool is back in calm-mode configuration. No human intervened. The system responded to the market autonomously.

---

## Step 8: Bob Withdraws

Bob calls `remove_liquidity(shares=500)`.

**Source:** `instructions/remove_liquidity.rs`

**Before:** Bob has 1010 shares. total_lp_shares=1010. reserves=(~1100, ~10) — rebalanced from many swaps. fee_growth_global_a > Bob's snapshot.

**During:**

```
1. Validate:
   shares=500 > 0 ✓
   position.shares=1010 >= 500 ✓
   position.owner == Bob ✓
   [remove_liquidity.rs:92-93]

2. Collect uncollected fees:
   fees_a = (fee_growth_global_a - bob.fee_growth_inside_a_last) × 500 / 2^64
   [Bob earned ~0.50 USDC in fees from all the trades since his deposit]
   bob.uncollected_fees_a += fees_a
   bob.fee_growth_inside_a_last = fee_growth_global_a
   [remove_liquidity.rs:95-115]

3. Calculate proportional withdrawal:
   ratio = 500 / 1010 ≈ 0.495
   amount_a = 1100 × 0.495 ≈ 544.5 USDC
   amount_b = 10 × 0.495 ≈ 4.95 SOL
   [remove_liquidity.rs:99-115]

4. Burn LP tokens (CPI):
   Token::Burn(LpMint ← Bob_LP, 500) authority: Bob + PDA seeds
   [remove_liquidity.rs:125-136]

5. Transfer tokens back (CPIs):
   Token::Transfer(VaultA → Bob_USDC, 544.5) authority: PoolAuthority PDA
   Token::Transfer(VaultB → Bob_SOL, 4.95) authority: PoolAuthority PDA
   [remove_liquidity.rs:139-165]

6. Update state:
   reserve_a: 1100 - 544.5 = 555.5
   reserve_b: 10 - 4.95 = 5.05
   total_lp_shares: 1010 - 500 = 510
   bob_position.shares: 1010 - 500 = 510
   [remove_liquidity.rs:168-172]
```

**After:** Bob has 510 LP shares remaining. He received 544.5 USDC + 4.95 SOL + ~0.50 USDC in accumulated fees. Pool reserves reduced proportionally. Pool continues for remaining LPs.

---

## Complete CPI Trace

Every cross-program call across the entire lifecycle:

```
initialize_pool:
  System Program (create PoolState, VolState, LpMint, VaultA, VaultB)
    payer: Alice (the caller)
  Token Program (init LpMint, VaultA, VaultB)

add_liquidity:
  Token Program (transfer Bob → VaultA)       authority: Bob
  Token Program (transfer Bob → VaultB)       authority: Bob
  Token Program (mint LpMint → Bob_LP)        authority: PoolAuthority PDA

swap:
  Token Program (transfer Charlie → VaultA)   authority: Charlie
  Token Program (transfer VaultB → Charlie)   authority: PoolAuthority PDA

remove_liquidity:
  Token Program (burn Bob_LP → LpMint)        authority: Bob + PDA seeds
  Token Program (transfer VaultA → Bob)       authority: PoolAuthority PDA
  Token Program (transfer VaultB → Bob)       authority: PoolAuthority PDA

update_volatility:
  (no CPIs — reads VolState, writes PoolState directly)

update_curve:
  (no CPIs — reads Clock sysvar, writes PoolState directly)
```

---

[← Prev — Step 5 From AMM to V-AMM](05-build-vamm.md)
