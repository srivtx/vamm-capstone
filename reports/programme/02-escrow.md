# 02 — Let's Build an Escrow

The simplest Solana program that does something useful. An escrow locks tokens until a condition is met.

## What is an escrow?

Alice wants to buy something from Bob. She doesn't trust Bob to send the item after she pays. Bob doesn't trust Alice to pay after he sends the item.

Solution: Alice puts the money in an **escrow account**. The money sits there, locked. Neither Alice nor Bob can touch it. Once Bob confirms he sent the item, the escrow releases the money to Bob. If something goes wrong, Alice can cancel and get her money back.

On Solana, we implement this with PDAs. No trusted third party — the program IS the escrow agent.

## The accounts we need

```
Alice (signer)          — the person depositing funds
Alice's token account   — where the tokens come from
Escrow PDA              — a temporary holding account for the tokens
Escrow state PDA        — stores who the parties are, how much, what state
Bob's wallet            — who gets paid (just a pubkey stored in state)
Token program           — the SPL Token program (for transfers)
System program          — for creating accounts
```

## What happens step by step

**Initialize escrow:**

```
Alice calls: initialize_escrow(amount: 100, recipient: Bob)

1. Create an escrow state PDA:
   seeds = ["escrow", alice_pubkey, bob_pubkey]
   Store: { maker: Alice, taker: Bob, amount: 100, bump: X }

2. The escrow PDA now exists on-chain with:
   - Alice as the maker
   - Bob as the taker
   - 100 as the amount
```

**Deposit tokens:**

```
Alice calls: deposit()

1. Transfer 100 tokens from Alice's account to the escrow token account
2. The escrow token account is owned by the program's authority PDA
3. Neither Alice nor Bob can withdraw — only the program can sign for it

State after deposit:
  Escrow state: { maker: Alice, taker: Bob, amount: 100, status: "funded" }
  Escrow token account: 100 tokens
```

**Release to Bob:**

```
Anyone calls: release()

1. Check: is the escrow in "funded" state?
2. Transfer 100 tokens from escrow to Bob
3. Close the escrow state PDA (refund rent to Alice)

State after release:
  Escrow state: DELETED (account closed)
  Bob's token account: +100 tokens
```

**Cancel (Alice changes her mind):**

```
Alice calls: cancel()

1. Check: caller is Alice (the maker)?
2. Check: escrow is still in "funded" state?
3. Transfer 100 tokens back to Alice from escrow
4. Close the escrow state PDA

State after cancel:
  Escrow state: DELETED
  Alice's token account: 100 tokens returned
```

## Why escrow matters for understanding AMMs

An escrow teaches you:

**PDAs as program-controlled accounts.** The escrow PDA holds tokens. Only the program can release them. Nobody has a private key for it.

**Atomic operations.** Deposit, release, cancel — each is one transaction. Either everything succeeds or nothing changes. No partial state.

**Account lifecycle.** Accounts are created (init), used (deposit/release), and closed (refund rent). AMM pools follow the same pattern — initialized once, used many times, closed on final withdrawal.

**Signer patterns.** Alice signs to deposit her tokens. The program's PDA signs to release from escrow. Two different signers, two different trust models.

## From escrow to vault

An escrow holds tokens temporarily for a specific deal between two people. A **vault** holds tokens permanently for a protocol. Same PDA pattern, different use case:
- Escrow: temporary, 1-to-1, released on condition
- Vault: permanent, many-to-many, tokens move in and out via protocol rules

An AMM is built on vaults. But first we need to understand vaults.

---

[← Prev — 01 Start Here](01-start-here.md) · [Next → 03 — Why Vaults](03-vaults.md)
