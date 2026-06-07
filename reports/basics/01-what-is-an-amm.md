# What is an AMM?

An **AMM** (Automated Market Maker) is a program that lets you trade tokens without needing another person on the other side. You trade against a pool of money, not against an order book.

## The old way: order books

On a traditional exchange (like Binance or Coinbase), when you want to buy SOL, someone else must be selling SOL at a price you accept. The exchange matches buyers and sellers. This works great when there are lots of people trading — but it falls apart for new tokens, small tokens, or during low-activity hours. No seller = no trade.

## The AMM way: a pool of money

An AMM replaces the order book with a **liquidity pool** — a pile of two tokens sitting in a smart contract. Anyone can trade with this pool at any time. The pool uses a mathematical formula to decide the price.

The tokens in the pool are provided by people called **LPs** (Liquidity Providers). LPs deposit pairs of tokens and earn a small fee from every trade that uses the pool.

```
Traditional exchange:          AMM:
                               
  Buyer → [Order Book] ← Seller    Trader → [Pool of tokens] ← LP deposits
  (needs match)                    (always available, formula sets price)
```

## How the price works

The pool doesn't look at external prices. It only knows what's inside itself. If the pool holds 100 USDC and 1 SOL, the formula says the price is 100 USDC per SOL. If someone buys a lot of SOL, the SOL reserve shrinks and the USDC reserve grows — the price automatically rises.

This is why AMMs need **arbitrageurs** — traders who see the pool's price is different from the market price and trade to bring it back in line. The arbitrageur makes a profit; the pool stays accurate.

## Why AMMs matter

- **Always available** — no matching needed, trade 24/7
- **Permissionless** — anyone can create a pool for any token pair
- **Passive income** — anyone can be an LP and earn fees
- **Composable** — other programs can build on top of AMMs

## The two big families

There are two main types of AMM formulas, and everything else is a blend of them:

- **Constant Product** (`x × y = k`): Uniswap style. Works for any token pair, never drains. Price moves with every trade. [Full explanation →](../0x2vamm/01-constant-product.md)

- **Constant Sum** (`x + y = S`): Stablecoin style. Perfect 1:1 pricing, zero slippage. But drains completely if one side runs out. [Full explanation →](../0x2vamm/02-constant-sum.md)

V-AMM uses a blend of both (StableSwap) and adds volatility-based automatic adjustment on top.
