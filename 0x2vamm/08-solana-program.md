# 08 — On Solana

> *How the math becomes a program that runs on a blockchain.*

---

## What's a Solana program?

A Solana "program" is just code that lives on the blockchain. It's deployed once and runs when someone sends a transaction to it. Think of it like a smart contract, but on Solana.

Our V-AMM is one program, deployed at this address:

```
75yCYNeZrSoVKWk5kFti7tRpRacZHptmAqtPwfc9U4Zt
```

It's written in Rust using a framework called **Anchor**, which handles the boring parts (account validation, serialization, error handling) so we can focus on the actual logic.

## What the program can do: 6 instructions

An "instruction" is one thing you can ask the program to do. V-AMM has six:

```
initialize_pool     Create a new pool for a token pair.
                    Sets up all the storage accounts, LP mint, vaults.
                    Anyone can call this (they pay the rent for creating accounts).

swap                Trade one token for another.
                    The core action. Calculates output using StableSwap,
                    deducts a dynamic fee, updates volatility tracking.

add_liquidity       Deposit a pair of tokens into the pool.
                    You get LP tokens back, representing your share.
                    Uses the D-invariant to calculate fair shares.

remove_liquidity    Withdraw your share from the pool.
                    Burns your LP tokens, gives you back the proportional
                    amount of both underlying tokens.

update_volatility   Recalculate A and fee from the EWMA.
                    Anyone can call this. No admin key needed.
                    Called a "crank" — a maintenance operation.

update_curve        Progress the A ramp one step.
                    Reads the current slot, interpolates A between
                    start and target. Also permissionless.
```

The last two are **permissionless** — anyone can call them. There's no special admin key. The pool maintains itself through anyone willing to send the update transaction. In practice, bots (called "keepers" or "crankers") do this automatically.

## How accounts work (PDAs)

On Solana, all data lives in "accounts." Each account has an address (like a file path) and stores some bytes. Programs can read and write accounts they own.

A **PDA** (Program Derived Address) is a special kind of account whose address is mathematically derived from seeds — it's not a random keypair, it's computed from other data. This means:

- You can always find the account given the seeds (no need to store its address separately)
- Only the program that derived it can sign for it (no private key exists)

V-AMM uses 7 types of PDAs:

```
PoolState        derived from: ["pool", mint_a, mint_b, pool_id]
                 stores: reserves, A values, fee data, cross-references

VolatilityState  derived from: ["volatility", pool_state_address]
                 stores: EWMA variance, tick history, time buckets

PoolAuthority    derived from: ["authority", pool_state_address]
                 this PDA acts as the "owner" of all vault accounts
                 the program can sign transactions as this PDA

LpMint           derived from: ["lp_mint", pool_state_address]
                 the mint for LP tokens (what LPs receive)

VaultA           derived from: ["vault_a", pool_state_address]
                 token account holding token A reserves

VaultB           derived from: ["vault_b", pool_state_address]
                 token account holding token B reserves

Position         derived from: ["position", pool, user, nonce]
                 tracks an individual LP's share, fee snapshots
```

Every PDA traces back to `pool_state`, which traces back to the token mint pair and pool ID. Given a token pair, you can find every account in the pool.

## Who can move tokens?

Token transfers on Solana need a signer — someone who authorizes the move. In V-AMM:

- **User signs** for their own tokens: depositing into the pool, sending input for a swap, burning their LP tokens
- **Pool Authority PDA signs** for the pool's tokens: withdrawing from vaults, minting new LP tokens

The Pool Authority is a PDA that only the program can sign for. There's no admin key that could drain the vaults. The program itself controls the pool's money, following the rules in the code.

## What happens during a swap (the full picture)

```
1. User sends a transaction: swap(amount=10 USDC, min_out=0.09 SOL, direction=A→B)

2. Anchor validates the accounts:
   - PoolState exists and has the right seeds
   - VolatilityState matches the pool
   - User's token accounts have the right mints
   - Token vaults are the correct PDAs

3. Program reads current state:
   - reserves = [100 USDC, 1 SOL]
   - A_current = interpolated_from_ramp(current_slot)
   - fee_bps = current_fee_bps (dynamic, from volatility)

4. Calculate:
   - fee = 10 * 5 / 10000 = 0.005 USDC (at 5 bps)
   - net_in = 10 - 0.005 = 9.995 USDC
   - output = StableSwap::get_dy(reserves, A→B, 9.995, A_current)
   - Check: output >= min_out (0.09 SOL)?
   - If yes, proceed. If no, return SlippageExceeded error.

5. Execute transfers (CPIs to SPL Token program):
   - Transfer 10 USDC from user to VaultA (signed by user)
   - Transfer output SOL from VaultB to user (signed by PoolAuthority PDA)

6. Update state:
   - reserves: add 10 USDC, subtract output SOL
   - fee_growth: accrue 90% of fee to LP pool, 10% to protocol
   - last_swap_slot = current slot
   - last_swap_price = new price

7. Update volatility:
   - Compute tick from new price
   - r² = (tick - last_tick)² × constant
   - variance = 0.95 × old + 0.05 × r²
   - Record in 15-min bucket

8. Done. Transaction succeeds.
```

## Cross-Program Invocation (CPI)

When V-AMM needs to transfer tokens, it doesn't do the transfer itself — it asks the SPL Token Program (a separate program on Solana that all tokens use). This is called a CPI — the program calls another program.

```
V-AMM → SPL Token Program: "Please transfer 10 USDC from account X to account Y"
                            (provides the needed signatures)

V-AMM → SPL Token Program: "Please mint 5 LP tokens to account Z"
                            (signs as PoolAuthority PDA)
```

By using the standard SPL Token program, V-AMM tokens are regular Solana tokens — they work with any wallet, any DEX, any tooling.

## Where the code lives

```
vamm/
├── Anchor.toml                         Solana cluster config, program ID
├── programs/vamm/
│   ├── Cargo.toml                      Rust dependencies (Anchor 1.0.1, SPL Token)
│   └── src/
│       ├── lib.rs                      Entry point: routes instructions to handlers
│       ├── state.rs                    Data structures: PoolState, VolatilityState, etc.
│       ├── math/mod.rs                 StableSwap math (Newton solver) + volatility engine
│       ├── error.rs                    Error codes: MathOverflow, SlippageExceeded, etc.
│       ├── constants.rs                Seed constants
│       └── instructions/
│           ├── mod.rs                  Re-exports
│           ├── initialize_pool.rs      Pool setup, PDA creation
│           ├── swap.rs                 Core trade logic
│           ├── add_liquidity.rs        Deposit + LP minting
│           ├── remove_liquidity.rs     Withdrawal + LP burning
│           ├── update_volatility.rs    Permissionless EWMA crank
│           └── update_curve.rs         Permissionless A ramp sync
```

Everything is one crate (~500 lines of math, ~600 lines of instruction logic). No external dependencies beyond Anchor and SPL Token.

## Further reading

- [`ARCHITECTURE.md`](../ARCHITECTURE.md) — full diagram set (program structure, PDAs, CPIs, error paths)
- [`reports/`](../reports/) — deep dives: StableSwap derivation, volatility engine design, dynamic fee economics, adversarial analysis
- [`README.md`](../README.md) — project overview, install instructions

---

[← Prev — 07 Moving Parts Together](07-moving-parts-together.md)
