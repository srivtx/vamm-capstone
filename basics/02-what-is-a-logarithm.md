# What is a Logarithm?

A logarithm answers one question: **"What power do I raise this base to, to get this number?"**

```
log₁₀(100) = 2      →   10² = 100
log₁₀(1000) = 3     →   10³ = 1000
log₂(8) = 3          →   2³ = 8
log₂(256) = 8        →   2⁸ = 256
```

The bottom number is called the **base**. The result is the **exponent** (power) you need.

## Why logarithms are useful

Logarithms turn big ranges into small ones:

| Number | log₁₀(number) |
|---|---|
| 1 | 0 |
| 10 | 1 |
| 100 | 2 |
| 1,000 | 3 |
| 1,000,000 | 6 |

A jump from 1 to 1,000,000 looks huge. In log terms, it's just 0 to 6. This compresses the scale.

They also turn **multiplication into addition:**

```
log(a × b) = log(a) + log(b)
```

And **division into subtraction:**

```
log(a / b) = log(a) − log(b)
```

## Why this matters for AMMs

In finance, we care about **percentage changes**, not absolute changes:

- SOL going from $100 to $110 = +10% (meaningful)
- SOL going from $100 to $100.10 = +0.1% (noise)
- SOL going from $1 to $1.10 = +10% (same percentage, different absolute)

If we used raw price differences, a $0.10 move on a $1 token looks tiny but it's actually 10%. Logarithms fix this: **a difference in log prices equals a percentage change.**

```
log(P₂) − log(P₁) ≈ percentage change in P
```

## In V-AMM

We use logarithms to measure volatility. Since Solana can't compute `log()` directly (no floating point), we use the **tick trick**: Uniswap stores prices as `tick = log₁.₀₀₀₁(price)`, which is already in log form. A tick difference IS a log return — no runtime logarithm needed.

[How ticks work in V-AMM →](../0x2vamm/05-on-chain-volatility.md)
