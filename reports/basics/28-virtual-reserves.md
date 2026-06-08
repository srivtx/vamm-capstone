# What are Virtual Reserves?

**Virtual reserves** are a mathematical trick used in StableSwap to make the curve safer during A transitions. They adjust the "effective" reserves without actually moving tokens.

## The problem

When A changes (e.g., from 1000 to 100 on an imbalanced pool), the pool's internal price mechanically shifts because the curve shape changed:

```
Before A change (A=1000, reserves 60/40):
  Price ≈ $0.95 (the flat curve forces price near 1:1)

After A change (A=100, same reserves 60/40):
  Price ≈ $0.667 (the curved pool prices the imbalance honestly)

Arbitrage gap: $0.95 → $0.667 = 42.5% profit for anyone who trades
during the transition.
```

The price changed by 42.5% purely because A changed. No tokens moved. This is a "mechanical gap" — an arbitrage opportunity created by the parameter change itself.

## How virtual reserves fix it

Instead of changing A on the actual reserves, you adjust the "virtual" reserves so the price stays the same before and after the A change:

```
Before: actual reserves = (60, 40), A=1000, price = $0.95
Adjust virtual reserves so that with A=100, price is still $0.95:
  virtual_reserves = f_inverse(price=$0.95, A=100) ≈ (55, 45)

Now: virtual reserves = (55, 45), A=100, price = $0.95 ✓
The price didn't move during the transition. No arbitrage gap.
```

The virtual reserves then gradually converge to the actual reserves over time (or over the ramp period). The transition is smooth — the price stays continuous.

## Where it appears in the research

Report 01 mentions virtual reserves briefly ("Virtual reserve adjustment at transition"). Report 04 lists it as a mitigation for curve transition arbitrage ("Virtual reserve adjustment. When steepening, adjust the virtual reserves so the marginal price equals the last traded price before applying the new A").

**Why V-AMM uses gradual ramping instead:**

V-AMM chose a different approach — instead of virtual reserves, A ramps gradually over 9000 slots. At each slot, A changes by ~0.01%. The price impact of a 0.01% A change is microscopic. No virtual reserve math needed; the ramp IS the safety mechanism.

Both approaches solve the same problem: prevent mechanical price gaps during A transitions. Gradual ramping is simpler to implement and verify. Virtual reserves are more mathematically elegant but complex.
