# What is a Depeg?

A **depeg** is when a stablecoin loses its peg to the dollar. USDC is supposed to be $1. A depeg means it's trading at $0.95 or $0.80.

## How it happens

- **Bank run:** SVB collapse in March 2023 — USDC briefly traded at $0.87 because Circle had $3.3B stuck at SVB
- **Algorithmic failure:** UST/Luna in May 2022 — death spiral, went to near-zero
- **Regulatory action:** a government freezes a stablecoin issuer's reserves

## Why it destroys flat-curve pools

A USDC/USDT pool with A=2000 (flat curve) assumes both tokens are worth $1. The curve is nearly a straight diagonal line — trades happen at 1:1 with near-zero slippage.

When USDC depegs to $0.90:
- The pool STILL trades at 1:1 mechanically (the formula doesn't know about the depeg)
- Arbitrageurs buy USDC from the pool using USDT at 1:1
- They sell that USDC on the open market at $0.90
- They profit $0.10 per dollar — risk-free

The flat curve acts like a drain. It offers 1:1 exchange until one side is empty. LPs who provided the USDC watch their position get converted to worthless USDC at the full $1 price.

## Why V-AMM handles it better

When the depeg happens, volatility spikes (price is moving rapidly away from $1). V-AMM detects this:
1. EWMA captures the large price moves
2. A drops — the curve steepens, making the 1:1 drain more expensive for arbs
3. Fees rise — arbs pay 30-100 bps per trade instead of 5 bps
4. The pool resists — it doesn't drain at exactly 1:1

It's not a perfect defense (a depeg is catastrophic for any AMM), but dynamic A + dynamic fees give LPs significantly more protection than a static flat curve.
