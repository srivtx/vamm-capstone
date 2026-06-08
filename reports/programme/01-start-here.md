# 01 — I want to build on Solana. Where do I start?

You want to build a program that runs on Solana. Before you write a single line of AMM logic, you need to understand what a Solana program actually is and how data works here.

## What is a Solana program?

A program is just compiled code deployed to the blockchain. Users send transactions to it. The program reads the transaction, does some work, and either succeeds (updating on-chain state) or fails (reverting everything).

Programs themselves don't store data. All data lives in **accounts**. A program can read any account and write to accounts it owns.

## What is an account?

An account is a fixed-size chunk of bytes with an address. Every account has:

- **address** (a public key — like a file path)
- **data** (raw bytes, up to 10MB per account)
- **owner** (which program controls it)
- **lamports** (SOL balance — accounts cost rent to exist)

Think of it like this: the Solana blockchain is a giant key-value store. Keys are addresses. Values are byte arrays. Programs can read and write these byte arrays.

## What is a PDA?

A PDA (Program Derived Address) is an account whose address is computed from a formula rather than being a random keypair.

```
PDA address = hash(seeds, program_id, bump)
```

Why PDAs matter:
- **You can find them.** Given the seeds, you can always compute the address. No need to store it somewhere else.
- **Only the program can sign for them.** No private key exists. A PDA can "sign" a transaction only if the program that created it produces the signature in code.

This is the key insight for Solana development: **PDAs let programs own things.** A program can have a PDA own token accounts, state accounts, whatever — and nobody can touch those accounts except through the program.

## What is Anchor?

Anchor is a Rust framework that handles the boilerplate:

```rust
#[derive(Accounts)]
pub struct MyInstruction<'info> {
    #[account(mut)]
    pub user: Signer<'info>,           // who signed the transaction

    #[account(
        init,                           // create this account
        payer = user,                   // user pays the rent
        space = 8 + 32,                 // account size in bytes
        seeds = [b"my_pda", user.key().as_ref()],
        bump
    )]
    pub my_account: Account<'info, MyData>,  // the PDA being created

    pub system_program: Program<'info, System>,  // needed to create accounts
}
```

Without Anchor, you'd manually:
- Deserialize every account from raw bytes
- Check every account's owner, signer status, and seeds
- Handle rent exemption manually
- Serialize results back to bytes

Anchor generates all that code at compile time. You focus on the logic.

## The pattern every Solana program follows

```
1. User sends a transaction with:
   - The program ID to call
   - The instruction data (which function, what arguments)
   - A list of accounts the instruction needs

2. Anchor validates:
   - Are the right accounts passed in?
   - Do PDAs have the correct seeds?
   - Is the signer who they claim to be?
   - Do token accounts have the right mints and authorities?

3. Your handler runs:
   - Read account data
   - Do the business logic
   - Write updated data back to accounts
   - Possibly call other programs (CPI)

4. Either everything succeeds, or everything reverts.
   Solana transactions are atomic — all or nothing.
```

## What we're building toward

We want an AMM. An AMM needs:
- A place to store pool state (reserves, fees, curve parameters) → PoolState PDA
- A place to store user positions (LP shares, fee snapshots) → PositionState PDA
- Token accounts to hold the actual tokens → VaultA and VaultB PDAs
- An authority that can sign token transfers → PoolAuthority PDA
- Logic for swaps, deposits, withdrawals → instructions

But before we build all that, let's start with the simplest Solana pattern: an escrow.

---

[Next → 02 — Let's Build an Escrow](02-escrow.md)
