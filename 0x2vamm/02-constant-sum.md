# 02 — Constant Sum

> *What if the price never needs to move?*

---

## The formula

```
x + y = S
```

- `x` = amount of token A in the pool
- `y` = amount of token B in the pool
- `S` = the total sum, fixed at pool creation

"Sum" means addition. "Constant" means it doesn't change. So: **the total number of tokens in the pool stays the same.**

## Walk through a trade

Pool starts with 100 USDC and 100 USDT. `S = 100 + 100 = 200`.

Someone swaps 10 USDC for USDT:

```
Before: 100 USDC, 100 USDT, S = 200
After:  110 USDC,  ? USDT

The sum can't change, so:
110 + ? = 200
? = 90 USDT

They get back: 100 − 90 = 10 USDT
```

They put in 10 USDC, got exactly 10 USDT. Price stayed at 1:1 perfectly.

Another trade: someone swaps 50 more USDC for USDT:

```
Before: 110 USDC, 90 USDT, S = 200
After:  160 USDC, ? USDT

160 + ? = 200
? = 40 USDT

They get back: 90 − 40 = 50 USDT
```

Again — exactly 1:1. No slippage, no matter how big the trade. This is perfect for stable pairs. USDC and USDT are both supposedly worth $1, so they should trade at exactly 1:1 with zero price movement.

## Visual: straight line vs. curved line

```
y (USDT)                    y (USDT)
↑ 200|•                      ↑
    |·                        |   ···
    | ·                       |  ·   ·
    |  ·                      | ·     ·
    |   ·                     |·       ·
  0 └──────→ x (USDC)      0 └──────────→ x (USDC)
          200

   Constant sum:              Constant product:
   straight line              curved line (hyperbola)
   price never changes        price changes with every trade
```

The constant sum formula plots as a **straight diagonal line** from (200, 0) to (0, 200). The straight line means "I will trade you 1:1 no matter what."

The constant product formula from part 1 plots as a **curved line** that bends away from the axes. The curve means "the more you buy, the worse your price gets."

## The fatal flaw

Look at that straight line again. It touches both axes. That means someone can push the pool all the way to one corner:

```
Start:      100 USDC, 100 USDT
Trade #1:   put in 50 USDC, take out 50 USDT  →  150 USDC, 50 USDT
Trade #2:   put in 50 USDC, take out 50 USDT  →  200 USDC, 0 USDT
```

The pool now has 200 USDC and **zero USDT**. It's dead. Nobody can get USDT from it anymore. The straight line didn't protect the pool — it offered infinite liquidity until the exact moment it ran out.

This is why constant sum pools don't exist on their own in production. They're too fragile. One side gets drained and the pool is useless.

## What we actually want

```
y ↑
  |   ······
  |  ·      ·    ← want: flat in the middle (1:1 for small trades)
  | ·        ·
  |·          ·  ← want: curved at the edges (so pool never drains)
  └──────────────→ x
```

We want a formula that acts like a **straight line in the middle** (zero slippage for normal trading) but **curves out at the edges** (so you can never drain the pool completely).

This is exactly what Curve Finance invented in 2019. They called it **StableSwap**.

---

[← Prev — 01 Constant Product](01-constant-product.md) · [Next → 03 — StableSwap](03-stableswap.md)
