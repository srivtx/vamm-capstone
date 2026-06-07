# What is Newton-Raphson?

**Newton-Raphson** is a method for finding where a mathematical function equals zero. It starts with a guess, checks how wrong it is, and makes a better guess. Repeat until the answer is close enough.

## How it works

```
Step 1: Make a guess for the answer
Step 2: Plug the guess into the formula. See how far off you are.
Step 3: Use the slope of the curve at that point to make a better guess
Step 4: If the new guess is very close to the old guess → you're done
        If not → go back to Step 2 with the new guess
```

## Concrete example: finding √2

We want to find x where `x² = 2`. That's the same as finding where `f(x) = x² − 2 = 0`.

```
Guess #1: x = 1.5
  f(1.5) = 1.5² − 2 = 2.25 − 2 = 0.25  (too high)
  Slope at x: f'(1.5) = 2×1.5 = 3
  New guess: x = 1.5 − 0.25/3 = 1.5 − 0.083 = 1.417

Guess #2: x = 1.417
  f(1.417) = 1.417² − 2 = 2.007 − 2 = 0.007  (very close)
  Slope: f'(1.417) = 2×1.417 = 2.834
  New guess: x = 1.417 − 0.007/2.834 = 1.4142

Actual √2 = 1.41421... We're there in 2 iterations.
```

## Why V-AMM uses it

The StableSwap formula `4A(x+y) + D = 4AD + D³/(4xy)` can't be solved algebraically for the output of a trade. You can't just rearrange the equation to get `y = ...`. The relationship is too complex.

Instead, for every swap, the program:
1. Starts with a guess for the new Y value after the trade
2. Checks if the guess satisfies the StableSwap invariant
3. If not, uses Newton-Raphson to compute a better guess
4. Repeats up to 64 times
5. If it hasn't converged by iteration 64, the trade fails (pool is in an extreme state)

## On-chain constraints

On Solana, we can't use decimal numbers. Everything is integers (u128). The Newton-Raphson is adapted to work with fixed-point integer arithmetic — all divisions are integer division, and we check for convergence by seeing if the difference between iterations is ≤ 1.

The 64-iteration cap is a safety limit. In practice, most trades converge in 5–15 iterations. If it ever hits 64, something is wrong and the transaction reverts rather than returning a wrong answer.
