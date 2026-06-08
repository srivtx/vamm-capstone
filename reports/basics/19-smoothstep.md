# What is Smoothstep?

Smoothstep is a mathematical function that creates a smooth transition between two values. No jumps. No cliffs. No thresholds to exploit.

## The formula

```
smoothstep(t) = 3t² − 2t³
```

Where `t` goes from 0 to 1 as you move through a transition zone.

## What it produces

| t (progress) | smoothstep(t) | What this means |
|---|---|---|
| 0.00 | 0.000 | At the start — flat, no change |
| 0.25 | 0.156 | Barely moving — gentle start |
| 0.50 | 0.500 | Halfway — steepest part |
| 0.75 | 0.844 | Slowing down — approaching end |
| 1.00 | 1.000 | At the end — flat again |

The key property: **zero slope at the start and end.** The transition begins gently, accelerates in the middle, and decelerates at the end. No sharp corners. No moment where the value "jumps."

## Why smoothstep for fees

If we used hard thresholds (σ < 15% → 5 bps, σ ≥ 15% → 30 bps), an arbitrageur watching the chain could:
- See volatility at 14.9% (fee = 5 bps)
- Push one large trade to cross 15% (fee spikes to 30 bps)
- Other traders suddenly pay 6× more

Smoothstep eliminates this. At 14.9% the fee is ~5 bps. At 15.1% it's ~5.2 bps. No cliff. No exploit.

## How V-AMM uses it

```
Band 1: σ ∈ [15%, 75%]
  t = (σ - 15) / 60
  fee = 5 + 25 × smoothstep(t)     →  slides 5→30 bps

Band 2: σ ∈ [75%, 120%]  
  t = (σ - 75) / 45
  fee = 30 + 70 × smoothstep(t)    →  slides 30→100 bps
```

The result: a fee curve that's flat at the extremes (calm stays cheap, chaos stays capped) and transitions smoothly between them.
