# What is LVR?

**LVR** (Loss-Versus-Rebalancing) is the value LPs lose to arbitrageurs because an AMM's internal price is always slightly behind the true market price.

## The scenario

```
1. SOL is trading at $100 on Binance. The AMM's internal price is also $100.
2. A news event hits. SOL jumps to $105 on Binance.
3. The AMM still thinks SOL is $100 — no trade has happened yet.
4. An arbitrageur sees this. They buy SOL from the AMM at $100
   and instantly sell it on Binance at $105. Profit: $5 per SOL.
5. The LP who provided that SOL lost $5 per SOL sold.
```

Every time the external market moves, the AMM lags behind by one trade. Arbitrageurs close that gap and pocket the difference. The LP absorbs the loss.

## Why "Versus Rebalancing"?

Imagine you held SOL in your wallet. When it goes from $100 to $105, your portfolio gains $5. If you rebalanced (sold some SOL at $105), you'd lock in that gain.

But as an LP, you didn't rebalance — the arbitrageur did it for you, at your expense. The "loss-versus-rebalancing" is the difference between what you'd have if you rebalanced yourself at the true market price, versus what happened when an arbitrageur rebalanced the pool at a slightly worse price.

## LVR scales with volatility

| Volatility | Price moves per hour | LVR impact |
|---|---|---|
| 5% | Small, slow | Negligible — fees easily cover it |
| 30% | Several 1-2% moves | Noticeable — need ~20-30 bps fee to cover |
| 100% | Constant swings | Severe — need 100+ bps fee to survive |

The formula: LVR ≈ σ² × pool_value / 8 (rough approximation). LVR grows with the **square** of volatility. Double the volatility = 4× the LVR.

## How V-AMM handles LVR

When volatility rises, V-AMM does two things:
1. **Raises fees** — compensates LPs directly. More fee income offsets higher LVR.
2. **Lowers A** — makes the curve steeper. A steeper curve means arbitrageurs must trade more to move the price, reducing their profit per trade.

Together, these keep the pool LP-positive even in high-volatility regimes.
