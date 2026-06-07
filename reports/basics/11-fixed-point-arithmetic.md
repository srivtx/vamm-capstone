# What is Fixed-Point Arithmetic?

Solana's BPF runtime doesn't allow floating-point numbers (no `f64`, no decimals). But we need to work with fractional values like `0.05`, percentages like `15.3%`, and precise ratios. The solution: **fixed-point arithmetic**.

## The idea

Take a number and multiply it by a big constant. Do all your math with the scaled-up integer. Divide by the constant at the end to get the real value.

```
Real number:    0.05
Scale by 10^12: 50,000,000,000  (50 billion)
Do math:        50,000,000,000 × 100 = 5,000,000,000,000
Unscale:        5,000,000,000,000 / 10^12 = 5.0
```

The constant `10^12` is called the **scale factor**. V-AMM uses it everywhere — written as `SCALE = 1_000_000_000_000`.

## Common scale factors

| Name | Scale | Used for |
|---|---|---|
| `SCALE` / `1e12` | 10^12 | General fixed-point in V-AMM (volatility, fees) |
| Q64.64 | 2^64 | 128-bit numbers split: 64 bits integer, 64 bits fractional |
| `1e18` | 10^18 | High precision (Curve/Ethereum contracts) |

## Operations with fixed-point

**Multiplication** of two scaled numbers produces a double-scaled result:

```
(a × SCALE) × (b × SCALE) = (a × b) × SCALE²

After multiplying, DIVIDE by SCALE to get back to single-scale:
scaled_result = (scaled_a × scaled_b) / SCALE
```

**Division** loses scale, so you multiply first:

```
scaled_a / scaled_b = (scaled_a × SCALE) / scaled_b
```

This is why V-AMM code is full of patterns like:
```
value.checked_mul(SCALE)?.checked_div(other)?
```

## Why this matters for V-AMM

The volatility engine, fee calculations, A-mapping, and EWMA all run in fixed-point u128. Without fixed-point, we couldn't compute:
- Volatility = 15.3% (needs decimals)
- Fee = 5 bps = 0.0005 (needs decimals)
- EWMA = 0.95 × old + 0.05 × new (needs decimals)

The reports refer to "Q64.64" or "fixed-point with scale 1e12" — this is what they mean.

## Integer sqrt (Babylonian method)

Even square roots must be integers. The Babylonian method approximates √n:
```
x = n
Repeat:
    x = (x + n/x) / 2
Until x stops changing
```

Converges in ~10 iterations. Used to compute standard deviation from variance, and annualization factors. Costs ~250 CU.
