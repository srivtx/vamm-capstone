# What are Basis Points?

A **basis point** (bp) is 0.01%. It's the standard unit for measuring fees and interest rates in finance.

```
1 bp   = 0.01%
5 bps  = 0.05%
30 bps = 0.30%
100 bps = 1.00%
10,000 bps = 100%
```

## Why use basis points instead of percentages?

Percentages get awkward for small numbers. "Zero point zero five percent" is annoying to say and write. "5 bps" is clean. It also avoids ambiguity — "rates rose by 1%" could mean 1.00% → 2.00% (an increase of 100 bps) or 1.00% → 1.01% (an increase of 1 bp). Basis points remove the confusion.

## In AMMs

Swap fees are measured in bps. A 30 bps fee means the pool takes 0.30% of your input amount:

```
You swap 1000 USDC at 30 bps fee:
  fee = 1000 × 30 / 10000 = 3 USDC
  net amount used in trade = 1000 − 3 = 997 USDC
```

## V-AMM's fee range

| Fee | When | Why |
|---|---|---|
| 5 bps | Calm market (low volatility) | Attract volume, LPs face little risk |
| 30 bps | Moderate volatility | Balance LP protection with trader appeal |
| 100 bps | High volatility | Maximum protection, deter toxic flow |

The fee slides between these values based on on-chain volatility. Never jumps — uses smoothstep and rate limiting.
