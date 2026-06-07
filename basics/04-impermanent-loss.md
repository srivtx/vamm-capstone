# What is Impermanent Loss?

**Impermanent Loss (IL)** is the difference between (a) the value of tokens you'd have if you just held them, and (b) the value you get when you withdraw them from a liquidity pool after the price changed.

## The setup

You deposit $100 worth of token A and $100 worth of token B into a pool. Total: $200.

The price of A doubles relative to B (A goes 2×, B stays flat).

## If you just held

```
Before:   $100 of A  +  $100 of B  =  $200
After:    $200 of A  +  $100 of B  =  $300
Profit:   +$100 (+50%)
```

## If you provided liquidity (constant product pool)

The pool automatically rebalances — it sold some of your rising A for more of the falling B to maintain the `x × y = k` formula. When you withdraw:

```
You get back roughly $282 worth of tokens (depends on the exact curve)
Loss vs holding: $300 − $282 = $18 (6% loss)
```

That $18 is impermanent loss. It's called "impermanent" because if the price returns to your entry point before you withdraw, the loss disappears. But if you withdraw while the price is still away from entry, the loss becomes **permanent**.

## Why IL happens

The AMM formula forces rebalancing. When A rises, the pool sells A (reducing its A reserve) and buys B (increasing its B reserve). You end up with more of the underperforming asset and less of the outperforming one. A trader got your A at the old cheap price; you absorbed the difference.

## IL is worse in flat-curve pools

| Pool type | A value | What happens when price moves 2× |
|---|---|---|
| Constant product | n/a | ~5.7% IL |
| StableSwap, low A | 10 | ~6% IL (similar to CPMM) |
| StableSwap, high A | 2000 | ~18% IL (much worse!) |

High-A pools aggressively rebalance to keep the price near the peg. When the peg breaks, they convert your position to the losing asset very quickly.

## How V-AMM handles IL

V-AMM lowers A when volatility rises. This makes the pool curvier, which reduces IL. At the same time, fees rise, compensating LPs for the IL they do experience.

The combination — **curve adjustment + fee adjustment** — is the core idea behind V-AMM.
