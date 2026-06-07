# How Solana Works (for V-AMM)

A quick primer on the Solana concepts that V-AMM relies on.

## Programs

A **program** is code deployed to the Solana blockchain. It runs when someone sends a transaction to it. Think of it like a smart contract. V-AMM is one program.

Programs are stateless — they don't store data themselves. All data lives in **accounts**.

## Accounts

Every piece of data on Solana is an account. An account has:
- An **address** (like a file path)
- Some **data** (raw bytes)
- An **owner** (which program can modify it)
- A **balance** (SOL for rent — accounts cost money to store)

V-AMM uses several account types:
- **Token accounts** hold actual token balances (USDC, SOL, LP tokens)
- **State accounts** hold the pool's data (reserves, A value, fee, volatility)

## PDAs (Program Derived Addresses)

A PDA is an account whose address is computed from a formula (called "seeds") rather than being a random keypair.

Why PDAs matter:
- **Deterministic**: given the same seeds, you always get the same address. You can find the account without storing its address.
- **Program-controlled**: only the program that derived the PDA can "sign" for it. No private key exists to steal.

V-AMM example:
```
PoolState address = derive(["pool", usdc_mint, sol_mint, pool_id])
PoolAuthority address = derive(["authority", pool_state_address])
```

The PoolAuthority PDA signs token transfers out of the vault. No admin key exists — the program's code controls when transfers happen.

## CPIs (Cross-Program Invocations)

Programs can call other programs. V-AMM doesn't implement token transfers itself — it calls the SPL Token Program (Solana's standard token program):

```
V-AMM → SPL Token: "transfer 10 USDC from user to vault"
V-AMM → SPL Token: "mint 5 LP tokens to user"
```

## Anchor

Anchor is a Rust framework that simplifies Solana program development. It handles:
- Account validation (checking PDAs have the right seeds, signers are correct)
- Serialization (converting Rust structs to/from account bytes)
- Error handling
- Instruction routing

V-AMM is written with Anchor. The actual AMM logic is ~500 lines of math, ~600 lines of instructions.

## Rent

Solana charges **rent** for account storage. Accounts must hold enough SOL to cover the storage cost. If an account runs out of rent, the runtime deletes it. V-AMM's PDA accounts are funded during initialization.

## Compute Units (CU)

Every transaction has a compute budget. Solana gives 200,000 CU per transaction by default. Each operation (addition, multiplication, account read/write) costs some CU. The Newton-Raphson solver is capped at 64 iterations to stay within budget.
