# 04 — How CPIs Work

CPI (Cross-Program Invocation) is how Solana programs call each other. Your AMM doesn't implement token transfers — it asks the SPL Token program to do it.

## What is a CPI?

```
Program A calls Program B, passing:
- The program ID of B
- A list of accounts B needs
- Instruction data for B

Program B executes as if called directly
If B fails, A's transaction also fails (atomic)
```

Think of it like a function call, but between programs instead of within a program.

## Why CPIs matter

Without CPIs, every program would need to reimplement:
- Token transfers
- Token minting and burning
- Account creation
- Associated token account management

Instead, there are standard programs on Solana:
- **SPL Token Program**: all token operations
- **Associated Token Program**: creates user token accounts deterministically
- **System Program**: creates accounts, transfers SOL

Every DeFi program delegates to these. Your AMM never touches raw token balances — it asks the SPL Token program to do it.

## The two CPI patterns in V-AMM

**Pattern 1: User signs**

```
User wants to deposit USDC into VaultA

Instruction: add_liquidity(amount_a, amount_b)

CPI: Token::Transfer {
    from: user's USDC account,
    to: VaultA,
    authority: user (signer)
}

// User signed the transaction, so they can authorize this transfer
```

The user is present. They signed the transaction. The CPI uses their signature.

**Pattern 2: PDA signs**

```
Pool needs to send SOL from VaultB to a user who just swapped

Instruction: swap(amount_in, min_out, direction)

CPI: Token::Transfer {
    from: VaultB,
    to: user's SOL account,
    authority: PoolAuthority PDA
}

// PoolAuthority is a PDA. The program "signs" by providing the PDA seeds:
seeds = [b"authority", pool_state.key().as_ref(), &[bump]]
```

The program computes the PDA seeds, proves it controls the PDA, and the runtime allows the transfer. No human signed — the code authorized it.

## What a swap CPI sequence looks like

Every swap involves exactly two CPIs:

```
1. Transfer input from user to vault (signed by user)
   CPI: Token::Transfer(user_token → vault, authority=user)

2. Transfer output from vault to user (signed by PDA)
   CPI: Token::Transfer(vault → user_token, authority=pool_authority_pda)
```

That's it. Two CPIs. The AMM math (StableSwap, fee calculation, volatility update) happens in between, but the token movement is just these two calls.

## What add_liquidity CPIs look like

```
1. Transfer token A from user to VaultA (signed by user)
2. Transfer token B from user to VaultB (signed by user)
3. Mint LP tokens to user (signed by PDA)
   CPI: Token::MintTo(lp_mint → user_lp_account, authority=pool_authority_pda)
```

Three CPIs. Two signed by user, one by PDA.

## CPI constraints

- **Atomic**: if any CPI fails, the entire transaction reverts. No partial transfers.
- **Nested**: a program called via CPI can also make CPIs (up to 4 levels deep).
- **Account passing**: the caller must pass every account the called program needs.
- **Signer seeds**: PDAs sign by providing their derivation seeds in the CPI context.

## Why you need to understand CPIs before building an AMM

The entire AMM is CPIs + math. The math (StableSwap, volatility) runs in your program. The token movement runs through the SPL Token program via CPIs. If you don't understand the two signing patterns (user signs vs PDA signs), you can't build secure token flows.

---

[← Prev — 03 Vaults](03-vaults.md) · [Next → 05 — Building an AMM](05-building-an-amm.md)
