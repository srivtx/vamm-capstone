# What is Volatility?

**Volatility** measures how much and how fast a price moves up and down. It's the "jumpiness" of an asset.

## The idea

Imagine two assets over one week:

```
Asset A (stable):   $100 → $101 → $99 → $100 → $100.50 → $99.50 → $100
                    Small wiggles. Total range: $99–$101. Low volatility.

Asset B (volatile): $100 → $120 → $85 → $110 → $70 → $130 → $95
                    Big swings. Total range: $70–$130. High volatility.
```

Asset B is more volatile. If you held it, your portfolio value changed dramatically day to day. If you provided liquidity for it in an AMM, you faced much more risk than for Asset A.

## How it's measured

Volatility is calculated from **returns** — the percentage change in price between two points:

```
return = (price_new − price_old) / price_old
       = price_new / price_old − 1

Example: price goes from $100 to $105
return = 105/100 − 1 = 0.05 = +5%
```

Returns can be positive (price went up) or negative (price went down). For volatility, we don't care about direction — up 5% and down 5% are equally volatile. So we measure the **spread of returns** around their average.

The standard formula for volatility (standard deviation of returns):

```
1. Calculate each return: r₁, r₂, r₃, ...
2. Find the average return: r̄
3. Square each deviation: (r₁ − r̄)², (r₂ − r̄)², ...
4. Average the squared deviations: variance = average of those squares
5. Take the square root: volatility = √variance
```

## Annualized volatility

Raw volatility depends on the time window. "Volatility over 1 hour" and "volatility over 1 day" are different numbers. To make them comparable, we **annualize**:

```
σ_annual = σ_window × √(365 / window_in_days)
```

If one-hour volatility is 2%, annualized is roughly 2% × √(365×24) = 2% × 93.6 ≈ 187% annualized. That's very high — typical stocks are 15–30% annualized.

## What volatility means for AMMs

| Volatility level | What's happening | What the AMM should do |
|---|---|---|
| Low (≤ 15% annualized) | Calm market, price stable | Flat curve, cheap fees — attract volume |
| Medium (15–75%) | Normal price action | Moderate curve and fees |
| High (75–120%) | Significant swings | Curved pool, expensive fees — protect LPs |
| Extreme (≥ 120%) | Chaos | Maximum curve, maximum fee — survival mode |

## Realized vs implied volatility

- **Realized volatility**: calculated from actual past price moves. Backward-looking. What V-AMM uses.
- **Implied volatility**: derived from options prices, reflecting what traders expect in the future. Forward-looking. Needs external data.

V-AMM uses only realized volatility — computed from the pool's own trade history, no external data needed.
