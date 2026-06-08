# 07 — Full System Walkthrough

A complete lifecycle: pool creation → liquidity → swaps → volatility spike → rebalancing → withdrawal. Every state change, every account update.

## Step 1: Pool Creation

Alice calls `initialize_pool(pool_id=0, base_fee_bps=5, a_max=1000, k=2)`.

**Accounts created:**

| Account | Seeds | Size | What it holds initially |
|---|---|---|---|
| PoolState | `["pool", usdc_mint, sol_mint, 0]` | 416 bytes | All fields set to defaults. A=1000, fee=5, reserves=0 |
| VolatilityState | `["volatility", pool_state]` | 387 bytes | All buckets empty, EWMA=0, last_tick=0 |
| LpMint | `["lp_mint", pool_state]` | Mint | Decimals=6, authority=PoolAuthority |
| VaultA | `["vault_a", pool_state]` | Token account | Mint=USDC, authority=PoolAuthority, balance=0 |
| VaultB | `["vault_b", pool_state]` | Token account | Mint=SOL, authority=PoolAuthority, balance=0 |

**Key state in PoolState after init:**

```
reserve_a: 0
reserve_b: 0
total_lp_shares: 0
curve_a_current: 1000
curve_a_target: 1000
current_fee_bps: 5
base_fee_bps: 5
```

**What happened:** All infrastructure exists. No tokens yet. Pool is ready for liquidity.

---

## Step 2: First Liquidity Provider

Bob calls `add_liquidity(amount_a=1000 USDC, amount_b=10 SOL)`.

**Before:**
- VaultA: 0 USDC
- VaultB: 0 SOL
- total_lp_shares: 0

**During:**

```
1. CPI: Transfer 1000 USDC from Bob → VaultA (signed by Bob)
2. CPI: Transfer 10 SOL from Bob → VaultB (signed by Bob)

3. Since total_lp_shares == 0 (first LP):
   shares = D(1000, 10, A=1000)

   The StableSwap D solver runs Newton-Raphson:
   Input: x=1000 USDC, y=10 SOL, A=1000
   After ~5 iterations: D ≈ 1010

   shares = 1010 (minted as LP tokens)

4. CPI: MintTo 1010 LP tokens → Bob's LP account (signed by PoolAuthority PDA)

5. Create PositionState PDA:
   seeds = ["position", pool_state, bob_pubkey, 0]
   owner: Bob
   pool: pool_state
   shares: 1010
   fee_growth_inside_a_last: 0
   fee_growth_inside_b_last: 0
   entry_a: 1000
```

**After:**
- VaultA: 1000 USDC
- VaultB: 10 SOL
- total_lp_shares: 1010
- Bob's LP balance: 1010 LP tokens
- Bob's Position: shares=1010, fee snapshot=0
- Price: 1000/10 = 100 USDC per SOL

---

## Step 3: A Swap

Charlie calls `swap(amount_in=100 USDC, min_amount_out=0.9 SOL, is_a_to_b=true)`.

**Before swap:**
- reserve_a=1000, reserve_b=10, A=1000, fee=5 bps
- VolatilityState: last_tick=92103 (log₁.₀₀₀₁(100)), EWMA=0

**During:**

```
1. Sync curve A (check if ramp is active — it's not, A is stable at 1000)

2. Calculate fee:
   fee = 100 × 5 / 10000 = 0.05 USDC
   net_in = 100 - 0.05 = 99.95 USDC

3. Calculate output via StableSwap:
   new_reserve_a = 1000 + 99.95 = 1099.95 USDC
   Solve for new_reserve_b using Newton-Raphson:
     D = compute_d([1000, 10], A=1000)  [cached from init or last liquidity change]
     new_y = compute_y(1099.95, D, A=1000)
     After ~8 iterations: new_reserve_b ≈ 9.05 SOL
   output = 10 - 9.05 = 0.950 SOL

4. Check: 0.950 >= 0.9 ✓ (slippage check passes)

5. CPI: Transfer 100 USDC from Charlie → VaultA (signed by Charlie)
6. CPI: Transfer 0.950 SOL from VaultB → Charlie (signed by PoolAuthority PDA)

7. Update reserves:
   reserve_a = 1099.95
   reserve_b = 9.05

8. Update fee accrual:
   lp_fee = 0.05 × 0.90 = 0.045 USDC (90% to LPs)
   protocol_fee = 0.05 × 0.10 = 0.005 USDC (10% to protocol)
   fee_growth_global_a += 0.045 × (1<<64) / 1010

9. Update volatility:
   new_price = 1099.95/9.05 ≈ 121.54 USDC/SOL
   new_tick ≈ 94450 (log₁.₀₀₀₁(121.54))
   delta_tick = 94450 - 92103 = 2347 (~23.5% price move!)
   r² = 2347² × constant²

   EWMA update:
   variance = 0.95 × 0 + 0.05 × r² = 0.05 × r²
   last_tick = 94450
   last_slot = current_slot

   Record in 15-min bucket:
   bucket[0].tick_cumulative += 94450 × slot
   bucket[0].volume += 100
```

**After swap:**
- reserve_a: 1099.95 USDC (+99.95 net after fee)
- reserve_b: 9.05 SOL (-0.95)
- total_lp_shares: 1010 (unchanged — LPs accrue via fee_growth, not new tokens)
- fee_growth_global_a: now positive (Bob has earned ~0.045 USDC in fees)
- protocol_fees_a: 0.005 USDC
- EWMA variance: small but non-zero (one trade moved price ~23%)
- Price: ~121.5 USDC/SOL (up ~21.5% from Charlie's trade)

---

## Step 4: More Swaps, Volatility Rises

Over the next hour, many traders swap. The price swings between 90 and 130 USDC/SOL. Each swap updates the EWMA.

After ~50 swaps with an average price move of ~5%:

**VolatilityState now:**
- ewma_15min: roughly equivalent to 60% annualized volatility
- 15-min buckets: fully populated with 4 windows of data
- last_tick: around 95000

**PoolState:**
- reserve_a: 1200 USDC
- reserve_b: 9.2 SOL
- current_fee_bps: still 5 (nobody has called update_volatility yet)
- curve_a_current: still 1000

The market is getting volatile but the pool hasn't adapted yet.

---

## Step 5: Keeper Updates Volatility

A keeper bot calls `update_volatility()`.

**During:**

```
1. Read ewma_15min ≈ equivalent to 60% annualized

2. Annualize: σ = 60% (within bounds)

3. Compute target A:
   target_A = 1000 × (1 - 2 × 0.60) = 1000 × (1 - 1.20) = -200
   Clamp to 1: target_A = 1

4. Target changed from 1000 to 1 — that's a 99.9% difference, way over 10% threshold.
   Start ramp:
     curve_a_start = 1000 (current)
     curve_a_target = 1
     curve_ramp_start_slot = current_slot
     curve_ramp_end_slot = current_slot + 9000

5. Compute target fee:
   σ=60% → in the 15%-75% band
   smoothstep: 60% position → fee ≈ 24 bps

6. EMA smooth:
   old fee_ema was at 5 bps (scaled)
   new smoothed = 0.9 × 5 + 0.1 × 24 = 6.9 bps

7. Rate limit:
   delta = 6.9 - 5 = 1.9, which is under 10 bps limit
   new_fee = 6.9 → rounded to 7 bps

8. Update:
   current_fee_bps = 7
   fee_ema = 6.9 (scaled)
```

**After:**
- current_fee_bps: 7 (was 5, starting to rise)
- curve_a_target: 1 (ramp started)
- curve_a_current: 1000 (hasn't changed yet — ramp is slow)

The pool now knows the market is volatile. A is ramping toward 1 over the next hour. Fees are starting to tick up from 5 toward the smoothstep target.

---

## Step 6: Keeper Updates Curve (15 minutes later)

A keeper calls `update_curve()` (or someone swaps, which also syncs A).

**During:**

```
current_slot = ramp_start_slot + 2250 (15 minutes = ~2250 slots)
elapsed = 2250
duration = 9000
progress = 2250/9000 = 0.25

curve_a_current = 1000 + (1 - 1000) × 0.25
                 = 1000 + (-999) × 0.25
                 = 1000 - 249.75
                 ≈ 750
```

**After:**
- curve_a_current: 750 (was 1000, now 25% toward target of 1)
- The curve is starting to steepen. Trades experience slightly more slippage.

---

## Step 7: Another Swap After Fee Change

Diana calls `swap(amount_in=500 USDC, min_amount_out=3 SOL, is_a_to_b=true)`.

**Before:**
- reserve_a=1200, reserve_b=9.2, A=750, fee=7 bps

**During:**

```
1. Sync A: A=750 (ramp is 25% complete)

2. Fee = 500 × 7 / 10000 = 0.35 USDC
   net_in = 499.65 USDC

3. StableSwap output:
   With A=750 (lower than before), the curve is slightly curved.
   Output ≈ 3.85 SOL (less than what would have been at A=1000)

4. Volatility update:
   new_price ≈ 1699.65/5.35 ≈ 317.69 USDC/SOL
   This is a huge move — the pool is imbalanced and A is lower.
   The EWMA records another large squared return.
```

**After:**
- reserve_a: 1699.65
- reserve_b: 5.35
- EWMA variance: rising further (consistent high volatility)
- Next update_volatility will keep target_A low and push fees higher.

---

## Step 8: Volatility Subsides, Pool Recovers

Over the next day, volatility drops back to ~10%. The keeper keeps calling update_volatility.

**Over several update_volatility calls:**

```
Call 1: σ falls to 40% → target_A = 1000×(1-2×0.40) = 200
        Still a big difference from current_target (1), ramp reverses: 1→200
        Fee target: 40% → smoothstep → ~19 bps
        Fee slides up if target is higher, or stays if target is lower
        (with hold periods — fee doesn't immediately drop)

Call 2 (hour later): σ at 15%
        target_A = 1000×(1-2×0.15) = 700
        Ramp adjusts: current_A → toward 700

Call 3 (another hour): σ at 5%
        target_A = 1000×(1-2×0.05) = 900
        Almost back to initial A

Call 4: σ at 3%, sustained calm
        target_A = 1000 (fully calm)
        Fee target: 5 bps
        After rate-limited descent: fee returns to 5 bps
```

**Final state (calm returned):**
- curve_a_current: 1000 (back to flat)
- current_fee_bps: 5 (back to cheap)
- EWMA variance: near zero
- Pool is back in calm-mode configuration

---

## Step 9: Bob Withdraws Liquidity

Bob calls `remove_liquidity(shares=500)`.

**Before:**
- Bob's position: 1010 shares
- total_lp_shares: 1010
- reserves: roughly 1100 USDC, 10 SOL (pool has rebalanced through trades)
- fee_growth_global_a > Bob's fee_growth_inside_a_last → Bob has earned fees

**During:**

```
1. Check: Bob has >= 500 shares ✓

2. Calculate withdrawal:
   ratio = 500 / 1010 = 0.495
   amount_a = 1100 × 0.495 ≈ 544.5 USDC
   amount_b = 10 × 0.495 ≈ 4.95 SOL

3. Calculate uncollected fees:
   new_fees_a = (fee_growth_global_a - bob_fee_snapshot_a) × 500 / (1<<64)
   (This represents Bob's share of fees earned since his last deposit)
   bob.uncollected_fees_a += new_fees_a
   bob.fee_growth_inside_a_last = fee_growth_global_a

4. Burn 500 LP tokens from Bob (CPI, signed by Bob)

5. Transfer 544.5 USDC from VaultA → Bob (CPI, signed by PoolAuthority PDA)
6. Transfer 4.95 SOL from VaultB → Bob (CPI, signed by PoolAuthority PDA)

7. Update state:
   reserve_a -= 544.5
   reserve_b -= 4.95
   total_lp_shares -= 500
   bob_position.shares -= 500
```

**After:**
- Bob has 510 LP shares remaining (1010 - 500)
- Bob received 544.5 USDC + 4.95 SOL + uncollected fees
- Pool reserves reduced proportionally
- Pool continues operating for remaining LPs

---

## What we just traced

| Step | Instruction | Who calls | What changed |
|---|---|---|---|
| 1 | initialize_pool | Alice | 5 PDAs created, pool ready |
| 2 | add_liquidity | Bob | Reserves set, LP tokens minted, position created |
| 3 | swap | Charlie | Reserves shift, fee accrued, first volatility breadcrumb |
| 4 | Many swaps | Various | EWMA rises, market getting volatile |
| 5 | update_volatility | Keeper | A ramp starts (1000→1), fee rises (5→7 bps) |
| 6 | update_curve | Keeper | A slides to 750 (ramp 25% complete) |
| 7 | swap | Diana | Trade executes at higher fee + steeper curve |
| 8 | Many cranks | Keeper | Volatility subsides, A ramps back up, fees return to 5 |
| 9 | remove_liquidity | Bob | LP tokens burned, tokens + fees returned |

Every step changes on-chain state. Every state change is deterministic. The pool went from calm → volatile → calm without any human adjusting parameters. The volatility engine watched, the cranks updated, the pool adapted.

---

[← Prev — 06 From AMM to V-AMM](06-vamm.md) · [Back to Start — 01 Start Here](01-start-here.md)
