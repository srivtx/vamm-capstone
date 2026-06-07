# 07 — Moving Parts Together

> *A ramps down, fees ramp up. Never at the same time. Always smoothly.*

---

## The two knobs

When volatility rises, two things happen in parallel:

```mermaid
flowchart TB
    SIGMA["σ ↑ (volatility spike)"]

    SIGMA --> A_PATH
    SIGMA --> FEE_PATH

    subgraph A_PATH["A Reduction"]
        A1["target_A = A_max × (1 − kσ)"]
        A2["if |ΔA| > 10%: ramp over 9000 slots"]
        A3["A slides linearly toward target"]
    end

    subgraph FEE_PATH["Fee Increase"]
        F1["raw_fee = smoothstep(σ)"]
        F2["EMA smooth + rate limit"]
        F3["fee ticks up 0–10 bps/slot"]
    end

    A1 --> A2 --> A3
    F1 --> F2 --> F3
```

## The ramp

A doesn't jump — it **ramps**. If the target shifts from 1000 to 100, we set:

```
a_start = a_current
a_target = target_A
ramp_end = now + 9000
```

Every instruction reads the current slot and interpolates:

```
progress = (slot − start) / (end − start)
a_current = a_start + (a_target − a_start) × progress
```

## Why gradual is critical

```mermaid
flowchart LR
    subgraph BAD["Instant A change"]
        B1["A drops from 1000 → 100"]
        B2["curve suddenly steepens"]
        B3["arb trader front-runs<br/>extracts value from stale A"]
    end

    subgraph GOOD["Gradual ramp"]
        G1["A slides over ~1 hour"]
        G2["curve transitions continuously"]
        G3["no single block has<br/>a profitable arb"]
    end

    BAD -->|"don't do this"| X["LP losses"]
    GOOD -->|"do this"| Y["safe transition"]
```

## The fee cooldown

Same philosophy for fees. Even our smoothstep + EMA combo could still be gamed with carefully timed trades. The 10 bps/slot cap means:

- A trader can't spike the fee to block competitors
- A wash trader can't manufacture high fees for LP extraction
- The fee "earns" its way up — it takes sustained volatility, not a single event

## What the pool experiences

```mermaid
sequenceDiagram
    participant Market
    participant Pool

    Note over Market,Pool: Calm period
    Pool->>Pool: A = A_max (flat curve)
    Pool->>Pool: fee = 5 bps
    Market->>Pool: normal trading volume

    Note over Market,Pool: Volatility spike
    Market->>Pool: rapid price swings, high volume
    Pool->>Pool: σ rises → target_A drops → ramp begins
    Pool->>Pool: fee slides up 5→30 bps

    Note over Market,Pool: Storm
    Market->>Pool: sustained high volatility
    Pool->>Pool: A → ~1 (near CPMM)
    Pool->>Pool: fee → 100 bps
    Pool->>Pool: LPs protected, arb deterred

    Note over Market,Pool: Recovery
    Market->>Pool: volatility recedes
    Pool->>Pool: fee slides back down
    Pool->>Pool: A ramps back up
```

The pool breathes with the market. No governance votes. No keeper keys. No admin.

---

[← Prev — 06 Dynamic Fees](06-dynamic-fees.md) · [Next → 08 — On Solana](08-solana-program.md)
