<p align="center">
  <img src="https://img.shields.io/badge/Solana-devnet-9945FF?style=for-the-badge&logo=solana" />
  <img src="https://img.shields.io/badge/Anchor-1.0.1-blue?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Rust-2021-edition-orange?style=for-the-badge" />
  <img src="https://img.shields.io/badge/license-MIT-green?style=for-the-badge" />
</p>

# V-AMM

**A volatility-adaptive AMM on Solana.** The curve and fees adjust themselves — no governance, no oracles, no babysitting.

The StableSwap curve morphs between constant-sum and constant-product depending on on-chain realized volatility. When markets are calm, you get near-zero slippage like a stable swap. When things get wild, the pool tightens into CPMM territory and fees rise to protect LPs.

---

<p align="center">
  <a href="#how-it-works">How it works</a> ·
  <a href="#program">Program</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#install">Install</a>
</p>

---

## How it works

Every swap writes a price breadcrumb. An on-chain EWMA engine tracks realized volatility from these breadcrumbs — no external oracle needed. The engine then drives two outputs:

- **Curve amplification A** — high when calm (flat curve, tight spreads), low when volatile (steep curve, LP protection)
- **Dynamic fee** — smoothstep from 5 bps to 100 bps, EMA-smoothed and rate-limited to 10 bps per slot

A ramps gradually over ~1 hour (9000 slots) to prevent curve-transition arbitrage. Fees move slowly via exponential smoothing and a per-block cap. No sudden jumps.

```
Swap event → tick ≈ log₁.₀₀₀₁(price) → Δtick² → EWMA update
                                           │
                    ┌──────────────────────┘
                    ▼
        σ = annualize(variance, 15min)
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
   A = A_max · (1 − kσ)    fee = smoothstep(σ)
        │                       │
        ▼                       ▼
   ramp over 9000 slots    EMA + 10 bps/slot cap
```

## A single handler

```rust
pub fn swap(
    ctx: Context<Swap>,
    amount_in: u64,
    min_amount_out: u64,
    is_a_to_b: bool,
) -> Result<()> {
    let fee = (amount_in * pool.current_fee_bps) / 10000;
    let net_in = amount_in - fee;
    let dy = StableSwap::get_dy(&reserves, i, j, net_in, pool.curve_a_current)?;
    require!(dy >= min_amount_out, SlippageExceeded);

    // Transfer in, transfer out, update reserves...
    // Record price breadcrumb for volatility engine
    update_volatility_bucket(vol_state, price, amount_in, clock.slot)?;
}
```

Every instruction is a plain Anchor handler — no custom dispatch, no opaque macros.

## Architecture

```
vamm/
├── programs/vamm/src/
│   ├── lib.rs                    Entry point, 6 instructions
│   ├── state.rs                  PoolState, VolatilityState, PositionState
│   ├── math/mod.rs               StableSwap + volatility engine (496 loc)
│   ├── instructions/
│   │   ├── initialize_pool.rs    PDA derivations, state init
│   │   ├── swap.rs               Core trade logic + volatility breadcrumb
│   │   ├── add_liquidity.rs      Deposit + LP share minting
│   │   ├── remove_liquidity.rs   Burn + proportional withdrawal
│   │   ├── update_volatility.rs  Permissionless EWMA crank
│   │   └── update_curve.rs       Permissionless A ramp sync
│   ├── error.rs                  11 error variants
│   └── constants.rs
└── Anchor.toml
```

Full architecture diagrams in [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Instructions

| Instruction | Caller | What it does |
|---|---|---|
| `initialize_pool` | Anyone (pays rent) | Creates pool + volatility PDAs, LP mint, token vaults |
| `swap` | Trader | StableSwap trade, dynamic fee, updates volatility breadcrumb |
| `add_liquidity` | LP | Deposits token pair, receives LP shares proportional to D growth |
| `remove_liquidity` | LP | Burns LP shares, receives proportional reserves back |
| `update_volatility` | Anyone (crank) | Reads EWMA, recomputes A target + dynamic fee |
| `update_curve` | Anyone (crank) | Interpolates A between start and target over ramp window |

## State accounts

| Account | Type | Seeds |
|---|---|---|
| `PoolState` | PDA | `["pool", mint_a, mint_b, pool_id_le]` |
| `VolatilityState` | PDA | `["volatility", pool_state]` |
| `PoolAuthority` | PDA | `["authority", pool_state]` |
| `LpMint` | PDA | `["lp_mint", pool_state]` |
| `VaultA` / `VaultB` | PDA (ATA) | `["vault_a"/"vault_b", pool_state]` |
| `PositionState` | PDA | `["position", pool, user, &[0]]` |

## Math engine

**StableSwap core** — Newton-Raphson D and Y solvers, max 64 iterations, all u128 fixed-point.

**Volatility engine** — Full on-chain pipeline:

```
Δprice → tick → Δtick² → EWMA(variance, λ=0.95)
         → bucket_15min ring buffer
         → bucket_1hour ring buffer
         → annualize(variance, 900s)
         → clamp(σ, 0, 500%)
         → A(σ) = A_max · (1 − kσ)        piecewise linear, min A=1
         → fee(σ) = smoothstep, 5–100 bps   rate-limited per slot
```

See [`vamm-mathematical-architecture.md`](vamm-mathematical-architecture.md) for the full derivation.

## Install

```bash
# Clone
git clone git@github.com:srivtx/vamm-capstone.git
cd vamm-capstone/vamm

# Build
anchor build

# Test (devnet)
anchor test

# Deploy
anchor deploy --provider.cluster devnet
```

Requires Solana CLI, Anchor CLI, and Rust.

## Status

Working end-to-end on devnet. Single program, six instructions, 11 error variants, full StableSwap math. The volatility engine runs on-chain, the A ramp works, and fee synthesis is live.

Research-grade. Do not deploy to mainnet without an audit.

## License

MIT
