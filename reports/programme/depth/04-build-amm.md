# Step 4: Building an AMM

We have vaults that hold tokens. We have a PoolAuthority that can sign withdrawals. Now we need the thing that decides how much to give a trader for their tokens — the AMM math.

---

## Part A: What problem does an AMM solve?

A trader says: "I want to give you 100 USDC, give me some SOL back." The pool has 1000 USDC and 10 SOL sitting in the vaults.

Question: how many SOL should the trader get?

**Option A: Fixed price.** Always give 1 SOL per 100 USDC. Problem: if the pool runs out of SOL, it's dead. If the market price moves, arbs drain the pool.

**Option B: Let a human set the price.** Problem: who? How often? What if they're wrong or malicious?

**Option C: Let the reserves determine the price.** If SOL is scarce (low reserve), it costs more USDC. If SOL is abundant (high reserve), it costs less. This is the AMM approach — the formula IS the price.

---

## Part B: Choosing the formula

We need a formula `f(reserve_a, reserve_b)` that determines how much output a trader gets.

**Constant Product:** `x × y = k`

```
Pool: 1000 USDC, 10 SOL. k = 10000.

Trader puts in 100 USDC:
  New USDC = 1100
  To keep k: 1100 × new_SOL = 10000
  new_SOL = 9.09
  Output = 10 - 9.09 = 0.91 SOL
  Price moved from 100 to 121 USDC/SOL
```

**Why this works:** The price moves with every trade. Big trade = big price movement. Arb brings it back to market price. Pool never drains (SOL approaches 0 but never reaches it).

**Problem:** Slippage exists everywhere. Even for stable pairs like USDC/USDT that should trade 1:1. A 1% trade causes ~1% slippage.

**Constant Sum:** `x + y = S`

```
Pool: 1000 USDC, 1000 USDT. S = 2000.

Trader puts in 100 USDC:
  New USDC = 1100
  To keep S: 1100 + new_USDT = 2000
  new_USDT = 900
  Output = 1000 - 900 = 100 USDT
  Price didn't move — exactly 1:1.
```

**Why this is perfect for stable pairs:** No slippage, always 1:1. **Problem:** Drains completely. If someone keeps buying USDT, the pool hits zero USDT and dies.

**What we actually want (StableSwap):** A formula that behaves like constant sum near the balanced point (flat, tight spreads) and like constant product at the edges (curved, never drains). This is what Curve Finance invented: the StableSwap invariant controlled by a parameter A.

---

## Part C: Designing the PoolState

PoolState is where all pool data lives. Every field must be justified.

```rust
pub struct PoolState {
    pub bump: u8,                      // PDA bump for re-derivation
    pub status: u8,                    // 0=active, 1=paused
    pub pool_id: u16,                  // allows multiple pools per mint pair

    // Cross-references to other accounts
    pub token_mint_a: Pubkey,          // which token is A
    pub token_mint_b: Pubkey,          // which token is B
    pub token_vault_a: Pubkey,         // where token A reserves live
    pub token_vault_b: Pubkey,         // where token B reserves live
    pub lp_mint: Pubkey,               // LP token mint
    pub pool_authority: Pubkey,        // PDA that signs transfers

    // Pool economics
    pub reserve_a: u128,               // current token A balance
    pub reserve_b: u128,               // current token B balance
    pub total_lp_shares: u128,         // total LP tokens outstanding

    // Curve parameters
    pub curve_a_current: u64,          // current amplification A
    pub curve_a_target: u64,           // where A is ramping toward
    pub curve_a_start: u64,            // A value when ramp began
    pub curve_ramp_start_slot: u64,    // when ramp started
    pub curve_ramp_end_slot: u64,      // when ramp ends

    // Fee parameters
    pub base_fee_bps: u16,             // minimum fee (set at init)
    pub current_fee_bps: u16,          // current dynamic fee
    pub fee_ema: u128,                 // EMA-smoothed fee (scaled)

    // Fee accounting (tracks cumulative fees per LP share)
    pub fee_growth_global_a: u128,     // total fees per LP share (token A)
    pub fee_growth_global_b: u128,     // total fees per LP share (token B)
    pub protocol_fees_a: u64,          // protocol's cut (token A)
    pub protocol_fees_b: u64,          // protocol's cut (token B)

    // Volatility tracking
    pub last_swap_slot: u64,           // when last swap happened
    pub last_swap_price_x64: u128,     // price after last swap (Q64.64)

    // Configuration
    pub a_max: u64,                    // maximum A (pool set at init)
    pub k: u64,                        // volatility sensitivity

    pub volatility_state: Pubkey,      // points to VolatilityState PDA
    pub last_update_slot: u64,         // when pool was last updated
}
```

### Why each field exists

**reserve_a / reserve_b as u128:** Reserves can be huge (billions of tokens with 6-9 decimals). u64 would overflow. u128 gives us up to 3.4×10³⁸ — enough for any realistic pool.

**Why store cross-references (token_vault_a, lp_mint, etc.)?** Because given only the PoolState, the program can find every related account. You don't need an indexer or separate lookup. The pool state IS the lookup.

**Why store pool_authority?** The program needs it for CPI signing. Computing it every time from seeds would cost extra CU. Store once, read many times.

**Why three A fields (current, target, start)?** To support ramping. current is what the pool uses right now. target is where it's headed. start is where the ramp began. Without all three, you can't interpolate.

**Why u128 for fee_growth_global?** Fees are tiny amounts (0.05 USDC) divided by total LP shares (thousands to millions). The result is a fraction. We multiply by 2^64 to store it as an integer with high precision. u128 gives enough headroom for years of fee accumulation.

**Why store last_swap_slot and last_swap_price?** The volatility engine needs them. Between swaps, the price is the last swap price. When a new swap arrives, the engine computes the return from last_swap_price to the new price.

---

## Part D: How LP shares work (fee_growth accounting)

This is the trickiest part of AMM design. Multiple LPs deposit at different times. After 100 swaps with fees, each LP should earn fees proportional to their share and the time they were in the pool.

**The naive approach (broken):** Store a list of every LP and iterate on every swap to update their fees. Problem: on Solana, you can't iterate over a dynamic list in one transaction (compute limits). And you'd need to know every LP at swap time.

**The fee_growth approach (correct):**

```
PoolState stores (updated every swap):
  fee_growth_global_a = total_fees_ever_collected_a / total_lp_shares
  (multiplied by 2^64 for precision)

PositionState stores (snapshot when LP deposits):
  fee_growth_inside_a_last = fee_growth_global_a at deposit time
  uncollected_fees_a = 0 (accumulated but not withdrawn)

When LP withdraws or adds more liquidity:
  new_fees = (fee_growth_global_a - fee_growth_inside_a_last) × position.shares / 2^64
  uncollected_fees_a += new_fees
  fee_growth_inside_a_last = fee_growth_global_a  (reset snapshot)
```

**Why this works:** Instead of per-LP updates on every swap (O(N)), we do one global update per swap (O(1)) and one per-LP update when that LP interacts (O(1) per LP interaction). The math is identical — the LP's earned fees are `(current_global - their_snapshot) × their_shares`.

**Why 2^64 scaling?** Without scaling, small fee amounts divided by large LP shares would round to zero. With 2^64 scaling, we preserve precision. Example: 0.05 USDC fee, 10,000 LP shares. Without scaling: 0.05/10000 = 0 (rounded to zero in integer math). With scaling: 0.05 × 2^64 / 10000 = 92,233,720,368,547. That's a precise fixed-point value.

---

## Part E: How a swap works (full walkthrough)

```
User calls: swap(amount_in=100 USDC, min_amount_out=0.9 SOL, is_a_to_b=true)

1. VALIDATE
   require!(amount_in > 0)                          [error.rs: math overflow]
   require!(reserve_a > 0 && reserve_b > 0)          [error.rs: invalid reserves]
   require!(user_source.mint == token_mint_a)         [error.rs: invalid token account]
   require!(user_dest.mint == token_mint_b)           [same]

2. SYNC CURVE
   If ramp is active, interpolate A between start and target:
     elapsed = current_slot - ramp_start_slot
     a_current = a_start + (a_target - a_start) × elapsed / duration
   [state.rs: sync_curve()]

3. CALCULATE FEE
   fee = amount_in × current_fee_bps / 10000
   net_in = amount_in - fee
   [swap.rs:93-99]

4. CALCULATE OUTPUT (StableSwap)
   reserves = [reserve_a, reserve_b]
   i = 0 (input is token A), j = 1 (output is token B)
   dx = net_in (amount after fee)
   
   D = compute_d(reserves, a_current)           [Newton-Raphson, ~5 iterations]
   x_new = reserves[i] + dx
   y_new = compute_y(x_new, D, a_current)       [Newton-Raphson, ~8 iterations]
   dy = reserves[j] - y_new - 1                 [subtract 1 to round down]
   [math/mod.rs: StableSwap::get_dy()]

5. CHECK SLIPPAGE
   require!(dy >= min_amount_out)                [error.rs: slippage exceeded]

6. TRANSFER INPUT (CPI)
   CPI: Token::Transfer(user_source → vault_a, authority=user)
   [swap.rs:118 — signed by user]

7. TRANSFER OUTPUT (CPI)
   CPI: Token::Transfer(vault_b → user_dest, authority=pool_authority)
   [swap.rs:149 — signed by PoolAuthority PDA using seeds]

8. UPDATE RESERVES
   reserve_a += amount_in
   reserve_b -= dy
   [swap.rs:159-165]

9. ACCRUE FEES
   lp_fee = fee × 0.90                          [90% to LPs]
   protocol_fee = fee - lp_fee                   [10% to protocol]
   fee_growth_global_a += lp_fee × 2^64 / total_lp_shares
   protocol_fees_a += protocol_fee
   [swap.rs:168-189]

10. RECORD VOLATILITY BREADCRUMB
    Calculate price from new reserves
    Update last_swap_slot, last_swap_price_x64
    Update VolatilityState: tick, EWMA, 15-min bucket
    [swap.rs:192-206]
```

**Why round down in step 4?** `dy = reserves[j] - y_new - 1`. Subtracting 1 ensures the pool always gets slightly more than it gives. Without this, precision loss in Newton-Raphson could give the trader a free fraction of a token. Over millions of trades, that adds up.

**Why 90/10 fee split?** 90% goes to LPs (they provided the capital). 10% goes to protocol treasury (for development, insurance fund, etc.). This split is common in DeFi (Uniswap, Curve). V-AMM hardcodes it — no governance adjustment needed.

---

## Part F: How add_liquidity works

```
User calls: add_liquidity(amount_a=1000 USDC, amount_b=10 SOL)

1. TRANSFER TOKENS TO VAULTS (CPIs)
   Token::Transfer(user_a → vault_a, authority=user)
   Token::Transfer(user_b → vault_b, authority=user)

2. CALCULATE LP SHARES
   If total_lp_shares == 0 (first LP):
       shares = D(amount_a, amount_b, a_current)
       [first LP gets D as their shares — seeds the pool]

   If total_lp_shares > 0 (subsequent LP):
       D_old = D(reserves_before, a_current)
       D_new = D(reserves_before + deposits, a_current)
       shares = (D_new - D_old) × total_lp_shares / D_old
       [proportional to how much the pool's economic size grew]

3. MINT LP TOKENS
   Token::MintTo(lp_mint → user_lp, amount=shares, authority=pool_authority PDA)

4. UPDATE POOL STATE
   reserve_a += amount_a
   reserve_b += amount_b
   total_lp_shares += shares

5. CREATE OR UPDATE POSITION
   If new position:
       owner = user, pool = pool_state, shares = calculated_shares
       fee_growth_inside_a_last = fee_growth_global_a  [snapshot]
       fee_growth_inside_b_last = fee_growth_global_b

   If existing position:
       First, collect pending fees (using fee_growth diffs)
       Then add new shares, update snapshots
```

**Why D-based LP shares and not proportional to reserves?** In a StableSwap pool, the "economic size" of a deposit isn't simply `amount_a + amount_b`. The D invariant accounts for the curve shape. Two deposits of (1000, 10) at A=1000 vs A=1 have different economic contributions. D captures this correctly.

**Why snapshot fee_growth at deposit time?** So the LP only earns fees from swaps that happen AFTER their deposit. Without the snapshot, they'd claim fees from before they joined — stealing from existing LPs.

---

## Part G: How remove_liquidity works

```
User calls: remove_liquidity(shares=500)

1. VALIDATE
   require!(shares > 0)
   require!(position.shares >= shares)

2. COLLECT UNCOLLECTED FEES
   fees_a = (fee_growth_global_a - position.fee_growth_inside_a_last) × position_shares / 2^64
   position.uncollected_fees_a += fees_a
   (same for token B)

3. CALCULATE WITHDRAWAL
   ratio = shares / total_lp_shares
   amount_a = reserve_a × ratio
   amount_b = reserve_b × ratio

4. BURN LP TOKENS
   Token::Burn(lp_mint ← user_lp, amount=shares, authority=user)

5. TRANSFER TOKENS BACK (CPIs)
   Token::Transfer(vault_a → user_a, amount=amount_a, authority=pool_authority PDA)
   Token::Transfer(vault_b → user_b, amount=amount_b, authority=pool_authority PDA)

6. UPDATE STATE
   reserve_a -= amount_a
   reserve_b -= amount_b
   total_lp_shares -= shares
   position.shares -= shares
   position.fee_growth_inside_a_last = fee_growth_global_a
```

**Why proportional withdrawal and not D-based?** On deposit, we use D to calculate fair shares. On withdrawal, shares/total_lp gives the correct proportion because the shares were correctly calculated on entry. Using D on exit would double-count the curve shape.

---

## Part H: The full AMM account map

```
PoolState ────────────── references ──► VolatilityState
    │                                      (EWMA, ring buffers)
    │
    ├── references ──► VaultA (token account, holds reserve A)
    │                   authority: PoolAuthority
    │
    ├── references ──► VaultB (token account, holds reserve B)
    │                   authority: PoolAuthority
    │
    ├── references ──► LpMint (mint for LP tokens)
    │                   authority: PoolAuthority
    │
    ├── references ──► PoolAuthority (signer PDA)
    │
    └── each LP has ──► PositionState (their personal position)
                        seeds: ["position", pool, user, nonce]
```

Every instruction reads PoolState first. Every token movement goes through PoolAuthority. Every LP action touches PositionState. The architecture is: one hub account (PoolState), many satellite accounts (positions, vaults), one signer (PoolAuthority).

---

[← Prev — Step 3 Building a Vault](03-build-vault.md) · [Next → Step 5 — From AMM to V-AMM](05-build-vamm.md)
