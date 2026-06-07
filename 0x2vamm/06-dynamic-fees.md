# 06 — Dynamic Fees

> *When the market gets wild, LPs need a bigger cut.*

---

## Quick vocabulary

A **basis point** (bp) is one hundredth of a percent. 1 bp = 0.01%. So:
- 5 bps = 0.05%
- 30 bps = 0.30%
- 100 bps = 1.00%

Swap fees in AMMs are measured in basis points. The fee is taken from the input amount before the trade executes.

## What fee should we charge?

Academic research (papers by Campbell, Baggiani, and others) all point to the same idea: **fees should scale with volatility.**

| Market condition | Volatility (σ) | What's happening | Good fee |
|---|---|---|---|
| Stable, pegged | ≤ 15% | Price barely moves | 5 bps (0.05%) — cheap, attract volume |
| Normal | 15%–75% | Regular price action | Ramp from 5 to 30 bps |
| High | 75%–120% | Significant swings | Ramp from 30 to 100 bps |
| Extreme | ≥ 120% | Chaos | Cap at 100 bps (1%) — protect LPs |

Intuition: when the market is calm, fees should be low to attract traders. When it's wild, fees should be high to compensate LPs for the risk they're taking. The signal is σ, our volatility reading from part 5.

## The smoothstep function

We could just set hard thresholds: σ < 15% → 5 bps, 15% ≤ σ < 75% → 30 bps, etc. But that creates **step jumps** — at 14.9% you pay 5 bps, at 15.1% you pay 30 bps. Arbitrageurs would time trades to exploit these boundaries.

Instead we use a **smoothstep** — a mathematical curve that transitions smoothly between values:

```
smoothstep(t) = 3t² − 2t³
```

Where `t` goes from 0 to 1 as we move through a volatility band.

What this produces:

```
Fee (bps)
   100 ┤                              ┌──────
       │                         ┌────┘
    50 ┤                    ┌────┘
       │              ┌─────┘
     5 ┤──────────────┘
       └──────┬───────┬───────┬──────────→ σ
             15%     75%    120%

The fee rises smoothly — no jumps, no cliffs, no thresholds to exploit.
```

The smoothstep has a useful property: it's flat at the start and end of each band. This means when volatility is very low (well below 15%) or very high (well above 120%), the fee doesn't fluctuate — it stays steady. The fee only changes meaningfully during the transition zones.

## EMA smoothing (again)

Just like with the variance EWMA in part 5, we don't want the fee to twitch on every trade. We run it through another EWMA:

```
fee_smoothed = 0.9 × old_fee_smoothed + 0.1 × raw_fee_from_smoothstep
```

This gives roughly a 10-update half-life. If volatility spikes for one trade and goes back to calm, the fee barely moves. If volatility stays elevated for 10+ trades, the fee slides up appropriately.

## Rate limiting

Even with EMA smoothing, a regime change from calm to chaos could push the fee from 5 to 100 bps in a few dozen trades. That still creates small windows where informed traders can act ahead of the fee change.

So we add one more guard: **a per-block cap.**

```
|fee_new − fee_old| ≤ 10 bps per slot
```

A "slot" is Solana's block time — roughly 400 milliseconds. The fee can only change by 10 basis points (0.1%) per slot. A full shift from 5 bps to 100 bps takes:

```
(100 − 5) / 10 = 9.5 ≈ 10 slots ≈ 4 seconds
```

This is fast enough that the fee responds to real market shifts, but slow enough that:
- A single manipulative trade can't spike the fee
- An attacker can't front-run the fee increase and extract value
- The fee "earns" its way up through sustained volatility

## The complete fee pipeline

```
volatility σ (from part 5)
    │
    ├→ compute_fee(σ):
    │     if σ ≤ 15%:  return 5 bps
    │     if 15% < σ < 75%:  smoothstep ramp 5→30
    │     if 75% ≤ σ < 120%: smoothstep ramp 30→100
    │     if σ ≥ 120%: return 100 bps
    │
    ├→ EMA smooth:  fee = 0.9×old + 0.1×raw
    │
    ├→ Rate limit:  clamp |fee_new − fee_old| ≤ 10 bps
    │
    └→ Update pool's current_fee_bps
```

Every swap that hits the pool pays this dynamically computed fee. The fee changes happen automatically via the same mechanism — no governance vote, no admin key, no human in the loop.

## What we now have

Two numbers that respond to volatility:

1. **A** (amplification) — controls curve shape: flat when calm, curved when volatile
2. **fee** (swap fee) — controls LP compensation: cheap when calm, expensive when volatile

Both are driven by the same signal (σ). Both update automatically. The remaining question: **how do they move together without breaking the pool?**

---

[← Prev — 05 On-Chain Volatility](05-on-chain-volatility.md) · [Next → 07 — Moving Parts Together](07-moving-parts-together.md)
