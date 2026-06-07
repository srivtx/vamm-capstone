# 07 — Moving Parts Together

> *A ramps down, fees ramp up. Never abruptly. Always smoothly.*

---

## The two knobs, one source

We now have two things that change based on σ (volatility):

| When σ rises... | A does this | Fee does this |
|---|---|---|
| Curve shape | **Lowers A** → curve steepens, more like CPMM | — |
| LP protection | — | **Raises fee** → higher cut per trade |
| Speed | Slow ramp (~1 hour) | Fast but capped (10 bps/slot) |
| Purpose | Prevent LP drainage | Compensate LP risk |

They're both driven by the same signal but move at different speeds and serve different purposes. A changes the **shape of the pool** (how much slippage exists). Fee changes the **cost of trading** (how much LPs earn).

## How A ramps

A doesn't jump. If the target shifts from 1000 to 100, the pool doesn't instantly switch. It **ramps** — slides linearly from old value to new value over time.

```
When a ramp is triggered:

  a_start  = current A value (what the pool has right now)
  a_target = new target A (what volatility says it should be)
  end_slot = current_slot + 9000   (roughly 1 hour from now)

Then, on every subsequent instruction that reads A:

  elapsed = current_slot − start_slot
  progress = elapsed / 9000
  a_current = a_start + (a_target − a_start) × progress
```

Each block, A moves roughly 1/9000th of the way toward the target. Over 9000 slots (~1 hour on Solana), it reaches the target.

A ramp is only triggered when the difference is significant — more than 10% of the current A. Minor fluctuations are ignored. You don't want the ramp constantly twitching.

## Why ramping matters: the arbitrage problem

Imagine A drops instantly from 1000 to 100:

```
BEFORE (A=1000, flat):          AFTER (A=100, curved):
    y ↑                              y ↑
      |····                            |   ···
      |    ·                           |  ·   ·
      |     ·                          | ·     ·
      |      ·                         |·       ·
      └────────→ x                     └──────────→ x

Pool holds: 100 USDC, 1 SOL        Pool's internal price shifts
Price: ~100 USDC/SOL               because the curve changed shape
```

An arbitrageur monitoring the chain sees the A-change transaction before it lands. They sandwich it:

1. **Before:** Buy SOL from the pool at the old tight price (near $100)
2. **After:** Sell SOL back to the pool (now at a wider spread) or sell elsewhere
3. **Result:** The LP loses the price difference; the arbitrageur pockets it

With a ramp over 1 hour, there's no single block where the curve suddenly shifts. The transition is continuous — at any given moment, the price has moved only 0.01% from the previous moment. Arbitrageurs can't extract a meaningful profit from a change that small.

## How fees move

Fees move faster than A but with a hard per-block cap:

```
Each swap:
  raw_fee = smoothstep(σ)         ← compute from current volatility
  fee = 0.9×old + 0.1×raw         ← EMA smooth
  if |fee − current_fee| > 10:    ← rate limit
      fee = current_fee ± 10
  current_fee = fee
```

In practice, fees can change even if no swap happens — the `update_volatility` instruction can be called by anyone (we'll cover this in part 8). This lets keepers (bots that maintain the protocol) recalculate fees based on the current EWMA even during quiet periods.

## What a full cycle looks like

Here's the pool going through calm → storm → calm:

```
CALM PERIOD (σ ≈ 5%)
  A = A_max (e.g., 1000)  — flat curve, tight spreads
  fee = 5 bps              — cheap trading
  Lots of organic volume, LPs earning steady fees

VOLATILITY SPIKES (σ jumps to 40% in a few minutes)
  EWMA variance rises over ~10 trades
  Target A drops from 1000 → 400
  A ramp begins: slides from 1000 to 400 over 1 hour
  Raw fee rises: smoothstep says ~18 bps
  EMA and rate limit: fee crawls from 5 → 10 → 15 → 18 bps

STORM (σ ≥ 100%, sustained for hours)
  Target A → ~1 (near CPMM territory)
  A ramp continues toward 1
  Fee → 100 bps (capped)
  Curve is steep: high slippage, LPs protected
  Fee is high: compensates LP risk, deters toxic flow

RECOVERY (σ drops back to 10%)
  Target A rises back toward A_max
  A ramp reverses: slides back up over 1 hour
  Fee slides back down: 100 → 90 → ... → 10 → 5 bps
```

At no point does anything jump. The pool breathes — it responds to the market at the market's pace, not faster.

## The two safeties summarized

| Safety mechanism | What it prevents | How |
|---|---|---|
| **A ramp** (9000 slots) | Curve-transition arbitrage | A changes 0.01% per slot — no profitable arb window |
| **Fee rate limit** (10 bps/slot) | Fee manipulation | Attacker can't spike fees in one block |
| **EMA smoothing** (α=0.9) | Noise from single large trades | Fee responds to persistent trends, not one-off spikes |
| **Volatility buckets** | EWMA manipulation | Cross-reference: if EWMA says 500% but buckets show 3 trades, something's wrong |

---

[← Prev — 06 Dynamic Fees](06-dynamic-fees.md) · [Next → 08 — On Solana](08-solana-program.md)
