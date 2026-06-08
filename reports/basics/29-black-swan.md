# What is a Black-Swan Event?

A **black-swan event** is an unpredictable, extreme event with severe consequences. In finance: a market crash, a sudden regulatory ban, a stablecoin collapse that nobody saw coming.

## Examples in crypto

- **FTX collapse (Nov 2022):** SOL dropped 60% in days. Every SOL pool was hit.
- **UST/Luna death spiral (May 2022):** $40B ecosystem vanished in 72 hours.
- **SVB bank run (Mar 2023):** USDC depegged to $0.87. Stablecoin pools drained.

## Why black-swan events destroy AMMs

Normal AMM designs assume "things won't get THAT bad." A flat-curve pool with A=2000 and 5 bps fee is optimized for the 99.9% of time when nothing crazy happens. During a black-swan, that optimization becomes a vulnerability — the flat curve drains LPs at exactly the wrong moment.

## How V-AMM is designed for them

**Circuit breaker:** If a single trade moves the pool price by >2%, immediately drop A to minimum and spike fees. Stops toxic flow during the early moments of a crash.

**A ramp floor:** A never goes below 1 (near constant-product). Even in extreme volatility, the pool offers some protection — it won't drain at 1:1.

**Fee cap:** 100 bps maximum. Even in chaos, fees don't go above 1%. This prevents a fee-death-spiral where fees rise so high that all volume disappears and LPs can't exit.

**Dual time windows:** 15-min EWMA for fast response, 1-hour buckets for sanity check. A flash crash that reverts in 30 seconds barely affects the 1-hour signal.

## The report's recommendation

The adversarial analysis (report 04) recommends an **insurance fund** for black-swan protection — a portion of protocol fees set aside to compensate LPs during extreme events. This converts "once every 5 years, you lose everything" into "you earn slightly less every day, but you survive the 5-year event."
