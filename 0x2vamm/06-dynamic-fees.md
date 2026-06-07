# 06 — Dynamic Fees

> *When the market gets wild, LPs need a bigger cut.*

---

## Quick vocabulary

A **basis point** (bp) is one hundredth of a percent: `1 bp = 0.01%`.

| bps | Percent | Example |
|---|---|---|
| 1 bp | 0.01% | Microscopic fee |
| 5 bps | 0.05% | Very cheap — stable pairs |
| 30 bps | 0.30% | Standard for normal volatility |
| 100 bps | 1.00% | Expensive — high volatility protection |

The fee is taken from the input amount **before** the trade executes. If you swap 100 USDC at 30 bps, the pool takes 0.30 USDC as fee, and 99.70 USDC goes into the trade calculation.

## The fee spectrum

Academic research converges on a simple rule: **fees should scale with volatility.** Low volatility = low fee (attract volume). High volatility = high fee (protect LPs from adverse selection).

| Volatility (σ) | Market condition | Fee | Why |
|---|---|---|---|
| ≤ 15% | Stable, pegged | 5 bps | Price barely moves. LPs face almost no IL/LVR. Make it cheap. |
| 15%–75% | Normal | Ramp 5 → 30 bps | Moderate risk. Fee rises smoothly with volatility. |
| 75%–120% | High | Ramp 30 → 100 bps | Significant risk. LP needs meaningful compensation. |
| ≥ 120% | Extreme | 100 bps (capped) | Maximum protection. Deters toxic flow. Never goes above 1%. |

## Why not just use hard thresholds?

We could say: "σ < 15% → 5 bps, σ ≥ 15% → 30 bps." But that creates a cliff:

```
At σ = 14.9%: fee = 5 bps   (very cheap)
At σ = 15.1%: fee = 30 bps  (6× more expensive)

An attacker watching the on-chain volatility could time their trades
to exploit the gap — trade heavily just before crossing 15% to get
the cheap rate, or push σ across the threshold to spike fees and
block competitors.
```

Instead we use a **smoothstep** — a mathematical curve that transitions continuously:

```
smoothstep(t) = 3t² − 2t³
```

Where `t` goes from 0 (start of a band) to 1 (end of a band). Let's see what this produces in practice:

### Band 1: σ from 15% to 75%

| σ | t (position in band) | smoothstep(t) | Fee |
|---|---|---|---|
| 15% | 0.00 | 0.000 | **5 bps** |
| 30% | 0.25 | 0.156 | 5 + 25×0.156 = **9 bps** |
| 45% | 0.50 | 0.500 | 5 + 25×0.500 = **18 bps** |
| 60% | 0.75 | 0.844 | 5 + 25×0.844 = **26 bps** |
| 75% | 1.00 | 1.000 | **30 bps** |

### Band 2: σ from 75% to 120%

| σ | t (position in band) | smoothstep(t) | Fee |
|---|---|---|---|
| 75% | 0.00 | 0.000 | **30 bps** |
| 86% | 0.25 | 0.156 | 30 + 70×0.156 = **41 bps** |
| 98% | 0.50 | 0.500 | 30 + 70×0.500 = **65 bps** |
| 109% | 0.75 | 0.844 | 30 + 70×0.844 = **89 bps** |
| 120% | 1.00 | 1.000 | **100 bps** |

Notice: the fee rises gently at the start of each band, steepens in the middle, and flattens again at the end. This S-curve has a key property: **zero slope at the boundaries.** At exactly 15%, the fee isn't twitching — it's stable. At exactly 75%, the transition between bands is seamless. No cliffs, no thresholds, no exploit windows.

## EMA smoothing: don't twitch on every trade

Raw volatility (σ) can spike on a single large trade. If we fed raw σ directly into smoothstep, the fee would bounce around constantly. So we run it through **another EWMA** (same technique we used for variance in part 5):

```
fee_smoothed = 0.9 × fee_old_smoothed + 0.1 × fee_raw
```

Concrete example: fee has been stable at 5 bps. A volatility spike pushes raw fee to 50 bps:

| Update # | Old smoothed | Raw fee | New smoothed |
|---|---|---|---|
| 1 | 5 | 50 | 0.9×5 + 0.1×50 = 9.5 |
| 2 | 9.5 | 50 | 0.9×9.5 + 0.1×50 = 13.6 |
| 3 | 13.6 | 50 | 0.9×13.6 + 0.1×50 = 17.2 |
| 5 | 21.9 | 50 | 0.9×21.9 + 0.1×50 = 24.7 |
| 10 | 37.0 | 50 | 0.9×37.0 + 0.1×50 = 38.3 |
| 20 | 46.9 | 50 | 0.9×46.9 + 0.1×50 = 47.2 |

It takes about 10 updates to get most of the way there, and 20+ to fully settle. A single spike barely moves the needle (update #1 only went from 5 to 9.5). Sustained high volatility pushes it steadily toward the raw value.

## Rate limiting: a per-block speed cap

Even with EMA smoothing, fees could jump 30+ bps in ~10 trades. That's fast enough for an attacker to front-run — push volatility up with a large trade, then trade again before the higher fee lands.

So we add a hard cap:

```
|fee_new − fee_old| ≤ 10 bps per slot
```

A **slot** is Solana's block time — roughly 400 milliseconds. The fee can change at most 10 basis points per block. A full shift from 5 bps to 100 bps takes:

```
(100 − 5) / 10 = 9.5 slots ≈ 4 seconds
```

Slot-by-slot walkthrough during a volatility spike:

| Slot | Fee before | Raw target | After EMA | After rate limit |
|---|---|---|---|---|
| 0 | 5 | — | — | **5** |
| 1 | 5 | 30 | 8 | **8** (rate limit allows +10, but EMA only wants +3) |
| 2 | 8 | 50 | 12 | **12** |
| 5 | 21 | 80 | 27 | **27** |
| 10 | 51 | 100 | 56 | **56** |
| 15 | 75 | 100 | 78 | **78** |
| 20 | 89 | 100 | 90 | **90** |
| 25 | 95 | 100 | 96 | **96** |
| 30 | 98 | 100 | 98 | **98** |

The fee "earns" its way up through sustained volatility. An attacker can't spike it in one block. A real market regime change is reflected within a few seconds.

## The complete fee pipeline

```
volatility σ (from part 5)
    │
    ├─ compute_fee(σ):
    │    if σ ≤ 15%:           → 5 bps
    │    if 15% < σ < 75%:     → smoothstep(σ−15/60) × 25 + 5
    │    if 75% ≤ σ < 120%:    → smoothstep(σ−75/45) × 70 + 30
    │    if σ ≥ 120%:          → 100 bps (capped)
    │
    ├─ EMA smooth:
    │    smoothed = 0.9 × old_smoothed + 0.1 × raw
    │
    ├─ Rate limit:
    │    if |smoothed − current| > 10:  clamped to current ± 10
    │
    └─ Update pool's current_fee_bps
```

Every trade pays this fee. The fee updates automatically with volatility — no governance vote, no admin key, no keeper negotiation. The same pipeline that measures volatility also sets the price of trading.

---

[← Prev — 05 On-Chain Volatility](05-on-chain-volatility.md) · [Next → 07 — Moving Parts Together](07-moving-parts-together.md)
