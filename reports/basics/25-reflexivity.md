# What is Reflexivity?

**Reflexivity** is when a system's output feeds back into its input. The thing being measured is changed by the act of measuring it.

## The classic example (George Soros)

In financial markets, investors' beliefs about a stock affect their behavior (buying/selling), which affects the stock price, which affects their beliefs. There's a feedback loop. The observer and the observed are connected.

## In V-AMM

V-AMM measures volatility from its own trades. Then it changes A and fees based on that volatility. Then traders change their behavior because A and fees changed. Then volatility changes again because trading behavior changed.

```
Trader behavior → swap prices → volatility signal (EWMA)
                                      ↓
Trader behavior ← new fees/curve ← A and fee adjustment
```

This creates a feedback loop. The system is **reflexive** — traders influence the signal, and the signal influences traders.

## Why reflexivity is dangerous

**Scenario 1 — Self-fulfilling prophecy:** A few large trades spike volatility. Pool raises fees. Higher fees scare away organic traders. Only arbs remain. Volatility stays high. Fees stay high. The pool is stuck in high-fee mode even though the "real" market is calm.

**Scenario 2 — Suppression:** An attacker wants to keep fees low. They trade against every price movement, neutralizing the EWMA. Pool stays in low-fee mode. Attacker enters large positions at cheap rates. Pool never adapts.

**Scenario 3 — Oscillation:** Volatility goes up → A drops, fees rise → traders leave, volatility drops → A rises, fees drop → traders return, volatility goes up → cycle repeats.

## How V-AMM mitigates reflexivity

- **EWMA smoothing (λ=0.95):** The signal responds slowly — a few trades can't flip the regime
- **Rate limiting:** Fees change max 10 bps/slot — no sudden swings
- **A ramp:** A changes over 9000 slots — no instant curve flipping
- **Bucket cross-check:** 1-hour TWAP provides a dampened view of reality
- **Hold periods (recommended):** After a fee increase, don't immediately decrease — prevents oscillation

The adversarial analysis (report 04) opens with this: "The V-AMM is a reflexive system: traders influence the volatility signal, which changes the curve and fees, which changes how future traders behave." Understanding reflexivity is essential to understanding why the safety mechanisms exist.
