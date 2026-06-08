# What is Toxic Flow?

**Toxic flow** (also called informed flow) is trading activity from people who know something the AMM doesn't. They have better information about the true market price, and they use it to extract value from the pool.

## How it works

```
1. SOL is trading at $100 on Binance. The AMM's price is also $100.
2. Breaking news: SOL partnership announced. Price jumps to $110 on Binance.
3. An arbitrageur (informed trader) sees this instantly.
4. The AMM still thinks SOL is $100 — no trade has happened yet.
5. Arbitrageur buys SOL from the AMM at $100, sells on Binance at $110.
6. Profit: $10 per SOL.

The LP who provided that SOL just sold it for $100 when it was worth $110.
That $10 loss is toxic flow.
```

The trader was "toxic" because their trade was informed — they knew the true price was $110 while the AMM's internal price was $100. The trade was profitable for them and loss-making for the LP.

## Toxic flow vs benign flow

**Benign flow (noise traders):** Retail traders buying SOL because they want SOL. No special information. The LP earns a fee. Everyone wins.

**Toxic flow (informed traders):** Arbitrageurs exploiting stale prices. The LP loses more than the fee earned. LPs lose.

The ratio of toxic to benign flow determines LP profitability:
```
LP profit = fees_from_benign_flow − losses_to_toxic_flow
```

## How V-AMM handles toxic flow

**Raising fees during high volatility:** When price is moving fast (toxic flow is high), fees rise to compensate LPs. The toxic trader must pay more to extract value, reducing their profit and increasing LP compensation.

**Lowering A during high volatility:** The curve steepens. Toxic traders must trade more volume to move the price the same amount, increasing their slippage cost.

**The combination:** Higher fees + steeper curve = toxic flow becomes expensive. Benign traders (who trade smaller amounts less frequently) are less affected.
