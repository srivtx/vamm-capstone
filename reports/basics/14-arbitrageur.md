# What is an Arbitrageur?

An **arbitrageur** is a trader who profits from price differences between markets. They buy where an asset is cheap and sell where it's expensive — simultaneously or near-simultaneously.

## The simplest example

```
Binance:    1 SOL = $100
AMM pool:   1 SOL = $98

Arbitrageur:
  1. Buys 10 SOL from the AMM at $98  ($980 spent)
  2. Sells 10 SOL on Binance at $100  ($1000 received)
  3. Profit: $20 (minus fees)

After the trade:
  AMM pool:  1 SOL ≈ $100  (arbitrageur's buy pushed the price up)
  Market is now consistent across venues.
```

## Why arbitrageurs are essential for AMMs

AMMs don't look at external prices. They only know their own reserves. Without arbitrageurs, an AMM's price would drift arbitrarily far from the market price.

Arbitrageurs **keep AMMs honest**. Every time they trade, they pull the AMM's price back toward the true market price. They're the feedback loop that makes decentralized exchanges work.

## The dark side

Arbitrageurs profit at the expense of LPs. When they buy SOL from the AMM at $98 and sell at $100, that $2 per SOL comes from the LP who provided that SOL at below-market value.

This is the **adverse selection** problem: the AMM always trades with someone who has better information (the arbitrageur knows the true market price; the AMM doesn't). LPs are systematically on the losing side of these trades.

This is also what **LVR** measures — the cumulative value LPs lose to arbitrageurs over time.

## How V-AMM deals with arbitrageurs

The protocol doesn't try to stop arbitrage — that's impossible and undesirable. Instead it:
- **Raises fees during high volatility** — makes arbitrage more expensive when it's most harmful
- **Lowers A** — steepens the curve so arbitrageurs must trade more to move the price (increasing their cost and reducing per-trade LP loss)
- **Rate-limits curve changes** — prevents arbitrageurs from exploiting sudden parameter shifts

The goal isn't to eliminate arbitrageurs. It's to make sure LPs are compensated fairly for the value they provide.
