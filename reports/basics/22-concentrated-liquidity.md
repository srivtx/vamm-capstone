# What is Concentrated Liquidity?

Concentrated liquidity is Uniswap V3's approach to AMM design. Instead of providing liquidity across the entire price range (0 to ∞), LPs choose a specific price range where their capital is active.

## How it works

```
Constant product (Uniswap V2):
  LP provides $1000 of USDC and $1000 of ETH
  Their liquidity is spread across ALL possible prices (0 to ∞)
  Most of their capital sits idle — ETH will never go to $1 or $1,000,000

Concentrated liquidity (Uniswap V3):
  LP provides $2000 total, but chooses a range: ETH between $1800 and $2200
  All $2000 of capital is concentrated in this narrow band
  Within the band: acts like a bigger pool (more liquidity, less slippage)
  Outside the band: LP's capital is inactive (all USDC or all ETH)
```

The LP gets more fee income per dollar of capital — but only if the price stays in their chosen range. If the price leaves the range, they stop earning fees entirely and must manually reposition.

## Why V-AMM chose a different path

| | Uniswap V3 | V-AMM |
|---|---|---|
| Liquidity shape | LP picks a range | Full-range, curve shape adapts automatically |
| LP effort | Active management (reposition when price moves) | Passive (deposit and forget) |
| Fee model | LP picks a tier at entry | Dynamic — fee adjusts with volatility |
| Curve adaptation | LP manually moves position | A changes automatically based on volatility |
| Capital efficiency | Very high (when in range) | Lower, but never goes idle |
| LP expertise required | High (must predict volatility and price range) | Low (no decisions to make) |

V-AMM is designed for passive LPs — people who want to deposit and earn fees without monitoring price ranges or adjusting positions. The tradeoff is lower capital efficiency for zero management overhead.

## The comparison in reports

When report 00 says "Existing AMMs do concentrated liquidity: Uniswap v3, Orca Whirlpools" — it's positioning V-AMM as an alternative approach. Instead of asking LPs to predict the future (choose ranges and tiers), V-AMM adapts the pool itself based on what's actually happening.
