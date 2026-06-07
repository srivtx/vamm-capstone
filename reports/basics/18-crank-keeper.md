# What is a Crank / Keeper?

A **crank** (also called a **keeper**) is an automated bot that calls permissionless maintenance instructions on a protocol. It keeps the protocol running when no human is watching.

## Why protocols need cranks

Some operations need to happen regularly but don't require human decision-making:
- Updating a volatility reading from accumulated data
- Closing stale time buckets
- Progressing a parameter ramp
- Liquidating underwater loans

These operations are **deterministic** — the right answer is always the same given the current state. You don't need a human to decide what to do; you just need someone (or something) to send the transaction.

## How it works in V-AMM

Two instructions are permissionless — anyone can call them:

**`update_volatility`:**
1. Reads the current EWMA variance
2. Annualizes it
3. Computes new A target and fee
4. Updates pool state

**`update_curve`:**
1. Reads the current slot
2. Interpolates A between start and target
3. Updates `curve_a_current`

A keeper bot runs these once per block (every ~400ms on Solana). The bot pays a tiny transaction fee (~0.000005 SOL). In return, the pool stays calibrated.

## Why permissionless?

- **No admin key** — can't be censored or shut down
- **Anyone can run one** — redundancy; if one keeper goes down, others continue
- **No trust required** — the instructions only do what the math allows; a malicious keeper can't steal funds
- **Incentive-compatible** — keepers can be tipped from protocol fees (future feature)

## Examples in other protocols

- **MakerDAO**: keepers liquidate underwater CDPs (Collateralized Debt Positions) and earn a liquidation bonus
- **Aave**: keepers liquidate unhealthy loans
- **Perpetual protocols**: keepers update funding rates
- **Oracle networks**: keepers push price updates on-chain

Keeper networks are the autonomic nervous system of DeFi — they handle the repetitive, deterministic work so humans don't have to.
