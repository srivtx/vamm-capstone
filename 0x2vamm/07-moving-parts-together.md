# 07 — Moving Parts Together

> *A ramps down, fees ramp up. Never abruptly. Always smoothly.*

---

## The two knobs, one source

We now have two things that change based on σ (volatility):

| When σ rises... | A (amplification) | Fee (swap cost) |
|---|---|---|
| **What changes** | Curve shape: how much slippage exists | Trading cost: how much LPs earn per trade |
| **Direction** | A **drops** — curve steepens | Fee **rises** — more LP compensation |
| **Speed** | Slow: ~1 hour to fully change | Fast but capped: 10 bps per slot (~4 sec to full range) |
| **Purpose** | Prevent LP drainage (by making the pool act more like constant product) | Compensate LPs for the increased IL/LVR risk |
| **Trigger** | Only when ΔA > 10% (ignore noise) | Every swap + every permissionless crank |

They share the same signal but move at different speeds for different reasons. A changes slowly because sudden curve shape changes create arbitrage opportunities. Fees change faster because LPs need timely compensation when volatility spikes.

## How A ramps (with concrete numbers)

A never jumps. When the target changes, the pool sets up a linear ramp:

```
A ramp is triggered when |target_A − current_target_A| > 10% × current_target_A

Setup:
  a_start    = current A value (what the pool has now)
  a_target   = new target A (what volatility says it should be)
  start_slot = current slot number
  end_slot   = start_slot + 9000   (roughly 1 hour)

Then on every instruction that reads A:
  elapsed    = current_slot − start_slot
  progress   = elapsed / 9000      (goes from 0 to 1)
  a_current  = a_start + (a_target − a_start) × progress
```

Concrete example: A drops from 1000 to 100:

| Slot | Elapsed | Progress | A_current |
|---|---|---|---|
| 0 | 0 | 0.000 | 1000 |
| 900 | 900 | 0.100 | 1000 − 900×0.10 = **910** |
| 1800 | 1800 | 0.200 | **820** |
| 2700 | 2700 | 0.300 | **730** |
| 4500 | 4500 | 0.500 | **550** (halfway) |
| 6750 | 6750 | 0.750 | **325** |
| 9000 | 9000 | 1.000 | **100** (done) |

At slot 900 (about 6 minutes in), A has only moved from 1000 to 910 — a 9% change. At any given moment, a trader sees a pool that's nearly identical to what it was 400ms ago. The ramp is designed to be invisible to individual trades.

Now the reverse: volatility drops, A rises from 100 back to 1000:

| Slot | Elapsed | Progress | A_current |
|---|---|---|---|
| 0 | 0 | 0.000 | 100 |
| 4500 | 4500 | 0.500 | 100 + 900×0.50 = **550** |
| 9000 | 9000 | 1.000 | **1000** |

The ramp works both directions. No direction is privileged. The pool returns to flat-curve mode at exactly the same speed it left.

## Why ramping matters: the sandwich attack

If A jumped instantly from 1000 to 100:

```
Before the jump (A=1000):
  Pool: 100 USDC, 1 SOL
  Price: ~100 USDC/SOL (very tight, almost no spread)
  A trade of 10 USDC gets you ~0.0999 SOL

After the jump (A=100):
  Pool: 100 USDC, 1 SOL (same reserves!)
  Price: still ~100 USDC/SOL, BUT the curve is now curved
  A trade of 10 USDC gets you ~0.0909 SOL (more slippage)
```

An arbitrageur watching the chain:
1. Sees the A-change transaction in the mempool
2. Sends their own transaction right before it: **buys SOL at the old tight A=1000 price**
3. The A-change lands: curve steepens, SOL price adjusts
4. Arbitrageur sells SOL back (or sells elsewhere at the true market price)
5. **Profit = the price difference caused by the shape change**

The LP absorbed the loss — the arbitrageur extracted value from the transition itself.

With a 9000-slot ramp, the transition takes 1 hour. Each individual block changes A by ~0.011%. The price impact of that change is microscopic — nowhere near enough to cover gas costs, let alone turn a profit. **The ramp eliminates the arbitrage window.**

## How fees move (faster, but capped)

Fees are updated on every swap and whenever `update_volatility` is called:

```
Every update:
  σ         = read current EWMA variance, annualize
  raw_fee   = compute_fee(σ)           → smoothstep mapping
  ema_fee   = 0.9 × old_ema + 0.1 × raw   → smooth over ~10 updates
  limited   = clamp(ema_fee, current − 10, current + 10)  → rate limit
  current_fee = limited
```

## The full cycle: calm → storm → calm

Let's trace through a complete market cycle with a USDC/SOL pool (A_max = 1000):

```
━━━ CALM PERIOD (σ ≈ 5%, hour 0–10) ━━━
  A = 1000 (flat curve, tight spreads)
  fee = 5 bps (cheap)
  Pool: balanced near 100 USDC, 1 SOL
  Price: ~100 USDC/SOL
  What's happening: organic volume, small trades, LPs collecting fees

━━━ VOLATILITY ARRIVES (σ rises to 40% over ~2 minutes) ━━━
  EWMA variance rises over ~10 trades
  Raw fee from smoothstep: 40% → ~11 bps
  EMA-smoothed fee: crawls 5 → 8 → 10 → 11 bps

  Target A: A_max × (1 − k×0.40) = 1000 × (1 − 2×0.40)
          = 1000 × 0.20 = 200
  ΔA = 1000 − 200 = 800, which is 80% of current → exceeds 10% threshold
  A ramp triggered: 1000 → 200 over 9000 slots

  After 30 minutes (4500 slots): A = 600, fee = ~15 bps
  Pool is still mostly flat but starting to curve

━━━ STORM (σ ≥ 100%, sustained for 4 hours) ━━━
  After 1 hour: A = 200, fee = ~30 bps
  But σ keeps climbing...

  Target A: 1000 × (1 − 2×1.0) → negative → clamped to A=1
  New ramp: A=200 → 1 over another 9000 slots

  Fee: smoothstep for σ=100% → ~75 bps
  EMA and rate limit push it: 30 → 40 → 50 → ... → 75 bps

  After 1 more hour: A = 1 (near CPMM), fee = 75 bps
  Pool: trades have significant slippage, LPs are protected
  Fee: meaningful compensation for the risk

  σ keeps rising to 150% → fee capped at 100 bps
  A stays at 1 (minimum)

━━━ RECOVERY (σ drops back to ~10%) ━━━
  EWMA variance decays (σ stays low for many trades)
  Raw fee: 10% → 5 bps
  Fee slides down: 100 → 90 → ... → 10 → 5 bps (rate limit caps the descent too)

  Target A: 1000 × (1 − 2×0.10) = 1000 × 0.80 = 800
  ΔA = 800 − 1 = 799, which is 79,900% → exceeds threshold
  A ramp triggered: 1 → 800 over 9000 slots

  Market stays calm. After 1 hour: A = 800, fee = 5 bps
  Pool is mostly flat again, spreads are tight, volume returns.

  σ stays at 5% for a while. Target A rises to 1000.
  Final ramp: 800 → 1000. After 1 more hour: A = 1000, fee = 5 bps.
  Pool is back to calm-mode state.
```

**At no point does anything jump.** The pool breathes with the market — it takes hours to fully transition between regimes, and every individual block sees only a microscopic change.

## Safety summary

| Mechanism | Speed | What it prevents | Attack surface closed |
|---|---|---|---|
| **A ramp** | ~1 hour (9000 slots) | Curve-transition sandwich arbitrage | 0.01% A change per slot = no profit |
| **Fee rate limit** | 10 bps/slot (~4 sec full range) | Fee spike manipulation | Attacker needs 10+ blocks to max out fees |
| **EMA smoothing** | ~10-update half-life | Single-trade fee whipsaw | Fee responds to trends, not noise |
| **Volatility buckets** | 15-min + 1-hour windows | EWMA manipulation via wash trading | Cross-reference catches EWMA/bucket mismatch |
| **10% A threshold** | Only triggers on meaningful change | Constant micro-ramps from noise | Minor σ wobbles don't trigger ramps |

---

[← Prev — 06 Dynamic Fees](06-dynamic-fees.md) · [Next → 08 — On Solana](08-solana-program.md)
