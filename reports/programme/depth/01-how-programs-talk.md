# Step 1: How Programs Talk on Solana

Every DeFi app is programs talking to programs. Before you build an AMM, you need to understand who calls who, who signs what, and why.

---

## Part A: A user calls your program

This is the simplest flow. A human with a wallet sends a transaction to your program.

```
User (wallet)  ───transaction───►  Your Program
                 signs with          does work
                 private key         returns success/failure
```

The user provides:
- **Which program** to call (your program's ID)
- **Which instruction** to run (e.g., "swap", "deposit")
- **Arguments** (e.g., amount_in = 100)
- **Accounts** the instruction needs to read or write

**Why accounts are passed in, not looked up:** Solana doesn't let programs fetch arbitrary accounts. The caller must specify every account the instruction touches. This is by design — it makes the cost predictable and prevents programs from reading data they shouldn't.

**How this works in code (`lib.rs:50`):**

```rust
pub fn swap(ctx: Context<Swap>, amount_in: u64, min_amount_out: u64, is_a_to_b: bool) -> Result<()> {
    // ctx.accounts contains all the accounts the user passed in
    // Anchor validated they exist, have right seeds, right owners
    instructions::swap::handler(ctx, amount_in, min_amount_out, is_a_to_b)
}
```

The user sent `amount_in`, `min_amount_out`, `is_a_to_b` as instruction data. The accounts (pool state, vaults, user token accounts) were passed in the transaction's account list.

---

## Part B: Your program calls another program (CPI)

CPI = Cross-Program Invocation. Your program is running, and it needs the SPL Token program to transfer tokens.

```
User  ──►  Your Program  ──CPI──►  SPL Token Program
              (running)               performs the transfer
                                       returns to your program
```

**Why CPI exists:** Programs on Solana are specialized. The SPL Token program knows how to transfer tokens. Your AMM program knows how to calculate swap outputs. Your program shouldn't reimplement token transfers — it should delegate.

**How a CPI works in code (`swap.rs:118`):**

```rust
// Your program asks SPL Token to move money
let cpi_accounts = Transfer {
    from: ctx.accounts.user_source.to_account_info(),  // user's USDC account
    to: ctx.accounts.token_vault_a.to_account_info(),  // pool's USDC vault
    authority: ctx.accounts.user.to_account_info(),    // who authorizes this
};

token::transfer(
    CpiContext::new(ctx.accounts.token_program.key(), cpi_accounts),
    amount_in,   // how much to transfer
)?;             // if SPL Token fails, your whole transaction fails
```

**Why the `?` matters:** If the CPI fails (e.g., user doesn't have enough tokens), your entire transaction reverts. Everything is atomic — no partial state, no stuck tokens. This is crucial for financial applications.

---

## Part C: Two signing patterns

Every CPI transfer needs a signer — someone who authorizes the move. There are only two patterns in all of Solana DeFi.

**Pattern 1: The user is present (user signs)**

```
User deposits USDC into the pool vault

CPI: transfer(user_usdc_account → vault_a, authority=user)
                                                      ↑
                                        user signed the transaction,
                                        so they can authorize this
```

The user's wallet signed the original transaction. That signature propagates to any CPI where the user is the authority. Simple.

**Pattern 2: The user is gone (PDA signs)**

```
Pool sends SOL to a trader who just swapped

CPI: transfer(vault_b → trader_sol_account, authority=pool_authority_pda)
                                                      ↑
                                        no human signed this —
                                        the program proves it controls
                                        the PDA using seeds
```

The pool authority is a PDA. No private key exists. The program "signs" by providing the PDA's derivation seeds in the CPI context:

```rust
// swap.rs:133 — the program signs as the pool authority
let seeds = &[
    b"authority",
    pool_state.to_account_info().key.as_ref(),
    &[ctx.bumps.pool_authority],
];
let signer = &[&seeds[..]];

token::transfer(
    CpiContext::new_with_signer(
        ctx.accounts.token_program.key(),
        cpi_accounts_out,
        signer,   // ← the PDA's "signature"
    ),
    amount_out,
)?;
```

**Why two patterns exist:** If the user could sign for vault withdrawals, anyone could drain the pool. If the PDA had to sign for deposits, users couldn't deposit their own tokens. Two patterns = two trust models.

---

## Part D: When multiple programs are involved (the full stack)

A single swap touches three programs:

```
User ──► V-AMM Program
            │
            ├──CPI──► SPL Token Program (transfer input tokens)
            │            authority: user
            │
            ├── (your AMM math runs here)
            │
            ├──CPI──► SPL Token Program (transfer output tokens)
            │            authority: pool_authority PDA
            │
            └── (write to PoolState, VolatilityState)
```

And add_liquidity touches four:

```
User ──► V-AMM Program
            │
            ├──CPI──► SPL Token (transfer token A to VaultA) authority: user
            ├──CPI──► SPL Token (transfer token B to VaultB) authority: user
            ├──CPI──► SPL Token (mint LP tokens to user)     authority: pool_authority PDA
            │
            └──CPI──► Associated Token Program (create LP token account if needed)
                         authority: user
```

**Why this matters for building:** Before you write any AMM math, you need to map out every CPI. Who signs what? Which programs are involved? What happens if any CPI fails? If you can't answer these questions, your program will have security holes.

---

## Part E: State changes vs CPIs (what happens when)

A common confusion: does CPI change state in YOUR program? No.

```
Your program's state (PoolState, VolState, PositionState):
  ── Changed by YOUR program's code directly
  ── NOT changed by CPIs

SPL Token state (token balances):
  ── Changed by CPI to SPL Token program
  ── Your program cannot modify token balances directly

System state (account creation, SOL transfers):
  ── Changed by CPI to System Program
```

**Why this separation exists:** Each account has exactly one owner program. Only the owner can modify an account's data. Your program owns PoolState — it can write to it. SPL Token owns token accounts — only it can modify balances. The CPI is your program *asking* SPL Token to do the modification.

---

## What we just learned

1. Users call programs with transactions containing accounts + instruction data
2. Your program calls other programs via CPI — delegation, not reimplementation
3. User signs for their own token movements; PDAs sign for protocol token movements
4. CPIs are atomic — if any fails, the whole transaction reverts
5. Your program owns its state accounts; SPL Token owns token accounts; CPIs bridge the gap

Now we can build things. Start with the simplest program: an escrow.

---

[Next → Step 2 — Building an Escrow](02-build-escrow.md)
