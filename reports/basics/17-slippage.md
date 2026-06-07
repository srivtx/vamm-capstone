# What is Slippage?

**Slippage** is the difference between the price you expected and the price you actually got on a trade.

## How it happens

You check the AMM: 1 SOL = 100 USDC. You want to buy 10 SOL, so you expect to pay 1,000 USDC. You send the transaction.

But between you checking the price and your transaction executing, someone else traded first. Or your trade itself was large enough to move the price. Either way, the price when your trade executes is slightly worse than what you saw.

The difference between expected price and executed price is slippage.

## Two sources of slippage

**1. Price impact (from your own trade)**
Your trade changes the pool's reserves, which changes the price. Bigger trades = more price movement = more slippage. This is the `x × y = k` formula at work.

```
Small trade (1% of pool):  ~1% slippage
Medium trade (10%):         ~10% slippage
Large trade (50%):          ~50% slippage
```

**2. Front-running (from someone else's trade)**
Someone sees your pending transaction and trades before you, moving the price. Your trade then executes at the worse price. This is MEV / sandwich attacks.

## How traders protect themselves

The `min_amount_out` parameter on every swap: "I want to buy SOL. I expect at least X SOL for my USDC. If I'd get less than X, cancel the trade."

```
swap(amount_in=1000 USDC, min_amount_out=9.5 SOL)
```

If the pool would give 9.4 SOL (because of slippage), the transaction reverts. The trader pays only the failed transaction fee, not the bad trade.

## Why slippage matters for AMM design

- **Flat curves (high A)** have low slippage near the peg → attractive for traders
- **Curved pools (low A)** have higher slippage everywhere → protective for LPs but worse for traders
- **The tradeoff**: lower slippage attracts volume (good for LPs). But lower slippage also makes manipulation cheaper (bad for LPs).

V-AMM navigates this tradeoff by adjusting A based on volatility: flat when it's safe, curved when it's not.
