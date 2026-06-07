# V-AMM Focused Research Summary

## Thesis
V-AMM is a Volatility-Adaptive AMM for Solana: an AMM whose curve shape and fee schedule automatically adapt to realized on-chain volatility. In low-volatility regimes it behaves more like StableSwap/high-amplification AMM for low slippage. In high-volatility regimes it reduces amplification and moves closer to constant product behavior to protect LPs from stale flat liquidity and impermanent-loss-like adverse selection.

## Core Novelty Claim
Existing AMMs do one or two of the following separately:
- concentrated liquidity: Uniswap v3, Orca Whirlpools
- dynamic fee adjustment: Trader Joe Liquidity Book, Balancer controlled pools
- liquidity repositioning: Maverick
- governance/admin parameter changes: Curve A ramp, Balancer controllers
- custom curve engines: Shell/Proteus

The proposed gap is a Solana-native AMM that combines:
1. on-chain realized volatility engine,
2. automatic amplification/curve adjustment,
3. dynamic volatility-based fees,
4. no external oracle dependency for the volatility signal,
5. gradual safe ramping to avoid curve-transition arbitrage.

## Recommended MVP Scope
Build a 2-asset StableSwap-style AMM with dynamic amplification A.

MVP modules:
1. Pool initialization
2. Add/remove liquidity
3. Swap instruction using StableSwap invariant
4. Observation ring buffer / EWMA volatility engine
5. Volatility-to-A mapping
6. Volatility-to-fee mapping
7. A ramping mechanism instead of instant switching
8. Basic frontend/simulation dashboard

Do NOT build full Curve CryptoSwap v2. Use StableSwap-level math because it is feasible on Solana and already battle-tested conceptually.

## Main Risks
1. Volatility manipulation / wash trading
2. Sandwich amplification in flat-curve mode
3. Curve transition arbitrage
4. LP value discontinuity if A changes too quickly
5. Organic volume routing away if fees spike too aggressively
6. On-chain compute and precision bugs

## Required Mitigations
1. Bucketed TWAP/median ticks, not raw trade-by-trade returns
2. Volume-weighted volatility or minimum trade-size thresholds
3. EWMA hot path + rolling-window sanity check
4. Gradual A ramping over time
5. Max A-change per slot/window
6. Fee-change cooldowns
7. Fixed-point arithmetic and tested Newton iteration caps
8. Simulations against wash trades, volatility shocks, and sandwiches

## Capstone Positioning
This is stronger than a token/community infra project because it is a real on-chain financial primitive. It is mathematically deep, Solana-specific, and demonstrable with a local/devnet AMM. The clean pitch: "An autonomous AMM that adjusts both liquidity curve and fees based on realized volatility, reducing the mismatch between market conditions and static AMM design."
