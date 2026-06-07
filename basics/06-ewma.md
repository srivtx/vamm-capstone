# What is EWMA?

**EWMA** (Exponentially Weighted Moving Average) is a way to compute a running average where **recent data counts more than old data.**

## The formula

```
new_average = λ × old_average + (1 − λ) × new_data_point
```

`λ` (lambda) is the "smoothing factor" — a number between 0 and 1.

- λ = 0.95 means: keep 95% of the old average, add 5% of the new value
- λ = 0.50 means: half old, half new (responds quickly)
- λ = 0.99 means: 99% old, 1% new (very slow to change)

## Concrete example

You're tracking the average temperature. λ = 0.9, current average = 20°C.

```
Day 1: actual = 22°C  →  average = 0.9×20 + 0.1×22 = 20.2
Day 2: actual = 22°C  →  average = 0.9×20.2 + 0.1×22 = 20.38
Day 3: actual = 22°C  →  average = 0.9×20.38 + 0.1×22 = 20.54
Day 4: actual = 30°C (heatwave!) → average = 0.9×20.54 + 0.1×30 = 21.49
Day 5: actual = 29°C  →  average = 0.9×21.49 + 0.1×29 = 22.34
```

The spike on day 4 moved the average from 20.5 to 21.5 — a jump, but not to 30. The EWMA resists one-off events but tracks sustained changes.

## Why EWMA is used everywhere in V-AMM

**Volatility tracking:** EWMA smooths the squared price returns from each swap. One whale trade doesn't convince the pool the market is wild — sustained large moves do.

**Fee smoothing:** EWMA smooths the raw fee from the volatility signal. The fee doesn't twitch on every trade; it slides up or down over ~10 trades.

## EWMA vs simple average

| | Simple average | EWMA |
|---|---|---|
| One spike | Moves the average (1/N weight) | Barely moves (1−λ weight, then decays) |
| Old data | Stays forever (equal weight) | Decays exponentially (λⁿ) |
| Memory | Needs to store all past data | Only needs the previous average |
| On-chain cost | Expensive (loop over history) | Cheap (one multiply + one add) |

For on-chain use, EWMA is ideal: cheap compute, one storage slot, smooth response.
