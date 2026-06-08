# Step 3: From Escrow to Vault

An escrow holds tokens for one deal between two people. A vault holds tokens for an entire protocol. Same PDA pattern. Different scale.

---

## Why do we need vaults?

An AMM needs to hold tokens that:
- Multiple people deposit into (LPs)
- Traders withdraw from (swap outputs)
- Stay there indefinitely (not released on a single condition)

An escrow releases everything to one person on one trigger. A vault needs:
- Many depositors (not just one maker)
- Many withdrawers (every trader getting swap output)
- Partial withdrawals (you take out your share, not everything)
- Permanent existence (doesn't close after each use)

---

## Part A: What stays the same from escrow?

**PDA-owned token account.** The vault is a token account whose authority is a PDA controlled by the program. Nobody has a private key. Only program code can authorize withdrawals.

**Why the same pattern?** Because the problem is the same: "these tokens belong to the protocol, not to any individual." A PDA is the only way to represent protocol ownership on Solana.

**Seed strategy:**

```
Escrow:     ["escrow_vault", escrow_state]
AMM vault:  ["vault_a", pool_state]
AMM vault:  ["vault_b", pool_state]
```

**Why derive vaults from pool_state and not from the token mints?** Because you might have multiple pools for the same token pair (different fee tiers, different A_max). Pool_state is unique per pool. Token mints are not.

---

## Part B: What's different from escrow?

### Multiple depositors

An escrow has one maker. A vault has many LPs. How do we track who owns what?

**Escrow solution:** The maker IS the depositor. No tracking needed.

**Vault solution:** We need a per-user position account:

```rust
PositionState {
    owner: Pubkey,          // who this position belongs to
    pool: Pubkey,           // which pool
    shares: u128,           // how many LP tokens this user holds
    uncollected_fees_a: u64, // fees earned but not yet withdrawn
    uncollected_fees_b: u64,
}
```

**Why a separate PositionState instead of storing positions in PoolState?** PoolState would need a dynamic list of all LPs. On Solana, accounts have fixed size — you can't grow an array. Each LP gets their own PDA instead:

```
seeds = ["position", pool_state, user_pubkey, &[nonce]]
```

**Why include nonce?** Allows one user to have multiple positions in the same pool (different entry times, different strategies).

### Partial withdrawals

An escrow releases everything. A vault lets you withdraw part of your share.

**Escrow:** `amount_out = total_escrow_amount` (everything to one person)

**Vault:** `amount_out = (your_shares / total_lp_shares) × reserves`

**Why proportional?** Because the pool's reserves change between your deposit and withdrawal. If you deposited 50% of the pool initially but other LPs deposited later, your share is `your_shares / total_lp_shares`, not 50% of reserves.

### Permanent existence

An escrow closes after claim/cancel. A vault stays open forever (until the last LP exits).

**Why?** The pool needs to exist for traders even when no LPs are adding/removing. The vaults hold tokens; the program operates on them. Close only on pool shutdown.

---

## Part C: The PoolAuthority PDA

This is the most important PDA in V-AMM. It's the "owner" of all protocol-controlled token accounts.

```
PoolAuthority = derive(["authority", pool_state])

This PDA controls:
  ├── VaultA (holds token A reserves)
  ├── VaultB (holds token B reserves)  
  └── LpMint (mints LP tokens)
```

**Why one authority for everything?** Simpler. One PDA signs all protocol token movements. If vault A needed one authority and vault B needed another, you'd have to manage multiple bump seeds and multiple signer contexts. One authority, one bump, one signer pattern.

**Why derive from pool_state and not a fixed seed?** If we used a fixed seed like `["authority"]`, every pool in the program would share the same authority. That's catastrophic — one pool could sign for another pool's vaults. Deriving from pool_state ensures each pool has a unique authority.

**What happens if someone learns the bump seed?** Nothing. The bump seed just tells the program how to derive the PDA address. It doesn't give signing power — the program must actively produce the PDA signature in a CPI context. An attacker who knows the bump still can't sign as the PDA.

---

## Part D: Two vaults, not one

An AMM trades between two tokens. We need two vaults.

**Why not one vault holding both tokens?** SPL Token accounts hold exactly one mint type. A single token account can only hold USDC OR SOL, not both. Two mints = two vaults.

**Why symmetrical seeds?**

```
VaultA: ["vault_a", pool_state]
VaultB: ["vault_b", pool_state]
```

Both derived the same way. Both owned by the same PoolAuthority. The only difference is the first seed string (and the mint they hold). Symmetry makes the code simpler — same pattern for both sides.

---

## Part E: Vault initialization flow

When someone calls `initialize_pool`, the program creates five accounts:

```
1. PoolState PDA
   seeds: ["pool", mint_a, mint_b, pool_id_le]
   owner: vamm program
   stores: reserves, A, fee, cross-references

2. VolatilityState PDA
   seeds: ["volatility", pool_state]
   owner: vamm program
   stores: EWMA, ring buffers

3. PoolAuthority PDA
   seeds: ["authority", pool_state]
   (no data — just used for signing)

4. VaultA token account
   seeds: ["vault_a", pool_state]
   mint: token_mint_a
   authority: PoolAuthority

5. VaultB token account
   seeds: ["vault_b", pool_state]
   mint: token_mint_b
   authority: PoolAuthority

6. LpMint
   seeds: ["lp_mint", pool_state]
   decimals: 6
   authority: PoolAuthority
```

**Why 6 accounts?** Each serves a distinct purpose. PoolState stores data. VolatilityState stores volatility data (separate for permissionless access). PoolAuthority signs. Two vaults hold tokens. LpMint creates LP tokens. Could we merge some? We could embed volatility data in PoolState, but that means every swap writes to a bigger account (more CU cost). Separate accounts = separate write costs = cheaper for operations that don't need both.

**Who pays for all this?** The `initialize_pool` caller pays rent for all six accounts. This costs roughly 0.02 SOL. In a production deployment, the protocol or first LP would pay this.

---

## Part F: Vault CPI map

Tokens move into and out of vaults through CPIs. Here's every movement:

```
Tokens INTO vault:
  add_liquidity a:  user → VaultA   signed by: user
  add_liquidity b:  user → VaultB   signed by: user
  swap (A→B):       user → VaultA   signed by: user
  swap (B→A):       user → VaultB   signed by: user

Tokens OUT OF vault:
  remove_liquidity a:  VaultA → user   signed by: PoolAuthority PDA
  remove_liquidity b:  VaultB → user   signed by: PoolAuthority PDA
  swap (A→B) output:   VaultB → user   signed by: PoolAuthority PDA
  swap (B→A) output:   VaultA → user   signed by: PoolAuthority PDA
```

Pattern: **money goes in signed by user, money comes out signed by PDA.** If this rule is violated anywhere, the protocol is broken.

---

## What we built

A vault system that can:
- Hold tokens from many depositors (via position tracking)
- Release tokens to many withdrawers (via proportional shares)
- Authorize transfers programmatically (via PoolAuthority PDA)
- Exist permanently without an admin key

This is the infrastructure every DeFi protocol needs. The AMM logic (swap math, LP shares, fee accrual) is layered on top.

---

[← Prev — Step 2 Building an Escrow](02-build-escrow.md) · [Next → Step 4 — Building an AMM](04-build-amm.md)
