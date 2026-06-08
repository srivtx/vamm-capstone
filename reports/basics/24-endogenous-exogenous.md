# Endogenous vs Exogenous Signals

Every adaptive system needs inputs. Where those inputs come from determines how trustworthy they are.

## Endogenous

**Endogenous = coming from inside the system.**

V-AMM's volatility signal is endogenous: it's computed from the pool's own swap history. Ticks, EWMA, ring buffers — all derived from trades that happened inside this pool.

**Advantages:** Always available. No external dependency. No oracle cost. Works for any token pair.

**Disadvantages:** Can be manipulated. An attacker who trades in the pool directly influences the signal. This is the "reflexivity problem" — the signal the pool uses is affected by the same traders the signal is supposed to protect against.

## Exogenous

**Exogenous = coming from outside the system.**

An external oracle like Pyth or Chainlink providing a volatility feed. Or a CEX (centralized exchange) volatility calculation from order book data.

**Advantages:** Hard to manipulate. An attacker can't easily move Binance's order book to affect the oracle. Provides an "ungameable floor."

**Disadvantages:** Costs money (oracle fees). May not exist for every token pair. Adds latency. Creates a dependency — if the oracle goes down, the signal goes dark.

## How V-AMM uses both

The current implementation is fully endogenous (on-chain EWMA). The adversarial analysis (report 04) recommends a **hybrid approach** for production:

```
Primary signal:   endogenous EWMA (fast, always available)
Safety floor:     exogenous oracle (Pyth/Switchboard volatility feed)
Circuit breaker:  if endogenous > 1.2 × exogenous, flag as manipulation
                  if endogenous < 0.5 × exogenous, flag as manipulation
```

The MAX of both signals is used — the external oracle sets a floor that wash trading can't push below. The internal EWMA provides responsiveness that external oracles (updated every few seconds) can't match.

## Why this distinction matters

Report 04 repeatedly discusses "oracle manipulation" and "external oracle augmentation." Understanding endogenous vs exogenous is essential to following those arguments. Endogenous signals are responsive but gameable. Exogenous signals are robust but slow. Production systems use both.
