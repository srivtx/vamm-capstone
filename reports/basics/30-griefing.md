# What is Griefing?

**Griefing** is an attack where the attacker's goal isn't direct profit — it's to harm the protocol or its users, often to benefit a competing service.

## How it works

**Competitive fee spiking:**
```
1. Attacker runs a competing AMM on a different venue
2. Attacker deposits minimal liquidity into V-AMM
3. Attacker wash-trades to inflate volatility → fees jump to 100 bps
4. Aggregators (Jupiter, 1inch) see 100 bps fee → route around V-AMM
5. Organic volume flows to the attacker's competing AMM
6. Cost to attacker: small wash-trading fees
7. Gain: captured volume on competing venue
```

The attacker didn't directly profit from V-AMM. They made V-AMM unattractive so traders went elsewhere.

## Other griefing patterns

**Flat-locking:** Attacker suppresses the volatility signal (trades against every directional move) to keep the pool in flat-curve mode. They then enter a massive position with near-zero slippage. After entering, they stop suppressing and let the pool steepen — locking competitors out.

**Withdrawal griefing:** Attacker front-runs LP withdrawals by triggering a curve transition right before the withdrawal, reducing the LP's payout.

## V-AMM's defenses

**External oracle floor:** Even if on-chain volatility is suppressed, an external oracle provides a minimum volatility reading that can't be gamed. The pool can't be "flat-locked" below the external signal.

**Griefing surcharge:** If a single address accounts for >X% of recent trades, charge them an extra fee. Makes sustained wash-to-grief expensive.

**Fee-accrual lag:** The fee a trade pays is based on volatility BEFORE the trade. An attacker can't pump volatility and then immediately trade at the low old fee.

**Cooldown:** Once fees spike, they can't spike again for N blocks. Prevents rapid oscillation that traps legitimate traders.
