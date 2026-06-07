use anchor_lang::prelude::*;
use crate::state::*;

/// Update curve parameters (permissionless crank)
/// This instruction primarily ensures the curve is synced
#[derive(Accounts)]
pub struct UpdateCurve<'info> {
    #[account(
        mut,
        seeds = [b"pool", pool_state.token_mint_a.as_ref(), pool_state.token_mint_b.as_ref(), &pool_state.pool_id.to_le_bytes()],
        bump = pool_state.bump
    )]
    pub pool_state: Account<'info, PoolState>,
}

pub fn handler(ctx: Context<UpdateCurve>) -> Result<()> {
    let pool_state = &mut ctx.accounts.pool_state;
    let clock = Clock::get()?;

    // Sync curve interpolation
    let old_a = pool_state.curve_a_current;
    pool_state.sync_curve(clock.slot);

    if old_a != pool_state.curve_a_current {
        msg!("Curve updated: A={} -> A={}", old_a, pool_state.curve_a_current);
    }

    Ok(())
}
