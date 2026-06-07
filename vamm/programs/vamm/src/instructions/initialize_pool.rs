use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint};
use crate::state::*;
use crate::math::*;

/// Initialize a new V-AMM pool
#[derive(Accounts)]
#[instruction(pool_id: u16)]
pub struct InitializePool<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    pub token_mint_a: Account<'info, Mint>,
    pub token_mint_b: Account<'info, Mint>,

    #[account(
        init,
        payer = payer,
        space = PoolState::LEN,
        seeds = [b"pool", token_mint_a.key().as_ref(), token_mint_b.key().as_ref(), &pool_id.to_le_bytes()],
        bump
    )]
    pub pool_state: Account<'info, PoolState>,

    #[account(
        init,
        payer = payer,
        space = VolatilityState::LEN,
        seeds = [b"volatility", pool_state.key().as_ref()],
        bump
    )]
    pub volatility_state: Account<'info, VolatilityState>,

    /// CHECK: Pool authority PDA
    #[account(
        seeds = [b"authority", pool_state.key().as_ref()],
        bump
    )]
    pub pool_authority: AccountInfo<'info>,

    #[account(
        init,
        payer = payer,
        mint::decimals = 6,
        mint::authority = pool_authority,
        seeds = [b"lp_mint", pool_state.key().as_ref()],
        bump
    )]
    pub lp_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = payer,
        token::mint = token_mint_a,
        token::authority = pool_authority,
        seeds = [b"vault_a", pool_state.key().as_ref()],
        bump
    )]
    pub token_vault_a: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = payer,
        token::mint = token_mint_b,
        token::authority = pool_authority,
        seeds = [b"vault_b", pool_state.key().as_ref()],
        bump
    )]
    pub token_vault_b: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(
    ctx: Context<InitializePool>,
    pool_id: u16,
    base_fee_bps: u16,
    a_max: u64,
    k: u64,
) -> Result<()> {
    let pool_state = &mut ctx.accounts.pool_state;
    let volatility_state = &mut ctx.accounts.volatility_state;
    let clock = Clock::get()?;

    pool_state.bump = ctx.bumps.pool_state;
    pool_state.status = 0; // active
    pool_state.pool_id = pool_id;

    pool_state.token_mint_a = ctx.accounts.token_mint_a.key();
    pool_state.token_mint_b = ctx.accounts.token_mint_b.key();
    pool_state.token_vault_a = ctx.accounts.token_vault_a.key();
    pool_state.token_vault_b = ctx.accounts.token_vault_b.key();
    pool_state.lp_mint = ctx.accounts.lp_mint.key();
    pool_state.pool_authority = ctx.accounts.pool_authority.key();

    pool_state.reserve_a = 0;
    pool_state.reserve_b = 0;
    pool_state.total_lp_shares = 0;

    // Start with A_max (flat curve for stable pairs)
    pool_state.curve_a_current = a_max;
    pool_state.curve_a_target = a_max;
    pool_state.curve_a_start = a_max;
    pool_state.curve_ramp_start_slot = clock.slot;
    pool_state.curve_ramp_end_slot = clock.slot;

    pool_state.base_fee_bps = base_fee_bps;
    pool_state.current_fee_bps = base_fee_bps;
    pool_state.fee_ema = (base_fee_bps as u128)
        .checked_mul(VolatilityMath::SCALE)
        .unwrap_or(0);

    pool_state.fee_growth_global_a = 0;
    pool_state.fee_growth_global_b = 0;
    pool_state.protocol_fees_a = 0;
    pool_state.protocol_fees_b = 0;

    pool_state.last_swap_slot = clock.slot;
    pool_state.last_swap_price_x64 = 0;

    pool_state.a_max = a_max;
    pool_state.k = k;

    pool_state.volatility_state = volatility_state.key();
    pool_state.last_update_slot = clock.slot;

    // Initialize volatility state
    volatility_state.pool = pool_state.key();
    volatility_state.bump = ctx.bumps.volatility_state;
    volatility_state.bucket_15min_cursor = 0;
    volatility_state.bucket_15min_count = 0;
    volatility_state.buckets_15min = [PriceBucket::default(); 4];
    volatility_state.bucket_1hour_cursor = 0;
    volatility_state.bucket_1hour_count = 0;
    volatility_state.buckets_1hour = [PriceBucket::default(); 4];
    volatility_state.ewma_15min = 0;
    volatility_state.ewma_1hour = 0;
    volatility_state.last_tick = 0;
    volatility_state.last_slot = clock.slot;
    volatility_state.oracle_volatility = 0;
    volatility_state.oracle_last_update = 0;
    volatility_state.paused = false;

    msg!("V-AMM pool initialized: pool_id={}, a_max={}, base_fee={}bps", pool_id, a_max, base_fee_bps);

    Ok(())
}
