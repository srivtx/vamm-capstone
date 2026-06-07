# V-AMM Architecture

> Solana Protocol Architecture — Capstone Assignment

---

## 1. Program Structure

```mermaid
graph TB
    subgraph PROGRAM["vamm (single program)"]
        ENTRY["lib.rs — entry point, 6 instructions"]

        subgraph INST["Instructions"]
            I1["initialize_pool"]
            I2["swap"]
            I3["add_liquidity"]
            I4["remove_liquidity"]
            I5["update_volatility"]
            I6["update_curve"]
        end

        subgraph MATH["Math"]
            M1["StableSwap — D invariant, Newton solver, get_dy"]
            M2["VolatilityMath — EWMA, smoothstep, annualization, A/fee mapping"]
        end

        STATE["PoolState · VolatilityState · PositionState · PriceBucket"]
    end

    ENTRY --> INST
    I2 --> M1 & M2
    I5 --> M2
    I1 & I2 & I3 & I4 & I5 --> STATE

    style PROGRAM fill:#1a1a2e,stroke:#533483,color:#ccc
    style INST fill:#2d2d4e,stroke:#533483,color:#ccc
    style MATH fill:#3d1d5e,stroke:#533483,color:#ccc
```

The program is **one crate** — no cross-program calls between V-AMM modules. Everything lives in `programs/vamm/src/`. Instructions delegate to handler functions; math is a standalone module with zero dependencies.

## 2. Account Map & PDA Tree

```mermaid
graph LR
    subgraph PDAS["Program-Derived Addresses"]
        PS["PoolState<br/>[pool + mint_a + mint_b + pool_id]"]
        VS["VolatilityState<br/>[volatility + pool_state]"]
        AUTH["PoolAuthority<br/>[authority + pool_state]"]
        LP["LpMint<br/>[lp_mint + pool_state]"]
        VA["Vault A<br/>[vault_a + pool_state]"]
        VB["Vault B<br/>[vault_b + pool_state]"]
        POS["Position<br/>[position + pool + user + 0]"]
    end

    subgraph EXTERNAL["External Accounts"]
        MA["Token Mint A"]
        MB["Token Mint B"]
        USER["User Wallet"]
    end

    PS -->|"holds keys to"| VS & AUTH & LP & VA & VB
    PS -->|"references"| MA & MB
    POS -->|"belongs to"| PS
    POS -->|"owned by"| USER
    AUTH -->|"signs for"| VA & VB & LP

    style PDAS fill:#2d6a4f,stroke:#40916c,color:#ccc
    style EXTERNAL fill:#4a4a6a,stroke:#6c6c8a,color:#ccc
```

Seven PDA types, all derived from `pool_state` or `pool_state + user`. The pool authority PDA signs CPI calls into the SPL Token program — no admin key, no multisig, no upgrade authority trick.

## 3. External Dependencies

```mermaid
graph TB
    subgraph VAMM["V-AMM Program"]
        SWAP["swap"]
        ADD["add_liquidity"]
        REMOVE["remove_liquidity"]
    end

    subgraph SPL["SPL Token"]
        TFR["transfer"]
        MINT["mint_to"]
        BURN["burn"]
    end

    subgraph SYS["Solana Runtime"]
        SP["System Program"]
        CLOCK["Clock sysvar"]
        RENT["Rent sysvar"]
        ATAP["Associated Token"]
    end

    SWAP -->|"CPI with user signer"| TFR
    SWAP -->|"CPI with PDA signer"| TFR
    ADD -->|"CPI"| TFR & MINT & ATAP
    REMOVE -->|"CPI"| BURN & TFR
    SWAP & ADD & REMOVE --> CLOCK
    ADD --> RENT

    style VAMM fill:#1a1a2e,stroke:#533483,color:#ccc
    style SPL fill:#3d1d5e,stroke:#533483,color:#ccc
    style SYS fill:#4a4a6a,stroke:#6c6c8a,color:#ccc
```

All CPIs go to the SPL Token program or the system runtime. Two signer modes: user signs for deposits and input transfers; the pool authority PDA signs for vault withdrawals and LP minting.

## 4. Swap Flow

```mermaid
flowchart TD
    START(["swap(amount_in, min_out, direction)"]) --> VALIDATE{"amount_in > 0?<br/>reserves > 0?"}
    VALIDATE -->|no| ERR1[error: InvalidReserves]
    VALIDATE -->|yes| SYNC["sync curve A to current slot"]
    SYNC --> FEE["fee = amount_in × fee_bps / 10000<br/>net = amount_in − fee"]
    FEE --> SOLVE["StableSwap::get_dy<br/>solve D → solve Y<br/>max 64 Newton iterations"]
    SOLVE -->|diverged| ERR2[error: ConvergenceFailed]
    SOLVE -->|done| CHECK{"dy >= min_amount_out?"}
    CHECK -->|no| ERR3[error: SlippageExceeded]
    CHECK -->|yes| CPI_IN["transfer input from user to vault"]
    CPI_IN --> CPI_OUT["transfer output from vault to user<br/>signed by pool_authority PDA"]
    CPI_OUT --> UPDATE["update reserves + fee accumulators"]
    UPDATE --> BREADCRUMB["record price breadcrumb<br/>update volatility bucket + EWMA"]
    BREADCRUMB --> DONE([done])

    style ERR1 fill:#c41e3a,color:#fff
    style ERR2 fill:#c41e3a,color:#fff
    style ERR3 fill:#c41e3a,color:#fff
    style DONE fill:#2d6a4f,color:#fff
```

## 5. Volatility Pipeline

```mermaid
flowchart LR
    SWAP["swap<br/>price, volume, slot"] --> TICK["tick = log₁.₀₀₀₁(price)"]
    TICK --> DELTA["Δ = tick − last_tick<br/>r² = Δ² × c²"]
    DELTA --> EWMA["v_new = 0.95·v_old + 0.05·r²"]
    EWMA --> BUCKET["15-min ring buffer[4]<br/>tick_cumulative, volume"]
    BUCKET --> ANNUAL["σ = √v × √(year/900s)<br/>clamp 0–500%"]
    ANNUAL --> A_OUT["A = A_max × (1 − kσ)<br/>min A = 1"]
    ANNUAL --> FEE_OUT["smoothstep: 5→100 bps<br/>EMA smooth + 10 bps/slot cap"]

    style SWAP fill:#0f3460,color:#ccc
    style TICK fill:#2d2d4e,color:#ccc
    style DELTA fill:#2d2d4e,color:#ccc
    style EWMA fill:#3d1d5e,color:#ccc
    style BUCKET fill:#2d6a4f,color:#ccc
    style ANNUAL fill:#7b2cbf,color:#ccc
    style A_OUT fill:#1a1a2e,color:#ccc
    style FEE_OUT fill:#1a1a2e,color:#ccc
```

The entire pipeline runs on-chain in SBPF. No floating point — everything is u128 fixed-point with scale 1e12. The tick approximation uses `leading_zeros` for approximate log₂ then multiplies by the ln(1.0001) constant.

## 6. Add / Remove Liquidity

```mermaid
flowchart TD
    subgraph ADD["add_liquidity"]
        A1(["start"]) --> A2[transfer A + B from user to vaults]
        A2 --> A3{"first LP?"}
        A3 -->|yes| A4["shares = D(deposits)"]
        A3 -->|no| A5["shares = ΔD/D × total_lp"]
        A4 --> A6[mint LP tokens to user]
        A5 --> A6
        A6 --> A7[update reserves + position state]
        A7 --> A8([done])
    end

    subgraph REMOVE["remove_liquidity"]
        R1(["start"]) --> R2["amount = shares/total × reserves"]
        R2 --> R3[burn LP tokens from user]
        R3 --> R4[transfer A + B from vaults to user]
        R4 --> R5[reduce reserves + position shares]
        R5 --> R6([done])
    end

    style ADD fill:#2d6a4f,color:#ccc
    style REMOVE fill:#2d6a4f,color:#ccc
```

Liquidity uses the StableSwap D invariant: LP shares represent a proportional claim on the total D value of the pool, not a 1:1 mapping to token amounts. This is the same mechanism Curve uses — it handles imbalanced pools correctly under changing A.

## 7. Permissionless Cranks

The protocol has no admin. Two instructions can be called by anyone:

- **`update_volatility`** — reads the EWMA variance, annualizes it, recomputes target A and dynamic fee, sets a new ramp if A has shifted >10%
- **`update_curve`** — interpolates A between start and target over the ramp window (linear, 9000 slots)

Curve A ramps gradually. Fee changes are capped at 10 bps per slot. Both are designed so a keeper bot can call them once per block without disrupting the pool.

## 8. Error Handling

```
MathOverflow          — any checked_math failure
InvalidReserves       — zero reserves or zero input amount
SlippageExceeded      — output below user's minimum
ConvergenceFailed     — Newton-Raphson hit 64 iterations without converging
InvalidTokenAccount   — mint mismatch on user token accounts
Unauthorized          — position owner doesn't match signer
PoolPaused            — pool status flag set
VolatilityPaused      — volatility state flag set
ZeroAmount            — zero passed where positive required
InvalidAmplification  — A parameter out of valid range
InvalidFee            — fee parameter out of valid range
```

All paths through swap, add, and remove have explicit validation before any CPI. Errors bubble through `Result<()>` back to the runtime — no panics, no unwraps, no `assert!`.

## 9. Key Design Decisions

1. **Single program** — no fragmentation, one deploy, one audit surface
2. **PDA pool authority** — no admin key, programmatic signing only
3. **On-chain volatility** — no oracle dependency, works on any token pair
4. **Gradual A ramp** — prevents curve-transition arbitrage
5. **Rate-limited fees** — prevents fee manipulation attacks
6. **u128 fixed-point** — no floats, SBPF-compatible, battle-tested
7. **Permissionless cranks** — anyone can maintain the pool, no keeper key
8. **Pool ID** — multiple pools per token pair with different parameters
9. **Separate volatility account** — isolated state, independent writes
10. **Standard SPL Token** — full composability with Solana DeFi
