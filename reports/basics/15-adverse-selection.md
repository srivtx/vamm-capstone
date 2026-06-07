# What is Adverse Selection?

**Adverse selection** happens when one party in a trade has better information than the other. The informed party profits; the uninformed party loses.

## The lemon problem (classic example)

A used car market. Sellers know if their car is a lemon (bad). Buyers don't. Buyers offer an average price. Sellers with good cars refuse to sell at that price — they know their car is worth more. Sellers with lemons happily sell. Over time, only lemons remain in the market. The market for good used cars collapses.

## Adverse selection in AMMs

The AMM is the uninformed party. It doesn't know the true market price — it only knows its own reserves. Every trader who comes to the pool might know something the pool doesn't.

```
Scenario A: A retail trader swaps USDC for SOL.
  They don't have special information. The trade is "uninformed."
  The LP earns a fee. Everyone wins.

Scenario B: News breaks that SOL is now $110 (was $100).
  An arbitrageur sees this instantly. The AMM still prices SOL at $100.
  The arbitrageur buys SOL from the AMM at $100 and sells at $110.
  The trade is "informed" — the arbitrageur knew the true price.
  The LP loses $10 per SOL sold. The arbitrageur wins.
```

The problem: the AMM can't tell the difference between Scenario A and Scenario B. It treats every trader the same. But some traders are toxic (informed) and some are benign (uninformed).

## How fees help

Fees are the LP's compensation for adverse selection. A 30 bps fee means the LP earns 0.30% on every trade. The hope is that fees from uninformed traders outweigh losses to informed traders.

The formula for LP profitability:
```
LP Profit = Fees from uninformed traders − Losses to informed traders
```

If fees are too low, losses dominate → LPs leave → pool dies.
If fees are too high, volume disappears → no fees earned → LPs leave → pool dies.

## How V-AMM handles it

When volatility rises, informed trading increases (more price movements = more arbitrage opportunities). V-AMM responds by:
1. **Raising fees** — makes informed trading more expensive, compensating LPs
2. **Lowering A** — steepens the curve, making it more expensive for informed traders to move the price

This is the core thesis: **dynamic fees + dynamic curve = adaptive defense against adverse selection.**
