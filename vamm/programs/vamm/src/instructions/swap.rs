use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::*;
use crate::math::*;
use crate::error::ErrorCode;

/// Execute a swap
#[derive(Accounts)]
pub struct Swap<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"pool", pool_state.token_mint_a.as_ref(), pool_state.token_mint_b.as_ref(), &pool_state.pool_id.to_le_bytes()],
        bump = pool_state.bump
    )]
    pub pool_state: Account<'info, PoolState>,

    #[account(
        mut,
        seeds = [b"volatility", pool_state.key().as_ref()],
        bump = volatility_state.bump
    )]
    pub volatility_state: Account<'info, VolatilityState>,

    /// CHECK: Pool authority PDA
    #[account(
        seeds = [b"authority", pool_state.key().as_ref()],
        bump
    )]
    pub pool_authority: AccountInfo<'info>,

    #[account(
        mut,
        token::mint = pool_state.token_mint_a,
        token::authority = pool_authority,
        seeds = [b"vault_a", pool_state.key().as_ref()],
        bump
    )]
    pub token_vault_a: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = pool_state.token_mint_b,
        token::authority = pool_authority,
        seeds = [b"vault_b", pool_state.key().as_ref()],
        bump
    )]
    pub token_vault_b: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::authority = user,
    )]
    pub user_source: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::authority = user,
    )]
    pub user_dest: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(
    ctx: Context<Swap>,
    amount_in: u64,
    min_amount_out: u64,
    is_a_to_b: bool,
) -> Result<()> {
    let pool_state = &mut ctx.accounts.pool_state;
    let volatility_state = &mut ctx.accounts.volatility_state;
    let clock = Clock::get()?;

    require!(amount_in > 0, ErrorCode::InvalidReserves);
    require!(pool_state.reserve_a > 0 && pool_state.reserve_b > 0, ErrorCode::InvalidReserves);

    // Validate token accounts
    let expected_source_mint = if is_a_to_b { pool_state.token_mint_a } else { pool_state.token_mint_b };
    let expected_dest_mint = if is_a_to_b { pool_state.token_mint_b } else { pool_state.token_mint_a };
    require!(ctx.accounts.user_source.mint == expected_source_mint, ErrorCode::InvalidTokenAccount);
    require!(ctx.accounts.user_dest.mint == expected_dest_mint, ErrorCode::InvalidTokenAccount);

    // Sync curve before swap
    pool_state.sync_curve(clock.slot);

    // Get current fee
    let fee_bps = pool_state.current_fee_bps;

    // Calculate fee
    let fee_amount = (amount_in as u128)
        .checked_mul(fee_bps as u128)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(10000)
        .ok_or(ErrorCode::MathOverflow)? as u64;

    let amount_in_after_fee = amount_in - fee_amount;

    // Calculate output using StableSwap
    let reserves = pool_state.get_reserves();
    let (i, j) = if is_a_to_b { (0, 1) } else { (1, 0) };

    let dy = StableSwap::get_dy(
        &reserves,
        i,
        j,
        amount_in_after_fee as u128,
        pool_state.curve_a_current,
    )?;

    let amount_out = dy as u64;

    require!(amount_out >= min_amount_out, ErrorCode::InvalidReserves);

    // Transfer input from user to vault
    let cpi_accounts_in = Transfer {
        from: ctx.accounts.user_source.to_account_info(),
        to: if is_a_to_b {
            ctx.accounts.token_vault_a.to_account_info()
        } else {
            ctx.accounts.token_vault_b.to_account_info()
        },
        authority: ctx.accounts.user.to_account_info(),
    };
    token::transfer(
        CpiContext::new(ctx.accounts.token_program.key(), cpi_accounts_in),
        amount_in,
    )?;

    // Transfer output from vault to user
    let seeds = &[
        b"authority",
        pool_state.to_account_info().key.as_ref(),
        &[ctx.bumps.pool_authority],
    ];
    let signer = &[&seeds[..]];

    let cpi_accounts_out = Transfer {
        from: if is_a_to_b {
            ctx.accounts.token_vault_b.to_account_info()
        } else {
            ctx.accounts.token_vault_a.to_account_info()
        },
        to: ctx.accounts.user_dest.to_account_info(),
        authority: ctx.accounts.pool_authority.to_account_info(),
    };
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            cpi_accounts_out,
            signer,
        ),
        amount_out,
    )?;

    // Update reserves
    if is_a_to_b {
        pool_state.reserve_a += amount_in as u128;
        pool_state.reserve_b -= amount_out as u128;
    } else {
        pool_state.reserve_b += amount_in as u128;
        pool_state.reserve_a -= amount_out as u128;
    }

    // Update fee growth
    let lp_fee = (fee_amount as u128)
        .checked_mul(9)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(10)
        .ok_or(ErrorCode::MathOverflow)?; // 90% to LPs
    let protocol_fee = fee_amount as u128 - lp_fee; // 10% to protocol

    if is_a_to_b {
        pool_state.fee_growth_global_a += lp_fee
            .checked_mul(1u128 << 64)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(pool_state.total_lp_shares.max(1))
            .ok_or(ErrorCode::MathOverflow)?;
        pool_state.protocol_fees_a += protocol_fee as u64;
    } else {
        pool_state.fee_growth_global_b += lp_fee
            .checked_mul(1u128 << 64)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(pool_state.total_lp_shares.max(1))
            .ok_or(ErrorCode::MathOverflow)?;
        pool_state.protocol_fees_b += protocol_fee as u64;
    }

    // Update swap breadcrumb for volatility tracking
    let price_x64 = if pool_state.reserve_a > 0 {
        pool_state.reserve_b
            .checked_mul(1u128 << 64)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(pool_state.reserve_a)
            .ok_or(ErrorCode::MathOverflow)?
    } else {
        0
    };

    pool_state.last_swap_slot = clock.slot;
    pool_state.last_swap_price_x64 = price_x64;

    // Update volatility state
    update_volatility_bucket(volatility_state, price_x64, amount_in, clock.slot)?;

    msg!("Swap: {} -> {}, amount_in={}, amount_out={}, fee={}bps", 
        if is_a_to_b { "A" } else { "B" },
        if is_a_to_b { "B" } else { "A" },
        amount_in, amount_out, fee_bps
    );

    Ok(())
}

/// Update volatility tracking with a new swap
fn update_volatility_bucket(
    vol_state: &mut VolatilityState,
    price_x64: u128,
    volume: u64,
    slot: u64,
) -> Result<()> {
    // Convert price to tick (approximate)
    let tick = if price_x64 > 0 {
        // log_{1.0001}(price) ≈ ln(price) / ln(1.0001)
        // For Q64.64, we use a simplified approach
        let price_scaled = price_x64 >> 32; // Scale down
        if price_scaled > 0 {
            // Approximate log2 then convert
            let log2 = 128u32.saturating_sub(price_scaled.leading_zeros());
            (log2 as i32).saturating_mul(6931).saturating_div(10000) // ln(2) ≈ 0.6931
        } else {
            0
        }
    } else {
        0
    };

    // Update current bucket
    let current_idx = vol_state.bucket_15min_cursor as usize % 4;
    let bucket = &mut vol_state.buckets_15min[current_idx];
    
    if bucket.timestamp_start == 0 {
        bucket.timestamp_start = slot as i64;
    }
    bucket.timestamp_end = slot as i64;
    bucket.tick_cumulative += (tick as i64).checked_mul(slot as i64).unwrap_or(0);
    bucket.volume += volume;

    // Update EWMA
    let delta_tick = (tick - vol_state.last_tick) as i64;
    let return_sq = VolatilityMath::tick_to_return_sq(delta_tick)?;
    
    vol_state.ewma_15min = VolatilityMath::update_ewma(
        vol_state.ewma_15min,
        return_sq,
        950_000_000_000u128, // lambda = 0.95
    )?;

    vol_state.last_tick = tick;
    vol_state.last_slot = slot;

    Ok(())
}
