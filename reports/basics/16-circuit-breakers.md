# What are Circuit Breakers?

A **circuit breaker** is a safety mechanism that automatically stops or slows down a system when it detects dangerous conditions. The term comes from electrical engineering — a physical switch that trips when current is too high.

## In DeFi

When a protocol detects anomalous activity — a flash crash, a manipulation attempt, an oracle failure — a circuit breaker can:
- Pause certain operations
- Switch to a safer mode
- Cap damages until the situation is assessed

The key: **circuit breakers act automatically.** No governance vote, no multisig, no human waking up at 3 AM. The code detects the problem and reacts in the same transaction.

## Examples in V-AMM

**Emergency steepening.** If a single trade moves the pool price by more than 2%, immediately drop A to minimum and raise fees to maximum. This stops toxic flow during a flash crash.

```
Normal:       A = 500, fee = 5 bps
Crash trade:  price moves 3% in one swap
Reaction:     A → 1, fee → 100 bps  (happens atomically)
Result:       next trades face steep curve + high fee → attack becomes expensive
```

**Volatility pause.** If the on-chain volatility signal and the time-bucket cross-check disagree by more than a threshold, pause volatility updates. This prevents a manipulated EWMA from driving the pool into a bad state.

**Fee rate limit.** The 10 bps/slot cap is a circuit breaker in disguise. It says: "no matter what the volatility signal says, fees cannot move faster than this." Prevents fee-spike attacks.

## What makes a good circuit breaker

- **Fast** — acts in the same transaction, not after a governance delay
- **Reversible** — doesn't permanently break the protocol; normal operation resumes when conditions normalize
- **Expensive to trigger maliciously** — an attacker shouldn't be able to trip the breaker to grief users
- **Well-calibrated** — doesn't false-positive on legitimate but unusual activity

## Other DeFi examples

- **MakerDAO's Debt Ceiling**: caps how much DAI can be minted against each collateral type
- **Lending protocol liquidation thresholds**: if collateral value drops below X%, liquidate the position
- **Chainlink's circuit breakers**: if an oracle price deviates >X% from the last reported price, pause updates

The adversarial analysis report references "circuit breakers" throughout — each is a safety pattern that limits damage when something goes wrong.
