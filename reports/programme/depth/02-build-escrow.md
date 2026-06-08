# Step 2: Building an Escrow

We need a program that holds tokens until a condition is met. Two people. One deposits. The other claims. Or the depositor cancels. No trusted third party.

This is the "hello world" of Solana DeFi. If you understand escrow, you understand every program that follows.

---

## Why build an escrow first?

An escrow teaches every pattern an AMM uses:

| Escrow concept | AMM equivalent |
|---|---|
| Lock tokens in a vault | Pool vaults hold reserves |
| PDA as authority | PoolAuthority PDA signs withdrawals |
| State account tracking who-owes-what | PoolState + PositionState |
| CPIs to SPL Token for transfers | Same CPIs in swap/add/remove |
| Account lifecycle (init → use → close) | Same for position accounts |

An escrow is 80% of an AMM's infrastructure with 20% of the complexity.

---

## Part A: What do we need to store?

The escrow needs to remember:
- Who deposited the tokens (the maker)
- Who receives them (the taker)  
- How many tokens are locked
- Whether the escrow is still active

**Why a separate state account?** We could store this in the vault token account, but token accounts only store balances and authorities. We need custom data. So we create an `EscrowState` PDA.

```rust
// What we need to store:
pub struct EscrowState {
    pub maker: Pubkey,          // who deposited
    pub taker: Pubkey,          // who can claim
    pub amount: u64,            // how many tokens locked
    pub bump: u8,               // PDA bump seed (needed to sign as PDA)
}
```

**Why store the bump?** When the program signs as this PDA later (to release tokens), it needs the bump seed to reconstruct the PDA's address. If we don't store it, we'd need to brute-force find it again — expensive.

---

## Part B: How do we find this account later?

The taker needs to find the escrow account to claim their tokens. The maker needs to find it to cancel.

**Option A: Store the address somewhere else.** Bad — another account to manage, another storage cost.

**Option B: Derive it from known data.** We know the maker's key and the taker's key at creation time. Use them as PDA seeds:

```
escrow_state_address = derive(["escrow", maker_pubkey, taker_pubkey])
```

**Why these specific seeds?** Because:
- `"escrow"` — prevents collision with other PDA types in the same program
- `maker_pubkey` — the maker can find all their escrows (they know their own key)
- `taker_pubkey` — the taker can find escrows meant for them

Anyone who knows both parties can compute the escrow address without an indexer.

---

## Part C: Where do the actual tokens go?

The `EscrowState` stores metadata. The tokens need to go somewhere physical.

**Option A: Send tokens directly to the EscrowState PDA.** Can't — PDAs store program data, not token balances. Token balances live in token accounts.

**Option B: Create a separate token account for the escrow.** We need a token account owned by a PDA that the program controls.

**Why a PDA-owned token account?** If the maker owned it, they could withdraw anytime — the escrow is pointless. If the taker owned it, they could withdraw before the condition — defeats the purpose. A PDA has no private key — only the program can authorize transfers.

```
Token account authority = derive(["escrow_vault", escrow_state])
```

**Why derive from escrow_state?** Because every escrow has a unique state account. Deriving the vault from the state ensures one vault per escrow — no collisions.

---

## Part D: The three instructions

### Initialize

**What it does:** Creates the EscrowState PDA and the vault token account.

**How it works:**

```
1. User calls: init_escrow(taker: Pubkey, amount: u64)
2. Create EscrowState PDA:
   seeds = ["escrow", user.key(), taker.key()]
   space = 8 + 32 + 32 + 8 + 1  (discriminator + maker + taker + amount + bump)
3. Store: maker = user, taker = taker, amount = amount, bump = pda_bump
4. Create vault token account:
   seeds = ["escrow_vault", escrow_state.key()]
   mint = token_mint, authority = escrow vault PDA
```

**Why `init` and not `init_if_needed`?** `init` ensures the account doesn't already exist — you can't accidentally overwrite someone else's escrow. `init_if_needed` would be dangerous here because it could silently reuse an existing account.

**Who pays for this?** The maker pays rent for both the state account and the token account. This is the `payer = user` constraint in Anchor. The maker has incentive to pay because they want the escrow to exist.

### Deposit

**What it does:** Transfers tokens from maker to the escrow vault.

**How it works:**

```
1. User calls: deposit()
2. Verify: user == escrow_state.maker (only the maker can deposit)
3. CPI: SPL Token transfer(user_token → escrow_vault, authority=user)
   Signed by: user (depositing their own tokens)
```

**Why verify the maker?** Anyone could attempt to deposit to any escrow. The check ensures only the intended depositor funds it.

**Why user signs, not PDA?** The tokens come from the user's wallet. The user authorizes the movement. This is Pattern 1 from Step 1.

### Claim (taker receives tokens)

**What it does:** Sends tokens from vault to taker, closes the escrow.

**How it works:**

```
1. Anyone calls: claim()  (yes, anyone — the taker doesn't need to sign)
2. CPI: SPL Token transfer(escrow_vault → taker_token_account, authority=escrow_vault_pda)
   Signed by: escrow vault PDA
3. Close escrow state account (refund rent to maker)
4. Close vault token account (refund rent to maker)
```

**Why can anyone call claim?** The condition is "tokens exist in the vault." There's no dispute mechanism — if tokens are there, they're meant for the taker. Making it permissionless means the taker doesn't need to sign (useful for bots/automation).

**Why PDA signs?** The tokens are in the vault. The maker can't sign (they don't own the vault). The taker can't sign (they don't own the vault either). Only the program's PDA can authorize the withdrawal. This is Pattern 2 from Step 1.

### Cancel (maker changes their mind)

**What it does:** Returns tokens to maker, closes the escrow.

**How it works:**

```
1. Maker calls: cancel()
2. Verify: user == escrow_state.maker (only the maker can cancel)
3. CPI: SPL Token transfer(escrow_vault → maker_token_account, authority=escrow_vault_pda)
   Signed by: escrow vault PDA
4. Close both accounts, refund rent
```

**Why only the maker can cancel?** If anyone could cancel, the taker has no assurance. The tokens are locked from the taker's perspective — the maker can pull out, but nobody else can.

---

## Part E: Complete CPI map

Every instruction, every CPI, every signer:

```
init_escrow:
  System Program (create escrow state)    payer: maker
  System Program (create vault token)     payer: maker
  Token Program (init vault token)       no signer needed

deposit:
  Token Program (transfer to vault)       authority: maker

claim:
  Token Program (transfer to taker)       authority: escrow_vault PDA
  Token Program (close vault)            authority: escrow_vault PDA
  System Program (close state)           (refunds rent to maker)

cancel:
  Token Program (transfer to maker)       authority: escrow_vault PDA
  Token Program (close vault)            authority: escrow_vault PDA
  System Program (close state)           (refunds rent to maker)
```

---

## Part F: What we built and why it matters for AMMs

| Piece | Escrow | AMM |
|---|---|---|
| State PDA | EscrowState | PoolState + PositionState |
| Token vault | Single vault PDA | Two vault PDAs (VaultA, VaultB) |
| Authority | Escrow vault PDA | PoolAuthority PDA |
| Transfer to vault | deposit() signed by user | add_liquidity() signed by user |
| Transfer from vault | claim() signed by PDA | swap output / withdraw signed by PDA |
| Account lifecycle | init → use → close | init → use (close on final withdrawal) |
| Seed strategy | ["escrow", maker, taker] | ["pool", mint_a, mint_b, pool_id] |

The AMM is an escrow with more state, more signers, and math instead of conditions. But the infrastructure — PDAs, vaults, CPI patterns — is identical.

---

[← Prev — Step 1 How Programs Talk](01-how-programs-talk.md) · [Next → Step 3 — Building a Vault](03-build-vault.md)
