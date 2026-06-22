**V-AMM** • Volatility-Adaptive AMM • Builder Q2 2026 Capstone

---

**What it is:** A Solana-based automated market maker built with Anchor that uses on-chain realized volatility to automatically adjust its curve shape and swap fees — giving LPs an AMM that breathes with the market, without oracles, governance, or admin keys.

**What it does:**

- Computes realized volatility entirely on-chain from the pool's own swap history using an EWMA engine — no Chainlink, no Pyth, no off-chain data. Tick differences give log returns for free without floating-point math.
- Maps volatility to **amplification A** via `A = A_max × (1 − kσ)`, making the StableSwap curve flat when calm (tight spreads) and steep when volatile (LP protection). A ramps gradually over ~1 hour to prevent curve-transition arbitrage.
- Maps volatility to **dynamic fees** via smoothstep — sliding from 5 bps (stable pairs) to 100 bps (chaos) — with EMA smoothing and a 10 bps/slot rate limit so no single trade can spike the fee.
- Makes `update_volatility` and `update_curve` **permissionlessly callable** by anyone — no admin key, no keeper allowlist. The pool maintains itself.
- Derives every account as a PDA seeded from `pool_state`: PoolState, VolatilityState, VaultA/B, LpMint, Position — all deterministically locatable without an indexer. The pool authority PDA signs token transfers; no admin key can drain the vaults.
- Records every swap as a volatility breadcrumb in 15-min and 1-hour ring buffers that cross-check the EWMA — if the EWMA says 500% but the 1-hour bucket shows 3 trades, something is wrong.

**The volatility pipeline:**

```
swap → tick ≈ log₁.₀₀₀₁(price) → Δtick² → EWMA(variance, λ=0.95)
                                          │
                         ┌────────────────┘
                         ▼
              σ = annualize(variance)
                         │
                ┌────────┴────────┐
                ▼                  ▼
           A = A_max(1−kσ)    fee = smoothstep(σ)
                │                  │
                ▼                  ▼
           ramp 9000 slots    EMA + 10 bps cap
```

**One program, six instructions, zero oracles.**
- `initialize_pool` → create PDAs, LP mint, token vaults
- `swap` → StableSwap trade, dynamic fee, volatility breadcrumb
- `add_liquidity` / `remove_liquidity` → D-invariant LP shares
- `update_volatility` / `update_curve` → permissionless cranks

**Repo:** https://github.com/srivtx/vamm-capstone
— Program: Anchor 1.0.1, Rust
— Deployed on Solana devnet
— Full architecture diagrams, 8-step learning path (0x2vamm/), 5 deep-dive reports, 18 first-principles basics
— Research-grade — do not deploy to mainnet without an audit

[attach the three-curves SVG or the fee-curve SVG from the repo]
