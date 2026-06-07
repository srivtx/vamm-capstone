# Understanding AMM Math: From CPMM to StableSwap

Automated Market Makers (AMMs) are the backbone of decentralized exchanges. Instead of matching buyers and sellers on an order book, AMMs pool assets and let a mathematical formula determine the price. This report builds up the math step by step, starting from the simplest model (`x * y = k`) and arriving at Curve's StableSwap — the invariant that powers billions of dollars in stablecoin swaps. Along the way, we cover price discovery, slippage, and the role of the amplification parameter A.

## Constant Product Market Maker: `x * y = k`

The CPMM invariant is:

```
x * y = k
```

where `x` and `y` are the reserves of two tokens in the pool, and `k` is a constant set at pool creation.

### Spot Price

The price of token X in terms of token Y is the slope of the curve at the current reserve point. Implicit differentiation gives:

```
p = y / x
```

If the pool holds 100 USDC (x) and 100 DAI (y), the price is 1. If a trade drains USDC to 50 (so DAI rises to 150), the price shifts to 150/50 = 3. The price moves continuously with every trade — this is how AMMs discover price without an order book.

### Swap Output

When a trader deposits Δx of token X and receives Δy of token Y, the invariant must hold before and after:

```
(x + Δx) * (y - Δy) = x * y
```

Solving for the output Δy:

```
Δy = (y * Δx) / (x + Δx)
```

### Slippage

The average execution price is `P_avg = Δy / Δx = y / (x + Δx)`. Slippage measures how much worse this is than the spot price before the trade:

```
S = (P_avg - p) / p = -Δx / (x + Δx)
```

For a small trade (`Δx << x`), this is approximately `S ≈ -Δx / x`. A trade worth 1% of the pool causes roughly 1% slippage. Larger trades pay progressively more.

---

## Constant Sum Market Maker: `x + y = S`

The CSMM invariant is:

```
x + y = S
```

where `S` is a constant total.

### Spot Price

```
p = 1
```

The price never moves. It is always 1:1.

### Swap Output

```
Δy = Δx
```

Zero slippage, infinite liquidity at exactly `p = 1`.

### Where It Breaks

Each reserve lives in the interval `[0, S]`. If the pool has 100 of each token and someone buys 100 X, the pool is drained of X and can no longer facilitate buys in that direction. CSMM offers no protection against reserve exhaustion — one large trade can wipe out one side entirely. This makes it unsuitable for volatile assets without external guardrails.

---

## The StableSwap Invariant: Blending the Two

Curve's core insight: what if you could behave like a constant sum near equilibrium (low slippage for stable pairs) but revert to constant product far from equilibrium (to prevent draining)?

### The Invariant

For two tokens, the StableSwap invariant is:

```
4A(x + y) + D = 4AD + D³ / (4xy)
```

Where:
- **D** — the "total value" invariant, roughly equal to `x + y` at equilibrium. It represents the pool's economic size.
- **A** — the amplification coefficient. Think of it as a dial controlling how flat the curve is around the peg.

### How A Controls Behavior

| Limit | Behavior | Simplified Invariant |
|-------|----------|---------------------|
| A → ∞ | Constant Sum | `x + y = D` |
| A → 0 | Constant Product | `xy = (D/2)²` |

High A concentrates liquidity tightly around `p = 1`, mimicking an order book with deep, tight spreads. Low A widens the spread and deepens the tails, making the pool behave more like Uniswap.

Proof for the limits:

1. **Constant Sum limit (A → ∞):** Divide the invariant by A. As A grows, terms with A in the denominator vanish, leaving `x + y = D`.

2. **Constant Product limit (A → 0):** The invariant reduces to `D = D³ / (4xy)`, which simplifies to `xy = (D/2)²`.

### Spot Price

Implicit differentiation of the invariant at constant D gives:

```
p(x, y) = (4A + D³/(4x²y)) / (4A + D³/(4xy²))
```

- At equilibrium (`x = y = D/2`): `p = 1`
- As `A → 0`: `p → y/x` (reduces to CPMM)
- As `A → ∞`: `p → 1` (reduces to CSMM)

---

## Computing D: Newton-Raphson Iteration

D appears on both sides of the invariant, so for given reserves `{x, y}` and a chosen A, you can't solve for D algebraically — you iterate.

The Newton-Raphson update formula (two-token case):

```
D_new = (4A * (x + y) + D_old³ / (4xy)) / (4A - 1)
```

This converges in 4–6 iterations in practice. The function is monotonic and convex for `D > 0`, so Newton-Raphson is fast and reliable.

In production contracts (e.g., Curve's Vyper implementation), all arithmetic uses integer fixed-point math with a precision scalar (typically 10¹⁸). The loop is capped at 255 iterations but never reaches it in normal operation.

### Why D Matters

D is roughly proportional to the LP token supply. When liquidity is added or removed, D changes and the contract mints or burns LP tokens accordingly. During swaps, D is cached — it does not change — so the pool can skip recomputing it on every trade.

---

## Executing a Swap Under StableSwap

Given current reserves `(x, y)`, a deposit of `Δx`, and the cached invariant D:

1. Compute the new X reserve: `x' = x + Δx`
2. Solve the invariant for the new Y reserve `y'` using the quadratic form:

```
16A * x' * y'² + (16A * x'² + 4D * x' - 16AD * x') * y' - D³ = 0
```

3. The output is: `Δy = y - y'`

There is no elementary closed-form formula for slippage under StableSwap — it depends on the full invariant solution. This is why on-chain contracts must run Newton iteration at swap time.

---

## How A Changes Behavior in Practice

The amplification parameter A is the pool's primary design knob:

- **Stablecoin pools** (USDC/DAI): A is set very high (2000+). The pool acts like a constant sum within ~2% of the peg — near-zero slippage for routine trades. Beyond that band, slippage grows rapidly, discouraging massive imbalances.
- **Correlated but volatile pairs** (ETH/stETH): A is moderate (~200). The pool tolerates wider price deviations while still concentrating liquidity around the expected ratio.
- **Uncorrelated volatile pairs**: A should be low, or the pool should use a different invariant entirely (e.g., Curve's CryptoSwap, which adds a dynamic price scale parameter).

A can also be adjusted over time. Curve ramps A gradually (over hours or days) rather than jumping instantaneously — this prevents sudden arbitrage opportunities during the parameter change.

---

## Key Takeaways

1. **CPMM (`x * y = k`)** is the simplest AMM. Price = `y/x`. Slippage grows linearly with trade size relative to the pool. Works for any price but has high slippage.

2. **CSMM (`x + y = S`)** offers zero slippage at a fixed price of 1. But it drains completely when one reserve runs out. Useless for volatile assets without external rebalancing.

3. **StableSwap blends both** via a single parameter A. Near equilibrium it behaves like a constant sum (tight spreads, low slippage). Far from equilibrium it behaves like a constant product (infinite range, no depletion). No piecewise functions or unsafe linear combinations needed — the interpolation is smooth and multiplicative.

4. **D is the pool's effective size**, computed from reserves and A using Newton-Raphson iteration. Converges in ~5 steps. Cache it between liquidity changes to save compute on swaps.

5. **A controls the flatness.** High A = concentrated liquidity around the peg. Low A = wider distribution. The right A depends on how tightly the pair's price is expected to hold near parity.

6. **Spot price in StableSwap** interpolates smoothly between `y/x` (A=0, CPMM) and `1` (A→∞, CSMM). A continuous price function means no abrupt jumps as A changes.
