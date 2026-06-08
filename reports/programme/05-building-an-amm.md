# 05 — Building an AMM

Now we have all the pieces: PDAs for state, vaults for tokens, CPIs for transfers. Let's assemble them into an AMM.

## The pieces we need

An AMM needs six things:

1. **A pool state account** — stores reserves, fees, curve parameters
2. **Two vault token accounts** — hold the actual tokens people trade
3. **An LP mint** — creates tokens representing LP shares
4. **A position account per LP** — tracks each LP's share and uncollected fees
5. **A pool authority PDA** — signs token transfers out of vaults
6. **Instructions** — swap, add liquidity, remove liquidity, initialize

## What the pool state stores

```
PoolState {
    token_mint_a: Pubkey,        // which token is A (e.g., USDC mint address)
    token_mint_b: Pubkey,        // which token is B (e.g., SOL mint address)

    reserve_a: u128,             // how much token A is in the pool
    reserve_b: u128,             // how much token B is in the pool
    total_lp_shares: u128,       // how many LP tokens exist in total

    curve_a_current: u64,        // current amplification A (changes over time)
    curve_a_target: u64,         // target A (where the ramp is headed)
    curve_a_start: u64,          // A value when ramp started
    curve_ramp_start_slot: u64,  // when the ramp began
    curve_ramp_end_slot: u64,    // when the ramp should complete

    current_fee_bps: u16,        // current swap fee in basis points
    base_fee_bps: u16,           // minimum fee
    fee_ema: u128,               // EMA-smoothed fee for rate limiting

    fee_growth_global_a: u128,   // cumulative fee per LP share (token A)
    fee_growth_global_b: u128,   // cumulative fee per LP share (token B)

    last_swap_slot: u64,         // when the last swap happened
    last_swap_price_x64: u128,   // what the price was after last swap

    volatility_state: Pubkey,    // points to the VolatilityState PDA
    // ... more fields for bump, pool_id, status
}
```

## How an LP position works

When you add liquidity, you receive LP tokens. But those tokens alone don't tell you how much in fees you've earned. The pool uses a clever accounting trick:

```
PoolState stores:
  fee_growth_global_a   — "total fees earned per LP share" for token A
                          Updated every swap: += fee_amount / total_lp_shares

PositionState stores:
  fee_growth_inside_a_last  — snapshot of fee_growth_global_a when LP deposited
  uncollected_fees_a        — fees the LP can claim

When LP withdraws:
  new_fees = (fee_growth_global_a - fee_growth_inside_a_last) × position_shares
  uncollected_fees_a += new_fees
  fee_growth_inside_a_last = fee_growth_global_a  (reset snapshot)

This means LPs earn fees automatically — they accumulate in the math,
not in separate transactions. The LP just withdraws and gets everything
they're owed.
```

## How a swap works (the math side)

```
1. Read current state:
   reserve_a, reserve_b, curve_a_current, current_fee_bps

2. Interpolate A if a ramp is active:
   a_current = interpolate(a_start, a_target, current_slot, ramp_start, ramp_end)

3. Calculate fee:
   fee = amount_in * current_fee_bps / 10000
   amount_after_fee = amount_in - fee

4. Calculate output using StableSwap:
   dy = StableSwap::get_dy([reserve_a, reserve_b], input_token_index,
                            output_token_index, amount_after_fee, a_current)
   This runs Newton-Raphson to solve the invariant for the new reserve values.

5. Check slippage:
   require!(dy >= min_amount_out)

6. Execute CPIs (transfer input to vault, transfer output from vault)

7. Update state:
   reserves = new reserves
   fee_growth_global += lp_share_of_fee / total_lp_shares
   protocol_fees += protocol_share_of_fee
```

## How add_liquidity works

```
1. Transfer user tokens to vaults (CPIs)

2. Calculate LP shares:
   If first LP ever (total_lp_shares == 0):
       shares = D(amount_a, amount_b, A_current)
       // D is the StableSwap invariant — the "economic size" of the deposit

   If not first LP:
       D_old = D(reserves, A_current)
       D_new = D(reserves + deposits, A_current)
       shares = (D_new - D_old) / D_old * total_lp_shares
       // Proportional to how much the pool grew

3. Mint LP tokens to user (CPI)

4. Update pool state:
   reserves += deposited amounts
   total_lp_shares += shares

5. Create or update position:
   If new position: set owner, pool, snapshot fee_growth
   Add shares to position
```

## How remove_liquidity works

```
1. Calculate withdrawal amounts:
   share_ratio = shares_to_burn / total_lp_shares
   amount_a = reserve_a * share_ratio
   amount_b = reserve_b * share_ratio

2. Burn LP tokens from user (CPI)

3. Transfer tokens from vaults to user (CPIs, signed by PDA)

4. Update pool state:
   reserves -= withdrawal amounts
   total_lp_shares -= shares_burned
   position.shares -= shares_burned
```

## The full picture

```
            ┌─────────────┐
            │   User      │
            └──┬──┬───┬───┘
               │  │   │
       deposit │  │   │ withdraw
         swap  │  │   │
               ▼  ▼   ▼
        ┌──────────────────┐
        │   vamm program   │
        │                  │
        │  init_pool()     │
        │  swap() ◄─ math  │──► StableSwap (D solver)
        │  add_liquidity() │──► VolatilityMath (EWMA)
        │  remove_liquidity│
        │  update_vol()    │
        │  update_curve()  │
        └──┬───────┬───────┘
           │       │
       CPIs│       │reads/writes
           ▼       ▼
    ┌──────────┐  ┌──────────────┐
    │SPL Token │  │State Accounts│
    │Program   │  │PoolState     │
    │          │  │VolState      │
    │transfer()│  │PositionState  │
    │mint_to() │  └──────────────┘
    │burn()    │
    └──────────┘
```

This is a standard AMM. Everything we've built so far — vaults, CPIs, PDAs, swap math, LP shares — is what Uniswap, Curve, and every other AMM does.

The difference is: all of those have fixed fees and fixed curve shapes. They never change after launch. V-AMM adds one more piece: a volatility engine that watches the market and adjusts the pool automatically. That's next.

---

[← Prev — 04 CPIs](04-cpi.md) · [Next → 06 — Adding the Brain](06-vamm.md)
