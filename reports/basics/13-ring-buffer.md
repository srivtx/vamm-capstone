# What is a Ring Buffer?

A **ring buffer** (circular buffer) is a fixed-size array that overwrites old data when full. It's the standard way to maintain a sliding window of recent history without growing memory usage.

## How it works

```
Array of 4 slots:  [ _ ] [ _ ] [ _ ] [ _ ]
                    cursor = 0

Write A:            [ A ] [ _ ] [ _ ] [ _ ]   cursor advances to 1
Write B:            [ A ] [ B ] [ _ ] [ _ ]   cursor = 2
Write C:            [ A ] [ B ] [ C ] [ _ ]   cursor = 3
Write D:            [ A ] [ B ] [ C ] [ D ]   cursor = 0 (wraps around!)
Write E:            [ E ] [ B ] [ C ] [ D ]   A is overwritten, cursor = 1
```

When the buffer is full, new data overwrites the oldest data. The buffer always contains the **N most recent entries** — no matter how long it runs, memory stays fixed at N slots.

## Why V-AMM uses ring buffers

The volatility engine uses two ring buffers:

**15-minute buffer (4 slots):**
```
[bucket_0] [bucket_1] [bucket_2] [bucket_3]  ← cursor rotates every 15 min
```
Stores the last hour of 15-minute price observations. New bucket overwrites the oldest.

**1-hour buffer (4 slots):**
```
[hour_0] [hour_1] [hour_2] [hour_3]  ← cursor rotates every hour
```
Stores the last 4 hours. Each hour bucket aggregates four 15-minute buckets.

## Why not just use an ever-growing array?

On Solana, account storage costs rent. An ever-growing array would:
- Cost more SOL over time (eventually too expensive)
- Require dynamic resizing (expensive compute)
- Store useless old data

A ring buffer uses fixed storage (~250 bytes for the 15-min buffer, ~250 bytes for the 1-hour buffer) regardless of how long the pool operates.

## The cursor pattern

```
advance_bucket():
    bucket[cursor] = new_data
    cursor = (cursor + 1) % 4    // wrap around after 4
    count = min(count + 1, 4)     // track how many slots are actually filled
```

The `count` field tells us whether the buffer has been fully populated yet. A buffer with count=2 has only 2 valid entries; a buffer with count=4 is fully populated and all slots are meaningful.
