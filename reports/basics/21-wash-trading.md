# What is Wash Trading?

**Wash trading** is trading back and forth with yourself to create fake activity. In an AMM context, it's used to manipulate on-chain metrics — volume, price, and most dangerously, volatility.

## How it attacks V-AMM

V-AMM's volatility engine watches trade prices. An attacker who wants to trick the pool into high-fee mode:

```
1. Attacker deposits as an LP (so they earn fees from future trades)
2. Attacker starts wash trading: buy SOL, immediately sell SOL, repeat
3. Each trade pair creates a price movement → EWMA rises
4. Pool thinks the market is volatile → raises fees to 100 bps
5. Legitimate traders pay the inflated fee
6. Attacker earns 40% of those inflated fees as an LP
7. Attacker's wash trades cost 5 bps (which they mostly earn back as LP)
```

The attack is profitable because: cost of wash trading is tiny (fees paid to yourself via LP share rebate), and gain from inflated fees on organic volume can be huge.

## Why it's hard to detect

Legitimate high volatility and wash-trading-based fake volatility look identical if you only watch prices. The EWMA just sees tick differences — it doesn't know if the trades were organic or manufactured.

## V-AMM's defenses

**EWMA smoothing (λ=0.95):** A single wash trade pair barely moves the needle. Sustained manipulation over hundreds of trades would be needed — expensive in fees and slippage.

**Volume-weighted buckets:** The 15-min buckets track actual volume. If the EWMA says 500% volatility but the bucket shows 100 trades of $1 each (total volume = $100), the system knows it's wash trading. Real volatility events have large real volume.

**Minimum trade size threshold:** The volatility engine can ignore trades below a minimum size. A $1 wash trade doesn't count. A $10,000 trade does.

**Cross-reference:** EWMA (fast, smooth) vs 1-hour bucket TWAP (slow, volume-weighted). If they disagree significantly, the system flags potential manipulation.
