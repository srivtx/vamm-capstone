# 04 — Why Volatility Matters

> *Markets don't sit still. Your AMM shouldn't either.*

---

## What is volatility?

Volatility means how much and how fast a price moves up and down.

- **Low volatility:** USDC/USDT most days. Price stays glued near $1. Small, slow movements.
- **High volatility:** A meme coin during a pump. Price swings 50% in an hour, then crashes 80%.

Volatility isn't good or bad — it just describes how "jumpy" the price is. But it matters enormously for AMM design, because LP losses scale with volatility.

## What LPs lose: the two big ones

### 1. Impermanent Loss (IL)

You put $100 of token A and $100 of token B into a pool. If the price of A doubles relative to B, and you withdraw, you get back less total value than if you'd just held both tokens in your wallet.

Why? Because the pool automatically rebalances — it sells the rising token and buys the falling token to maintain the formula. Great for traders, expensive for LPs.

The loss is "impermanent" because it only becomes real when you withdraw. If the price returns to your entry point, the loss disappears. But if it doesn't return, the loss is permanent.

**IL gets worse the further price moves from your entry point.** In a high-A (flat curve) pool, IL hits faster because the pool aggressively rebalances to keep the price near 1:1. In a low-A (curved) pool, rebalancing is gentler.

### 2. Loss-Versus-Rebalancing (LVR)

This is a newer concept but crucial. Imagine the true market price of SOL moves from $100 to $105. The AMM's internal price is still near $100 because the last trade was at $100. An arbitrageur sees this, buys SOL from the AMM at the stale cheap price, and immediately sells it elsewhere at $105.

The AMM sold SOL below market value. The LP who provided that SOL lost the difference. This happens every time the external price moves faster than the AMM can adjust its internal price.

**LVR gets worse when volatility is high and fees are low.** High volatility means more price movements. Low fees mean the arbitrageur's profit margin is smaller but they still take the trade — and the LP keeps losing.

## The core problem

Every major AMM picks its settings at launch and locks them in:

| AMM | What's frozen | Problem |
|---|---|---|
| Uniswap V2 | 0.30% fee | Too expensive for stable pairs, too cheap during crashes |
| Uniswap V3 | LP picks fee tier + price range | LP guesses wrong about future volatility |
| Curve | Fixed A at pool creation | A is right for either calm or volatility, never both |
| Orca | LP picks fee tier + price range | Same as Uniswap V3 |

**None of them adapt.** The pool launched during a calm month is set up wrong when volatility spikes. The pool launched during a crash is set up wrong when things stabilize.

## What the pool actually needs

```
CALM MARKET                    VOLATILE MARKET
─────────────                  ─────────────────
Low volatility                 High volatility
Price near peg                 Price swinging fast
Traders want low spread        LPs need protection

→ Want: HIGH A (flat curve)    → Want: LOW A (curved curve)
→ Want: LOW fee (5 bps)        → Want: HIGH fee (30–100 bps)
```

**The signal that tells us which regime we're in is volatility.** If we can measure how jumpy the price is, we can set A and fees accordingly:

- Volatility goes up → lower A (curve steepens to protect LPs), raise fees (compensate LPs for risk)
- Volatility goes down → raise A (curve flattens for tight spreads), lower fees (attract volume)

## The challenge

We need to measure volatility **on-chain**. No external oracles. No off-chain servers. No floating-point math (Solana doesn't allow it). Just integer arithmetic from the pool's own trade history.

That's what we'll build next.

---

[← Prev — 03 StableSwap](03-stableswap.md) · [Next → 05 — On-Chain Volatility](05-on-chain-volatility.md)
