# What is TWAP?

**TWAP** (Time-Weighted Average Price) is an average price where each price observation is weighted by how long it lasted.

## Why it matters

If you just take the average of all trade prices, a single large trade can skew the result. TWAP fixes this: a price that lasted 10 minutes contributes 10× more than a price that lasted 10 seconds.

```
Simple average:     sum of all trade prices / number of trades
                    → manipulated by one large trade

TWAP:               sum of (price × duration) / total duration
                    → resists manipulation, needs sustained effort
```

## How it works

```
Time  | Price | Duration (seconds) | Price × Duration
------|-------|-------------------|------------------
0:00  | $100  | 300               | 30,000
5:00  | $102  | 600               | 61,200
15:00 | $101  | 900               | 90,900
30:00 | $105  | 1800              | 189,000

TWAP = (30,000 + 61,200 + 90,900 + 189,000) / (300 + 600 + 900 + 1800)
     = 371,100 / 3600
     = $103.08
```

The price at 5:00 ($102) lasted 10 minutes; the price at 30:00 ($105) lasted 30 minutes. The $105 gets more weight.

## How V-AMM uses it

The volatility engine stores **tick_cumulative × slot** in each time bucket. This is the TWAP building block:

```
tick_cumulative = Σ (tick_at_each_swap × slot_duration_since_last_swap)
```

To get the average tick for a bucket:
```
average_tick = tick_cumulative / (bucket_end_slot - bucket_start_slot)
```

Then the tick change from one bucket to the next gives the log return for that time window — a manipulation-resistant measure of how much the price actually moved.

## TWAP vs VWAP

- **TWAP**: weighted by time. A price that lasted longer counts more.
- **VWAP** (Volume-Weighted Average Price): weighted by volume. A price where lots of trading happened counts more.

Both resist manipulation, but in different ways. TWAP requires sustained fake prices (expensive over long periods). VWAP requires fake volume (expensive if fees are meaningful).

V-AMM uses tick_cumulative (time-weighted) in buckets, plus volume tracking for cross-verification.
