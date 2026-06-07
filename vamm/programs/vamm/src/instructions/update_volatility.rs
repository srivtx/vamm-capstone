use anchor_lang::prelude::*;
use crate::state::*;
use crate::math::*;
use crate::error::ErrorCode;

/// Update volatility state (permissionless crank)
#[derive(Accounts)]
pub struct UpdateVolatility<'info> {
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
}

pub fn handler(ctx: Context<UpdateVolatility>) -> Result<()> {
    let pool_state = &mut ctx.accounts.pool_state;
    let vol_state = &mut ctx.accounts.volatility_state;
    let clock = Clock::get()?;

    require!(!vol_state.paused, ErrorCode::InvalidReserves);

    // Check minimum delay (e.g., 1 slot minimum)
    if clock.slot <= vol_state.last_slot {
        return Ok(());
    }

    // Calculate annualized volatility from EWMA
    let annualized_vol = VolatilityMath::annualize_volatility(
        vol_state.ewma_15min,
        900, // 15 minutes in seconds (approximate on Solana)
    )?;

    // Clamp volatility to prevent extreme values
    let clamped_vol = annualized_vol.min(5_000_000_000_000u128); // Max 500% vol

    // Calculate target A from volatility
    let target_a = VolatilityMath::sigma_to_a(
        clamped_vol,
        pool_state.a_max,
        pool_state.k,
    )?;

    // Calculate target fee from volatility
    let target_fee = VolatilityMath::compute_fee(clamped_vol)?;

    // Smooth fee with EMA
    let smoothed_fee = VolatilityMath::smooth_fee(
        target_fee,
        pool_state.fee_ema,
        900_000_000_000u128, // alpha = 0.9
    )?;

    // Apply rate limiting
    let limited_fee = VolatilityMath::limit_fee_change(
        smoothed_fee,
        pool_state.current_fee_bps as u64,
        10, // Max 10 bps change per block
    );

    // Update pool state
    pool_state.current_fee_bps = limited_fee as u16;
    pool_state.fee_ema = (smoothed_fee as u128)
        .checked_mul(VolatilityMath::SCALE)
        .unwrap_or(0);

    // Update target A if significantly different
    let a_diff = if target_a > pool_state.curve_a_target {
        target_a - pool_state.curve_a_target
    } else {
        pool_state.curve_a_target - target_a
    };

    if a_diff > pool_state.curve_a_target / 10 {
        // More than 10% difference, update target
        pool_state.curve_a_start = pool_state.curve_a_current;
        pool_state.curve_a_target = target_a;
        pool_state.curve_ramp_start_slot = clock.slot;
        // Ramp over ~1 hour (9,000 slots)
        pool_state.curve_ramp_end_slot = clock.slot + 9000;
    }

    vol_state.last_slot = clock.slot;

    msg!("Volatility updated: vol={}bps, target_a={}, target_fee={}bps, current_fee={}bps",
        (clamped_vol / 10_000_000_000u128) as u64,
        target_a,
        target_fee,
        limited_fee
    );

    Ok(())
}
