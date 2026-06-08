# What is Defense-in-Depth?

**Defense-in-depth** is a security strategy that layers multiple protections. If one layer fails, the next one catches the attack. No single point of failure.

## The analogy

A castle doesn't rely on just one wall. It has:
- Outer moat (first obstacle)
- Outer wall (second obstacle)
- Inner wall (third obstacle)
- Keep (last resort)

An attacker must defeat ALL layers. A defender only needs ONE layer to hold.

## V-AMM's four layers

The adversarial analysis (report 04) structures mitigations in layers:

**Layer 1 — Oracle hardening:**
Make the volatility signal expensive to manipulate.
- Volume-weighted statistics (small trades don't count)
- Bucket median filtering (outliers rejected)
- EWMA smoothing (single spikes barely register)

**Layer 2 — Transition safety:**
When A and fees change, the transition itself must not create an arbitrage.
- Gradual A ramp (9000 slots, ~1 hour)
- Rate-limited fee changes (10 bps/slot max)
- A-change threshold (only trigger on >10% difference)

**Layer 3 — Anti-griefing:**
Attackers must pay more than they can extract.
- Fee-accrual lag (fee from before the trade, not after)
- Griefing surcharge (if one address does >X% of trades)
- Dual-track fee: MAX(endogenous_vol, exogenous_vol)

**Layer 4 — Circuit breakers:**
Catch what the first three layers miss.
- Emergency steepening on >2% single-trade price impact
- Volatility pause if EWMA and bucket TWAP disagree
- LP withdrawal lock during transitions

## Why layers matter

An attacker might defeat Layer 1 (sophisticated wash trading that mimics real volume). But they'd still face Layer 2 (can't profit from the transition itself). And Layer 3 (their cost exceeds their gain). And Layer 4 (suspicious activity triggers a pause).

The system doesn't need to be perfect at any one layer. It needs to be good enough at all of them that the combined cost of attack exceeds any possible profit.
