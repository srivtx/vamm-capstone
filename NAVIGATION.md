# How to Read This Repo

There are 61 files across 6 directories. Here's the order to read them in, depending on what you want to learn.

---

## Path 1: I know nothing. Teach me from zero.

```
1. 0x2vamm/01-constant-product.md       What is an AMM? x*y=k
2. 0x2vamm/02-constant-sum.md           x+y=S, the drain problem
3. 0x2vamm/03-stableswap.md             Blending both with A
4. reports/basics/01-what-is-an-amm.md   Deeper AMM fundamentals
5. reports/basics/02-what-is-a-logarithm.md  Why logs = percentages
6. reports/basics/03-what-is-volatility.md   How jumpy is the price?
7. reports/basics/05-basis-points.md     What bps means
8. reports/basics/17-slippage.md         Why your trade gets worse than expected
9. reports/basics/04-impermanent-loss.md Why LPs lose money
10. reports/basics/09-lvr.md            The other LP loss
11. reports/basics/14-arbitrageur.md     Who fixes AMM prices
12. reports/basics/15-adverse-selection.md Why informed traders hurt LPs
13. reports/basics/23-toxic-flow.md     When trades are attacks
14. reports/basics/19-smoothstep.md      The fee formula
15. reports/basics/20-depeg.md           When stablecoins break
16. reports/basics/21-wash-trading.md    Fake volume, real damage
17. reports/basics/22-concentrated-liquidity.md  V3 vs V-AMM
18. reports/basics/24-endogenous-exogenous.md   Internal vs external signals
19. reports/basics/25-reflexivity.md     Feedback loops
20. reports/basics/26-defense-in-depth.md   Layered security
21. reports/basics/27-commit-reveal.md   Hiding trades from attackers
22. reports/basics/28-virtual-reserves.md    Math trick for safe transitions
23. reports/basics/29-black-swan.md      When everything breaks
24. reports/basics/30-griefing.md        Attacking to harm, not profit
25. reports/basics/31-cex-dex-aggregators.md  Where trades happen
26. reports/basics/06-ewma.md            The smoothing engine
27. reports/basics/11-fixed-point-arithmetic.md How decimals work without floats
28. reports/basics/12-twap.md            Time-weighted prices
29. reports/basics/13-ring-buffer.md     Circular storage
30. reports/basics/16-circuit-breakers.md    Auto-safety
31. reports/basics/07-newton-raphson.md  How the solver works
32. reports/basics/18-crank-keeper.md    Who maintains the pool
33. reports/basics/08-solana-concepts.md Accounts, PDAs, CPIs
34. reports/basics/10-mev-and-sandwich.md    Transaction ordering attacks

Now you understand all the concepts. Read the journey:

35. 0x2vamm/04-why-volatility-matters.md    Why static AMMs fail
36. 0x2vamm/05-on-chain-volatility.md       Measuring vol without floats
37. 0x2vamm/06-dynamic-fees.md              How fees adapt
38. 0x2vamm/07-moving-parts-together.md      A + fees working together
39. 0x2vamm/08-solana-program.md            The actual code

Then the architecture:

40. ARCHITECTURE.md                      Full diagram set
41. README.md                            Project overview
```

---

## Path 2: I want to BUILD this. How does a developer think about it?

```
1. reports/programme/01-start-here.md        Solana from 30,000 feet
2. reports/programme/depth/01-how-programs-talk.md  CPIs, signers, atomiticy
3. reports/programme/02-escrow.md            Simplest program
4. reports/programme/depth/02-build-escrow.md    Every decision justified
5. reports/programme/03-vaults.md            From escrow to vault
6. reports/programme/depth/03-build-vault.md     Why two vaults, why PDA authority
7. reports/programme/04-cpi.md               How programs call each other
8. reports/programme/05-building-an-amm.md   Assembling the pieces
9. reports/programme/depth/04-build-amm.md       Every PoolState field justified
10. reports/programme/06-vamm.md             Adding the brain
11. reports/programme/depth/05-build-vamm.md     Every V-AMM design choice
12. reports/programme/07-walkthrough.md      Full lifecycle
13. reports/programme/depth/06-full-system.md    Lifecycle with code references

Then cross-reference with concepts:

14. reports/basics/ (all 31 files as needed)
```

---

## Path 3: I want to understand the research.

```
1. reports/00-research-summary.md            Thesis + MVP scope
2. reports/basics/ (concepts you need first)
3. reports/01-stableswap-math.md             From CPMM to StableSwap
4. reports/02-dynamic-fees.md                Fee design + simulations
5. reports/03-on-chain-volatility.md         EWMA engine on Solana
6. reports/04-adversarial-analysis.md        Six attack vectors + mitigations
```

---

## Path 4: Quick lookup — what file teaches X?

| Concept | Where |
|---|---|
| What is x*y=k? | `0x2vamm/01-constant-product.md` |
| What is A (amplification)? | `0x2vamm/03-stableswap.md` |
| What is IL? | `reports/basics/04-impermanent-loss.md` |
| What is LVR? | `reports/basics/09-lvr.md` |
| What is EWMA? | `reports/basics/06-ewma.md` |
| What is smoothstep? | `reports/basics/19-smoothstep.md` |
| What is a PDA? | `reports/basics/08-solana-concepts.md` |
| What is a CPI? | `reports/programme/depth/01-how-programs-talk.md` |
| How does a swap work? | `0x2vamm/08-solana-program.md` + `reports/programme/depth/04-build-amm.md` |
| How does fee_growth accounting work? | `reports/programme/depth/04-build-amm.md` (Part D) |
| Why 9000 slot ramp? | `reports/programme/depth/05-build-vamm.md` (Part D) |
| Why separate VolatilityState? | `reports/programme/depth/05-build-vamm.md` (Part B) |
| What attacks exist? | `reports/04-adversarial-analysis.md` |
| How is it deployed? | `README.md` + `ARCHITECTURE.md` |
| Where is the code? | `vamm/programs/vamm/src/` |

---

## File count

| Directory | Files | Purpose |
|---|---|---|
| `0x2vamm/` | 8 + 4 SVGs | Conceptual journey from zero to V-AMM |
| `reports/basics/` | 31 | First-principles concept explanations |
| `reports/programme/` | 7 | Developer's building journey (overview) |
| `reports/programme/depth/` | 6 | Developer's building journey (detailed) |
| `reports/` | 5 | Research reports |
| Root | 3 | README, ARCHITECTURE, DISCORD_POST |
