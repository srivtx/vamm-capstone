# Volatility-Adaptive AMM (V-AMM): Complete Mathematical Architecture

> **Report Date:** 2026-05-21  
> **Scope:** Mathematical foundations of curve-morphing AMMs, transition safety, and on-chain feasibility on Solana.  
> **Primary Sources:** Curve StableSwap / CryptoSwap source code (`stableswap-ng`, `twocrypto-ng`), academic CFMM literature (Angeris et al., Egorov).

---

## 1. AMM Curve Fundamentals

### 1.1 Constant Product Market Maker (CPMM)

**Exact Invariant:**

$$x \cdot y = k$$

where $k$ is a constant determined by the initial deposit.

**Price as a Function of Reserves:**  
Implicit differentiation of the invariant yields the marginal (spot) price of $x$ denominated in $y$:

$$p(x, y) = -\frac{dy}{dx} = \frac{y}{x}$$

**Trade of Size $\Delta x$:**  
For a trader depositing $\Delta x$ of asset $X$ and receiving $\Delta y$ of asset $Y$, the new reserves must satisfy:

$$(x + \Delta x)(y - \Delta y) = k = xy$$

Solving for the output:

$$\Delta y = y - \frac{xy}{x + \Delta x} = \frac{y \Delta x}{x + \Delta x}$$

**Average Execution Price:**

$$P_{\text{avg}} = \frac{\Delta y}{\Delta x} = \frac{y}{x + \Delta x}$$

**Price Impact (Slippage):**

$$S(\Delta x) = \frac{P_{\text{avg}} - p}{p} = \frac{y/(x+\Delta x) - y/x}{y/x} = -\frac{\Delta x}{x + \Delta x}$$

For small trades ($\Delta x \ll x$):

$$S \approx -\frac{\Delta x}{x}$$

**Liquidity Depth:**  
Depth is inversely proportional to the price. The curve is **steep** when reserves are imbalanced (shallow liquidity for the depleted asset) and flattest near equilibrium.

---

### 1.2 Constant Sum Market Maker (CSMM)

**Exact Invariant:**

$$x + y = S$$

where $S$ is the total constant sum of reserves.

**Price as a Function of Reserves:**

$$p(x, y) = -\frac{dy}{dx} = 1$$

The price is perfectly flat at unity (or the fixed exchange rate).

**Trade of Size $\Delta x$:**

$$\Delta y = \Delta x$$

**Price Impact:**

$$S(\Delta x) = 0$$

**Where It Breaks:**  
The invariant is valid only for $x \in [0, S]$ and $y \in [0, S]$. Once one reserve is exhausted (e.g., $x = S, y = 0$), the pool can no longer facilitate trades in that direction. It offers **infinite liquidity** at exactly $p=1$ until the boundary is hit, at which point the pool is drained. This makes it unsuitable for volatile assets without external rebalancing or guardrails.

---

### 1.3 Curve StableSwap Invariant

StableSwap, introduced by Michael Egorov (Curve Finance, 2019), is the canonical interpolation between Constant Sum and Constant Product.

**Exact Invariant (General, $n$ coins):**

$$A \cdot n^n \sum_{i=1}^{n} x_i + D = A \cdot n^n \cdot D + \frac{D^{n+1}}{n^n \prod_{i=1}^{n} x_i}$$

where:
- $D$ is the total invariant, roughly representing the economic size of the pool (the constant-sum value at equilibrium).
- $A$ is the **amplification coefficient**. It is dimensionless and controls the "flatness" of the curve.
- $x_i$ are the reserves of each coin (already price-scaled to a common numeraire).

**Two-Coin Simplification ($n=2$):**

$$4A(x + y) + D = 4AD + \frac{D^3}{4xy}$$

#### Interpolation Behavior

| Limit | Behavior | Derived Invariant |
|-------|----------|-----------------|
| $A \to \infty$ | Constant Sum | $x + y = D$ |
| $A \to 0$ | Constant Product | $xy = (D/2)^2$ |

**Proof of Interpolation:**

1. **Constant Sum Limit ($A \to \infty$):**  
   Divide the invariant by $A$:
   $$n^n \sum x_i + \frac{D}{A} = n^n D + \frac{D^{n+1}}{A \cdot n^n \prod x_i}$$
   As $A \to \infty$, the terms with $A$ in the denominator vanish:
   $$n^n \sum x_i = n^n D \implies \sum x_i = D$$

2. **Constant Product Limit ($A \to 0$):**  
   The invariant reduces to:
   $$D = \frac{D^{n+1}}{n^n \prod x_i} \implies \prod x_i = \left(\frac{D}{n}\right)^n$$
   which is the constant-product invariant with $k = (D/n)^n$.

#### Role of the Amplification Parameter $A$

$A$ is a **leverage-like** parameter. A higher $A$ concentrates liquidity around the equilibrium price $p=1$, mimicking an order-book with deep, tight spreads. A lower $A$ widens the spread and deepens the tails, making the pool behave more like Uniswap.

In production contracts (e.g., `CurveStableSwapNGMath.vy`), $A$ is stored with a precision factor (`A_PRECISION = 100`), so the contract-level parameter `_amp` is $100 \times A$.

#### Solving for $D$ Numerically

For a given set of reserves $\{x_i\}$ and a chosen $A$, $D$ must be solved iteratively because it appears nonlinearly.

**Newton-Raphson Iteration (from `CurveStableSwapNGMath.vy`):**

$$D_{j+1} = \frac{A \cdot n^n \cdot \sum x_i + \frac{D_j^{n+1}}{n^n \prod x_i}}{A \cdot n^n - 1}$$

In the Vyper implementation (accounting for `A_PRECISION` and integer arithmetic):

```vyper
D = (
    (Ann * S / A_PRECISION + D_P * _n_coins) * D /
    ((Ann - A_PRECISION) * D / A_PRECISION + (_n_coins + 1) * D_P)
)
```

Convergence is extremely rapid; in practice it terminates in **4–6 iterations** for typical stablecoin pools ($n=2$ to $n=4$).

#### Spot Price for Two-Coin StableSwap

Implicitly differentiating the invariant at constant $D$:

$$p(x, y) = \frac{dy}{dx} = \frac{4A + \frac{D^3}{4x^2 y}}{4A + \frac{D^3}{4xy^2}}$$

Or, equivalently, after algebraic simplification:

$$p(x, y) = \frac{16Ax^2 y^2 + D^3 y}{16Ax^2 y^2 + D^3 x} = \frac{y}{x} \cdot \frac{16Axy^2 + D^3}{16Axy^2 + D^3 \cdot (x/y)}$$

- At equilibrium ($x=y=D/2$): $p = 1$.
- As $A \to 0$: $p \to y/x$ (constant product).
- As $A \to \infty$: $p \to 1$ (constant sum).

---

## 2. Dynamic Invariant Switching

### 2.1 Is a Single Unified Invariant Possible?

**Yes.** The StableSwap invariant is itself a **single, smooth, one-parameter family** of curves that interpolates between constant sum and constant product. It does not require two separate invariants or piecewise switching.

#### Why Additive Linear Interpolation Fails

A naive approach might suggest:

$$\gamma \cdot (x + y - S) + (1 - \gamma) \cdot (xy - k) = 0$$

This fails for three fundamental reasons:

1. **Dimensional Incompatibility:** $S$ and $k$ have different units ($S$ is a reserve sum; $k$ is a reserve product). They cannot be combined without a scaling factor that itself depends on reserves.
2. **Loss of Convexity:** The resulting level set is not guaranteed to be convex. A non-convex trading function permits risk-free value extraction (draining) because the feasible set is not a convex region in $\mathbb{R}^2_+$.
3. **Invalid Boundary Behavior:** As $x \to 0$, the additive form does not enforce $y \to \infty$ (as required for a valid CFMM), leading to situations where the pool can be depleted.

**The correct interpolation is multiplicative**, as embodied by StableSwap.

### 2.2 Research Landscape

| Work | Contribution |
|------|--------------|
| **Egorov (2019)** — *StableSwap* | Introduced the first practical single-invariant interpolation between sum and product via amplification $A$. |
| **Angeris & Chitra (2020)** — *Improved Price Oracles* [^1] | Formalized the CFMM class, proved sufficient conditions for correct price oracles, and derived lower bounds on total reserves. |
| **Angeris et al. (2021)** — *Replicating Market Makers* [^2] | Showed equivalence between concave, 1-homogeneous payoff functions and convex CFMMs. Proved that any valid AMM curve can be derived from a desired payoff via Fenchel conjugacy. |
| **Egorov (2021)** — *Curve Crypto Pools* | Extended StableSwap to non-pegged assets by adding a second parameter $\gamma$ and a dynamic price scale. This is the closest production implementation of a "morphing" AMM for volatile pairs. |

### 2.3 Proposed Unified Invariant with $\gamma$

We can reparameterize $A$ to a normalized parameter $\gamma \in [0, 1]$:

$$A(\gamma) = A_{\max} \cdot \frac{1 - \gamma}{\gamma}$$

with the convention $A(0) = \infty$ and $A(1) = 0$. Substituting into the StableSwap invariant gives the **Unified Volatility-Adaptive Invariant**:

$$\boxed{4 A_{\max} \frac{1 - \gamma}{\gamma} (x + y) + D = 4 A_{\max} \frac{1 - \gamma}{\gamma} D + \frac{D^3}{4xy}}$$

**Limit Behavior:**

| $\gamma$ | Effective $A$ | Curve Behavior |
|----------|---------------|----------------|
| $0$ | $\infty$ | Constant Sum: $x + y = D$ |
| $0.5$ | $A_{\max}$ | Hybrid (deep flat region, moderate tail slippage) |
| $1$ | $0$ | Constant Product: $xy = (D/2)^2$ |

**Assessment of Mathematical Soundness:**  
Smooth curve morphing is **mathematically sound**. Because the invariant is smooth and convex in $(x, y)$ for any $A > 0$, transitioning $\gamma$ continuously traces a smooth path through the space of valid CFMMs. The price $p(x, y; \gamma)$ is continuous (and differentiable) in $\gamma$ as long as the reserves remain in the interior of $\mathbb{R}^2_+$.

---

## 3. Curve Transition Safety

When the AMM switches from one curve mode to another (i.e., $\gamma$ changes), three safety properties must hold.

### 3.1 No Arbitrage Opportunity Is Created

**First-Order Price Continuity (Tangent Matching):**

Let the pool hold reserves $(x_0, y_0)$ at the moment of transition from $\gamma_1$ to $\gamma_2$. An arbitrage-free transition requires that the **spot price** on the new curve at $(x_0, y_0)$ equals the spot price on the old curve at $(x_0, y_0)$:

$$p(x_0, y_0; \gamma_1) = p(x_0, y_0; \gamma_2)$$

**Proof Sketch:**  
The profit from an infinitesimal trade $\varepsilon$ after a transition is:

$$\Pi(\varepsilon) = \varepsilon \cdot (p_{\text{new}} - p_{\text{old}}) + O(\varepsilon^2)$$

If $p_{\text{new}} \neq p_{\text{old}}$, the first-order term is nonzero, yielding risk-free profit. Therefore, equality of first derivatives (tangency) is a **necessary condition** for an arbitrage-free instantaneous switch.

For the Unified StableSwap family, $p(x, y; \gamma)$ depends on $\gamma$ through $A(\gamma)$. If the external market price has moved to match the new $p$, the transition is safe. Otherwise, an instantaneous jump creates arb.

**Production Mitigation (Curve's Ramp):**  
Curve Finance avoids instantaneous jumps by **ramping** $A$ linearly over time (e.g., over days). This ensures $\gamma(t)$ is continuous, bounding arbitrage profit to the *rate* of change rather than a discontinuous jump. The arb cost is spread over the ramp duration, effectively taxing high-frequency arbitrageurs rather than extracting a one-time windfall from the pool.

### 3.2 Reserves Remain Valid

For any $\gamma \in (0, 1)$ and any positive reserves $(x_0, y_0)$, the StableSwap invariant can be solved for a positive $D'$:

$$D' = \text{get\_D}(x_0, y_0, A(\gamma))$$

Because the Newton iteration is guaranteed to converge to a unique positive root when all $x_i > 0$ (the function $f(D)$ is monotonic and convex for $D > 0$), the reserves never become "invalid." There is no division by zero or negative reserve condition.

### 3.3 Liquidity-Neutral Transition

**Definition:** A transition is *liquidity-neutral* if the total economic value of outstanding LP tokens is unchanged by the parameter switch alone.

**Analysis:**  
In StableSwap, the total supply of LP tokens is approximately proportional to $D$ (the exact minting logic mints proportional to the *increase* in $D$ upon deposit). When $\gamma$ changes, the invariant forces a new $D'$ for the same $(x, y)$:

$$D' \neq D \quad \text{(generally)}$$

Therefore, the "claimable value per LP token" changes. **An instantaneous parameter switch is generally NOT liquidity-neutral.**

**Conditions for Neutrality:**

1. **D-Preserving Constraint:** One could, in theory, choose $\gamma_2$ such that $D$ is preserved for the current reserves:
   $$F(x_0, y_0, D; \gamma_2) = 0$$
   This is a single scalar equation in $\gamma_2$, so it generically has a solution. However, it ties $\gamma$ to the specific reserve state and may not correspond to the desired volatility regime.

2. **LP Token Rebase:** If $\gamma$ changes and $D$ changes to $D'$, the contract can rebase LP tokens by a factor $D'/D$, preserving value per share. This is mechanically equivalent to a stock split and is liquidity-neutral by construction. The challenge is that $D$ must be known precisely at the transition block.

3. **Value Preservation via Payoff Equivalence:** From Angeris et al. (2021) [^2], each CFMM replicates a concave payoff $U(\theta)$ where $\theta$ is the price. Changing $A$ changes the replicating payoff. Neutrality requires that the *Fenchel conjugate* of the new trading function equals the old one at the current price—an extremely strong condition that generally fails.

**Practical Conclusion:**  
The safest production method is **gradual ramping** of $\gamma$ combined with a **fee accrual mechanism** that captures the arbitrage value generated during the transition and returns it to LPs, offsetting any adverse convexity shift.

---

## 4. On-Chain Feasibility (Solana)

### 4.1 Solana Compute Limits

Per the Solana execution model [^3]:

| Limit | Value |
|-------|-------|
| Default CU limit per instruction | 200,000 |
| Maximum CU limit per transaction | 1,400,000 |
| Base fee | 5,000 lamports per signature |

A BPF program must fit its compute-heavy logic within these bounds.

### 4.2 Feasibility by Curve Type

| Curve | Compute Cost | Feasibility |
|-------|--------------|-------------|
| **Constant Product** | ~500–2,000 CUs | Trivial. Used by Orca, Raydium. |
| **Constant Sum** | ~300–1,000 CUs | Trivial. Rarely used standalone due to depletion risk. |
| **StableSwap ($n=2$)** | ~5,000–15,000 CUs | **Feasible.** Saber Finance deployed StableSwap on Solana mainnet successfully. `get_D` converges in 4–6 iterations; `get_y` in a similar number. Each iteration is a handful of `u64/u128` mul/div ops. |
| **StableSwap ($n=3$)** | ~8,000–20,000 CUs | Feasible. Slightly higher due to loops over 3 coins. |
| **Curve CryptoSwap V2** | ~15,000–50,000 CUs | **Feasible but heavy.** `newton_D` requires ~10–20 iterations. The `_newton_y` or `get_y` (cubic solver) paths involve more arithmetic, including cube-root approximations (`_cbrt` in `TwocryptoMath.vy` uses 7 Newton iterations for cube root plus a `log2` lookup). |

### 4.3 Iterative Solving in BPF

**StableSwap Newton Steps:**
Each `get_D` iteration performs:
1. A loop over $n$ coins computing `D_P = D_P * D / x`.
2. A few arithmetic ops to update `D`.

For $n=2$, this is ~10 arithmetic operations per iteration. At ~50–100 CUs per iteration (including loop overhead in BPF), 5 iterations cost ~500 CUs. The 255-max loop is a safety cap; it is never hit in practice.

**CryptoSwap Newton Steps:**
Each `newton_D` iteration computes:
- `K0` (deviation from equilibrium)
- `|gamma + 1 - K0|` term
- `mul1` and `mul2` (heavy div chains)
- `neg_fprime` and D update

This is roughly 5–10x more expensive per iteration than StableSwap. With ~15 iterations, the cost is ~10k–30k CUs. This still fits comfortably in the 200k default budget for a **single swap instruction**.

### 4.4 Required Approximations & Optimizations

To ensure reliable on-chain execution within Solana's limits, the following techniques are essential:

1. **Fixed-Point Arithmetic:** All calculations use integer math with a precision scalar (e.g., $10^{18}$). This avoids slow BPF floating-point emulation.
2. **Precompute and Cache D:** Update the invariant $D$ only when liquidity is added or removed. For swaps, read the cached $D$ rather than recomputing it from scratch (saving ~half the iteration cost).
3. **Use Newton over Analytic Cubic for State Changes:** Curve V2's `get_y` implements an analytic cubic-root solver for view functions. For state-changing swaps, use `_newton_y` (Newton-Raphson) instead. It is faster for typical reserve deviations and avoids the expensive cube-root and `log2` logic.
4. **Iteration Caps with Fallbacks:** Cap Newton iterations at a safe bound (e.g., 100). If convergence fails, revert the transaction rather than looping to 255.
5. **Price-Scale Pre-Adjustment (CryptoSwap):** Curve V2 maintains an internal `price_scale`. Keeping this oracle-aligned reduces the required amplification and gamma correction, reducing iteration count.

---

## 5. Price Impact Formulas

### 5.1 Price as a Function of Reserves

| Curve | Spot Price $p = -dy/dx$ |
|-------|-------------------------|
| Constant Product | $p = \dfrac{y}{x}$ |
| Constant Sum | $p = 1$ |
| StableSwap ($n=2$) | $p = \dfrac{16Ax^2y^2 + D^3 y}{16Ax^2y^2 + D^3 x}$ |
| Curve CryptoSwap V2 | Implicit; approximated by: $p \approx \dfrac{x}{y} \cdot \dfrac{GK0 + NNAG2 \cdot y/D \cdot K0}{GK0 + NNAG2 \cdot x/D \cdot K0}$ (derived from `TwocryptoMath.vy` `get_p`) |

### 5.2 Slippage for Trade Size $\Delta x$

**Constant Product:**

$$\Delta y = \frac{y \Delta x}{x + \Delta x}$$

$$S_{\text{cp}}(\Delta x) = -\frac{\Delta x}{x + \Delta x}$$

**Constant Sum:**

$$\Delta y = \Delta x$$

$$S_{\text{cs}}(\Delta x) = 0 \quad \text{(for } \Delta x < y\text{)}$$

**StableSwap ($n=2$):**  
Given the post-trade reserve $x' = x + \Delta x$, solve the invariant for $y'$ using the quadratic form:

$$16Ax' \cdot (y')^2 + (16A(x')^2 + 4Dx' - 16ADx') \cdot y' - D^3 = 0$$

Then:

$$\Delta y = y - y'$$

$$S_{\text{ss}}(\Delta x) = \frac{\Delta y / \Delta x - p(x, y)}{p(x, y)}$$

There is no elementary closed form for $S_{\text{ss}}$ in terms of $\Delta x$ alone; it requires solving the quadratic above.

### 5.3 Comparative Depth Analysis

| Regime | Slippage Characteristic | Depth |
|--------|------------------------|-------|
| Constant Sum ($\gamma=0$) | Zero slippage until boundary | Infinite at $p=1$, zero elsewhere |
| StableSwap ($\gamma=0.5$, high $A$) | Very low slippage near equilibrium; grows as reserves deviate | Deep near $p=1$; shallower in tails |
| StableSwap ($\gamma=0.5$, low $A$) | Moderate slippage; wider flat region | Moderate depth across a wider range |
| Constant Product ($\gamma=1$) | Linear proportional slippage: $\Delta x / x$ | Shallow; liquidity is log-uniform |

**Key Insight for V-AMM Design:**  
When volatility is low, the AMM should operate at low $\gamma$ (high $A$, near-constant-sum) to minimize slippage for stable pairs. When volatility spikes, $\gamma$ should increase (lower $A$, near-constant-product) to bound impermanent loss and prevent the pool from offering stale, mispriced liquidity.

---

## 6. Conclusion & Recommendations

### Mathematical Soundness

Smooth curve morphing is **mathematically sound and already achieved** by the StableSwap invariant family. The parameter $A$ (or equivalently $\gamma$) provides a smooth, convex homotopy between constant sum and constant product. There is no need for piecewise functions or unsafe linear combinations.

### Transition Safety

Instantaneous switching of $\gamma$ is **not generally safe** because:
1. It changes the spot price at the current reserves, creating first-order arbitrage.
2. It changes the implicit invariant $D$, altering LP token value unless a rebase is performed.

**Recommended approach:**
- Use a **time-weighted ramp** for $\gamma$ (e.g., adjust over minutes or hours, not blocks).
- At the moment of transition initiation, ensure the **tangent condition** $p_{\text{old}} = p_{\text{new}}$ holds (or is as close as possible given the external oracle).
- Consider an **LP rebase** or **fee sweep** that captures the convexity difference during the ramp and returns it to liquidity providers.

### On-Chain Viability

- **StableSwap:** Proven feasible on Solana (Saber). Fits easily within 200k CUs.
- **CryptoSwap (V2):** Feasible but requires careful gas optimization. Cube-root logic and dual-parameter solving push compute budgets but remain within limits for isolated swap instructions.
- For a V-AMM on Solana, **StableSwap-level iteration is the sweet spot**. A dynamic $A$ (single parameter) is simpler and cheaper than a full dual-parameter $(A, \gamma)$ model while still achieving the core volatility-adaptive goal.

### Final Architecture Recommendation

A production-grade Volatility-Adaptive AMM should:

1. **Use the StableSwap invariant** with $A$ dynamically controlled by a volatility oracle (e.g., realized volatility over a trailing window).
2. **Map volatility $\sigma$ to amplification:** $A(t) = f(\sigma(t))$, where $f$ is a decreasing function (high vol → low $A$; low vol → high $A$).
3. **Ramp $A$ linearly** between target values over a minimum window (e.g., 1 hour) to prevent arb shocks.
4. **Compute all Newton iterations** in fixed-point integer arithmetic, capping loops at ~100 iterations with explicit revert on non-convergence.
5. **Cache $D$** across swaps to minimize redundant computation.

---

## References

[^1]: Angeris, G., & Chitra, T. (2020). *Improved Price Oracles: Constant Function Market Makers.* arXiv:2003.10001 [q-fin.TR]. https://doi.org/10.1145/3419614.3423251

[^2]: Angeris, G., Evans, A., & Chitra, T. (2021). *Replicating Market Makers.* arXiv:2103.14769 [q-fin.MF]. https://doi.org/10.48550/arXiv.2103.14769

[^3]: Anza (Agave) Execution Budget. `MAX_COMPUTE_UNIT_LIMIT = 1,400,000`; `DEFAULT_INSTRUCTION_COMPUTE_UNIT_LIMIT = 200,000`. https://github.com/anza-xyz/agave

[^4]: Egorov, M. (2019). *StableSwap — efficient mechanism for stablecoin liquidity.* Curve Finance Whitepaper. https://curve.fi/files/stableswap-paper.pdf

[^5]: Egorov, M. (2021). *Curve Crypto Pools.* Curve Finance Whitepaper. https://curve.fi/files/crypto-pools-paper.pdf

[^6]: CurveFi (2024). `stableswap-ng` Vyper source, `CurveStableSwapNGMath.vy` — exact StableSwap Newton implementations. https://github.com/curvefi/stableswap-ng

[^7]: CurveFi (2025). `twocrypto-ng` Vyper source, `TwocryptoMath.vy` — exact CryptoSwap Newton and price formulas. https://github.com/curvefi/twocrypto-ng

[^8]: Angeris, G., Kao, H. T., Chiang, R., Noyes, C., & Chitra, T. (2019). *An analysis of Uniswap markets.* arXiv:1911.03380 [q-fin.TR]. https://doi.org/10.48550/arXiv.1911.03380
