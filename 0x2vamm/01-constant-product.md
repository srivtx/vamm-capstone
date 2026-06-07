# 01 — Constant Product

> *The simplest thing that could possibly work.*

---

## What is an AMM?

Imagine a vending machine. You put money in, a snack comes out. The price is set by whoever stocked the machine.

An AMM (Automated Market Maker) flips this. There's no human setting prices. Instead, the machine holds a pile of two tokens — say, USDC and SOL. When you trade with it, you add one token and take out the other. The machine uses a formula to decide how much to give you. No order book, no matching, just math.

The money you put in stays in the machine. That money is called **liquidity**, provided by people called LPs (Liquidity Providers). LPs earn a small fee from every trade.

## The simplest formula: constant product

```
x · y = k
```

- `x` = how many token A the pool currently holds
- `y` = how many token B the pool currently holds
- `k` = a fixed number that never changes (except when LPs add or remove money)

"Product" means multiplication. "Constant" means it doesn't change. So: **the product of the two reserve amounts always stays the same.**

## Why multiplication?

Let's say the pool has 100 USDC and 1 SOL. `k = 100 × 1 = 100`.

Trade #1: someone swaps in 10 USDC, wants SOL back.

```
Before: 100 USDC, 1 SOL, k = 100
After:  110 USDC, ? SOL

We know k must stay 100, so:
110 × ? = 100
? = 100/110 ≈ 0.9091 SOL

They get back: 1 − 0.9091 = 0.0909 SOL
```

Trade #2: someone else swaps in another 100 USDC.

```
Before: 110 USDC, 0.9091 SOL, k = 100
After:  210 USDC, ? SOL

210 × ? = 100
? = 100/210 ≈ 0.4762 SOL

They get back: 0.9091 − 0.4762 = 0.4329 SOL
```

Notice: **the more USDC you pour in, the less SOL you get per USDC.** The first 10 USDC got 0.0909 SOL (0.00909 per USDC). The next 100 USDC got 0.4329 SOL (0.00433 per USDC). The price got worse.

This is **slippage** — the price moves against you as you trade bigger amounts. This happens automatically because of multiplication. No human needs to adjust anything.

## Visualizing it

If you plot the possible states of the pool on a graph (x-axis = amount of token A, y-axis = amount of token B), the equation `x · y = k` forms a curve:

```
        y (SOL)
        ↑
      2 |··
        |  ··
    1.5 |    ··
        |      ··
      1 |        ··       ← pool is here (100 USDC, 1 SOL)
        |          ··
    0.5 |            ··
        |              ·······
      0 └────────────────────→ x (USDC)
        0    50    100   150

The curve never touches either axis — that means the pool never
runs out of either token completely. Price just gets worse and
worse as you approach the edge.
```

The curve is curved everywhere. That's the tradeoff: **price is always changing with trade size, even for stable pairs like USDC/USDT where it shouldn't.**

## What this design is good at

- Works for **any two tokens** — you don't need to know anything about their relationship
- **Never drains completely** — the price becomes infinite before you can empty one side
- **Zero setup** — pick two tokens, seed with some amounts, done

## What it's bad at

If two tokens should always trade 1:1 (like two stablecoins pegged to the dollar), constant product is wasteful. Even a small trade pushes the price away from 1:1, and it takes another trade to push it back. You're paying slippage for no reason — the real-world price didn't move, but the pool's internal price did.

For stable pairs we want something flatter. That leads us to the next design.

---

[Next → 02 — Constant Sum](02-constant-sum.md)
