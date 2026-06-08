# What is Commit-Reveal?

**Commit-reveal** is a two-step process that prevents front-running by hiding transaction details until it's too late to exploit them.

## The problem it solves

```
1. Alice sends a transaction: "buy 10,000 SOL from the AMM"
2. Bob sees Alice's transaction in the mempool (it's public)
3. Bob front-runs: buys SOL first (pushes price up)
4. Alice's transaction executes at the worse price
5. Bob back-runs: sells SOL at the elevated price
6. Bob profits. Alice loses. LP loses.
```

The problem: transaction details are visible BEFORE execution. Anyone can react to them.

## How commit-reveal works

```
Step 1 — Commit:
  Alice sends: hash("buy 10,000 SOL, max slippage 1%")
  (The actual details are hidden — only a hash is on-chain)

Step 2 — Wait:
  A few blocks pass. Bob can't front-run because he doesn't know
  what Alice is trading or how much.

Step 3 — Reveal:
  Alice sends: "buy 10,000 SOL, max slippage 1%" + proof it matches the hash
  The trade executes. Bob can't front-run because the reveal and
  execution happen in the same transaction.

If Alice never reveals: the commit expires, she loses a small deposit.
```

## Where it's used in V-AMM

The adversarial analysis (report 04) recommends commit-reveal for **large trades** during flat-curve mode:

```
Large trade threshold: trade_size > 1% of pool reserves
Commit: hash(trade_details) in block N
Reveal + Execute: reveal details in block N+5, execute atomically
```

**Why only large trades?** Commit-reveal adds latency (5 blocks = ~2 seconds). Small trades don't need it — the front-running profit is too small to justify the attack. Large trades in flat-curve mode are the prime target for sandwich attacks — low front-run cost, large victim size.

## Alternatives to commit-reveal

- **Slippage protection (min_amount_out):** Already in V-AMM. Alice sets a minimum output. If price moved, her trade reverts.
- **Private mempools:** Transactions go directly to block builders, not the public mempool. Solana's architecture makes this harder than Ethereum.
- **Flashbots/MEV auctions:** On Ethereum, traders can send transactions privately. On Solana, Jito offers similar protection.
