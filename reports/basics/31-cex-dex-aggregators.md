# CEX vs DEX

These acronyms appear throughout the reports. Quick definitions and why the distinction matters.

## CEX — Centralized Exchange

A company runs it. You deposit funds into their custody. They match orders on an internal order book.

Examples: Binance, Coinbase, Kraken.

**Advantages:** Fast, high liquidity, low fees, fiat on/off ramps.

**Disadvantages:** You don't control your funds (they hold your crypto). KYC required. Can freeze your account. Can be hacked. Single point of failure.

## DEX — Decentralized Exchange

Code runs it. You keep custody of your funds. Trades happen via smart contracts (AMMs) or on-chain order books.

Examples: Uniswap, Curve, Orca, Jupiter (aggregator).

**Advantages:** Self-custody. No KYC. Permissionless. Can't be censored.

**Disadvantages:** Slower, higher fees (gas + swap fee), less liquidity for some pairs.

## Why reports reference CEXs

**CEX prices as ground truth:** The "true" market price is usually determined on CEXs (they have the most liquidity). AMM prices track CEX prices via arbitrage.

**CEX volatility feeds:** Reports 03 and 04 discuss using CEX-derived volatility as an exogenous oracle — Binance's order book data is much harder to manipulate than a single AMM pool.

**CEX vs DEX volume:** Report 02 warns that if fees exceed ~150 bps, volume routes entirely to CEXs. The fee cap exists partly because of this competitive dynamic.

## DEX aggregators

**Jupiter (Solana) and 1inch (Ethereum)** are DEX aggregators. They split a trade across multiple AMMs to get the best price.

Why this matters for V-AMM: if V-AMM's fee spikes to 100 bps, aggregators notice and route trades to cheaper pools. The pool loses volume. Fee spikes must be temporary and justified, or the pool becomes invisible to aggregators.
