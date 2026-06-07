# What are MEV and Sandwich Attacks?

**MEV** (Maximal Extractable Value) is profit that can be extracted from blockchain users by reordering, inserting, or censoring transactions within a block.

## How MEV works

Blockchain transactions don't execute instantly. They sit in a public "mempool" waiting to be included in a block. Anyone can see these pending transactions. If you see someone about to make a profitable trade, you can copy it, front-run it, or sandwich it — and take the profit for yourself.

## Sandwich attack (the most common MEV)

```
1. Victim sends: "Buy 10 SOL from the AMM, max slippage 1%"
   (This transaction is visible in the mempool)

2. Attacker sees it and sends TWO transactions:
   a. Front-run: "Buy SOL from the AMM" (before the victim)
      → This pushes the SOL price up
   b. Back-run: "Sell SOL back to the AMM" (after the victim)
      → The victim's trade pushed price even higher, attacker sells at profit

3. Block builder orders them: Attacker-buy → Victim-buy → Attacker-sell
   
4. Result:
   - Victim pays a worse price (their own trade + attacker's front-run = more slippage)
   - Attacker profits from the price difference
   - LP gets nothing extra
```

## Why flat curves make sandwiches worse

In a flat-curve (high-A) pool, the front-run costs almost nothing — the attacker can buy a huge amount with near-zero slippage. The victim then trades an even larger amount (they see deep liquidity), pushing the price significantly. The attacker back-runs at a big profit.

In a curved (low-A) pool, front-running costs real slippage. The sandwich becomes less profitable. This is one reason V-AMM lowers A during volatile periods — it makes sandwich attacks more expensive.

## Other MEV types

- **Front-running**: seeing a profitable trade and doing it first
- **Back-running**: trading immediately after a large trade to capture the price movement
- **Liquidation sniping**: racing to liquidate an underwater loan before others
- **Arbitrage**: buying on one venue and selling on another when prices differ

## Defenses in V-AMM

- **Gradual A ramp** — no sudden curve changes that create MEV windows
- **Rate-limited fees** — fees can't spike in one block to trap traders
- **Min_amount_out parameter** — users specify "I won't accept less than X" (slippage protection)
