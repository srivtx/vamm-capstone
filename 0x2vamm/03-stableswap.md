# 03 — StableSwap

> *A dial that blends flat and curved.*

---

## The idea

We have two formulas. One gives a straight line (constant sum) — great for stable pairs but drains completely. One gives a curved line (constant product) — never drains but has slippage everywhere.

What if we could **blend them**? And control the blend with a single knob?

That knob is called **A** — the amplification coefficient. You can think of it as the "flatness dial."

```
A = 10,000   →   behaves almost like a straight line (very flat, tight price)
A = 100      →   moderate curve in the middle
A = 1        →   behaves almost like constant product (curved everywhere)
```

## What does "flat" mean visually?

```
y ↑                  y ↑                  y ↑
  |   ·               |    ·                |   ···
  |  ·                |  ·                  |  ·   ·
  | ·                 | ·                   | ·     ·
  |·                  |·                    |·       ·
  └────────→ x        └──────────→ x        └──────────→ x

  High A (flat)       Medium A             Low A (curved)
  almost no           some slippage        lots of slippage
  slippage near                    near the middle           everywhere
  the middle
```

High A means the middle of the curve is very flat — like the straight line from part 2. This gives tight prices for normal trades. But near the edges the curve still bends, so the pool never drains completely.

Low A means the curve is rounded everywhere — like the constant product from part 1. More slippage, but the pool survives extreme price moves.

## The actual formula

For two tokens, the StableSwap invariant (that's what Curve calls their formula) is:

```
4A(x + y) + D = 4AD + D³ / (4xy)
```

Don't worry about solving this — the computer does that with a technique called Newton-Raphson iteration (basically: guess, check, refine, repeat). What matters is **what it does**:

- When `x` and `y` are close to each other (pool is balanced), the `D³/(4xy)` term is small. The equation acts like `x + y = D` — flat, straight-line behavior.
- When `x` and `y` are far apart (pool is imbalanced), the `D³/(4xy)` term grows large. The equation bends toward constant product — curved, protective behavior.

`D` represents the "economic size" of the pool. It's roughly what the total value would be if both sides were equal.

## The tradeoff of A

| A value | Curve shape | Good for | Bad for |
|---|---|---|---|
| High (10,000+) | Very flat middle | Stable pairs, tight spreads | If one token loses its peg, LPs get wrecked fast |
| Medium (100–1000) | Moderate curve | Correlated assets with some volatility | Not tight enough for stablecoins, not protective enough for volatile pairs |
| Low (1–10) | Mostly curved | Volatile pairs, LP safety | High slippage, worse execution for traders |

## The problem with fixed A

In every existing StableSwap pool (Curve on Ethereum, Saber on Solana), **A is chosen when the pool is created and never changes.**

This is fine as long as the market behaves the way you expected. But:

- If you picked A = 2000 for a USDC/USDT pool and USDC depegs (loses its $1 value), the flat curve will drain your LP position before you can react.
- If you picked A = 10 for safety and the pair stays stable for months, traders go elsewhere because your slippage is needlessly high.

**The pool is always wrong for some market condition.** The A it needs changes over time, but the A it has is frozen.

## The next question

What if A could change automatically, based on how the market is actually behaving? That's what V-AMM does.

But first we need to understand: what signal should control A?

---

[← Prev — 02 Constant Sum](02-constant-sum.md) · [Next → 04 — Why Volatility Matters](04-why-volatility-matters.md)
