# 03 — Why Vaults

An escrow holds tokens for one deal. A vault holds tokens for an entire protocol. Same PDA pattern, different scale.

## What is a vault?

A vault is a token account owned by a program's PDA. Users deposit tokens into it. The program decides when and how tokens leave. Nobody — not even the program's deployer — can withdraw tokens except through the program's instructions.

```
User deposits → Vault (PDA owned, program controls withdrawals)
User withdraws ← Vault (only through program logic)
```

## Why vaults exist

Without vaults, every DeFi protocol would need users to send tokens directly to each other. That doesn't work:
- Swaps need a pool of both tokens sitting ready
- Lending needs collateral sitting locked while loans are outstanding
- Staking needs tokens locked to prove commitment

Vaults solve custody. The protocol holds tokens on behalf of users, and the program's code (not a human) decides when to release them.

## How a vault works on Solana

```
1. Initialize:
   Create a token account (SPL Token standard)
   Set its authority to a PDA: ["vault", pool_pubkey]
   The PDA's seeds are known only to the program
   Nobody has a private key for this PDA

2. Deposit:
   User calls: deposit(amount)
   CPI to SPL Token: transfer from user to vault
   Signed by: user (they own their tokens)

3. Withdraw:
   User calls: withdraw(amount)
   CPI to SPL Token: transfer from vault to user
   Signed by: vault PDA (the program signs with PDA seeds)
   The program checks: does the user actually have a right to these tokens?
```

## The authority PDA pattern

This is the most important pattern in Solana DeFi:

```
PoolAuthority PDA = derive(["authority", pool_state_address])

This PDA:
- Owns VaultA (token account holding token A reserves)
- Owns VaultB (token account holding token B reserves)
- Owns LpMint (the mint for LP tokens)
- Can sign transfers out of any of these accounts
- Has NO private key — only the program can produce its signature
```

Every time someone swaps and receives tokens, the PoolAuthority PDA "signs" the transfer. Every time someone adds liquidity and receives LP tokens, the PoolAuthority PDA "signs" the mint. No admin key. No multisig. No human. Just the program's code.

## Vaults in V-AMM

V-AMM uses two vaults — one for each token in the pair:

```
VaultA: holds all USDC reserves
VaultB: holds all SOL reserves

Both owned by: PoolAuthority PDA
Both derived from: pool_state address
```

When you swap USDC for SOL:
- Your USDC goes INTO VaultA (you sign this transfer)
- SOL comes OUT OF VaultB (the PoolAuthority PDA signs this transfer)

When you add liquidity:
- Your USDC goes INTO VaultA (you sign)
- Your SOL goes INTO VaultB (you sign)
- LP tokens are MINTED to you (PoolAuthority PDA signs)

The vaults are just token accounts. The magic is who controls them.

## What you need to understand before building an AMM

1. PDAs let programs own things
2. Token accounts hold tokens
3. CPIs let programs call the SPL Token program to move tokens
4. An authority PDA can sign transfers on behalf of vaults
5. User signs for deposits, PDA signs for withdrawals

These five concepts are the foundation of every Solana DeFi protocol. The AMM is just logic layered on top of vaults.

---

[← Prev — 02 Escrow](02-escrow.md) · [Next → 04 — How CPIs Work](04-cpi.md)
