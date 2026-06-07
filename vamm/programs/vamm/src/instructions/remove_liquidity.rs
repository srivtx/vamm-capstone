use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, Transfer};
use crate::state::*;
use crate::math::*;
use crate::error::ErrorCode;

/// Remove liquidity from the pool
#[derive(Accounts)]
pub struct RemoveLiquidity<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"pool", pool_state.token_mint_a.as_ref(), pool_state.token_mint_b.as_ref(), &pool_state.pool_id.to_le_bytes()],
        bump = pool_state.bump
    )]
    pub pool_state: Account<'info, PoolState>,

    /// CHECK: Pool authority PDA
    #[account(
        seeds = [b"authority", pool_state.key().as_ref()],
        bump
    )]
    pub pool_authority: AccountInfo<'info>,

    #[account(
        mut,
        seeds = [b"lp_mint", pool_state.key().as_ref()],
        bump
    )]
    pub lp_mint: Account<'info, Mint>,

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
        token::mint = pool_state.token_mint_a,
        token::authority = user,
    )]
    pub user_token_a: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = pool_state.token_mint_b,
        token::authority = user,
    )]
    pub user_token_b: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"position", pool_state.key().as_ref(), user.key().as_ref(), &[0u8]],
        bump = position.bump,
        constraint = position.owner == user.key()
    )]
    pub position: Account<'info, PositionState>,

    #[account(
        mut,
        token::mint = lp_mint,
        token::authority = user,
    )]
    pub user_lp_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(
    ctx: Context<RemoveLiquidity>,
    shares: u128,
) -> Result<()> {
    let pool_state = &mut ctx.accounts.pool_state;
    let position = &mut ctx.accounts.position;
    let clock = Clock::get()?;

    require!(shares > 0, ErrorCode::InvalidReserves);
    require!(position.shares >= shares, ErrorCode::InvalidReserves);

    // Sync curve
    pool_state.sync_curve(clock.slot);

    // Calculate amounts to withdraw
    let share_ratio = shares
        .checked_mul(VolatilityMath::SCALE)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(pool_state.total_lp_shares)
        .ok_or(ErrorCode::MathOverflow)?;

    let amount_a = (pool_state.reserve_a as u128)
        .checked_mul(share_ratio)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(VolatilityMath::SCALE)
        .ok_or(ErrorCode::MathOverflow)? as u64;

    let amount_b = (pool_state.reserve_b as u128)
        .checked_mul(share_ratio)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(VolatilityMath::SCALE)
        .ok_or(ErrorCode::MathOverflow)? as u64;

    // Burn LP tokens
    let seeds = &[
        b"authority",
        pool_state.to_account_info().key.as_ref(),
        &[ctx.bumps.pool_authority],
    ];
    let signer = &[&seeds[..]];

    token::burn(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            token::Burn {
                mint: ctx.accounts.lp_mint.to_account_info(),
                from: ctx.accounts.user_lp_token.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
            signer,
        ),
        shares as u64,
    )?;

    // Transfer tokens from vaults to user
    let cpi_accounts_a = Transfer {
        from: ctx.accounts.token_vault_a.to_account_info(),
        to: ctx.accounts.user_token_a.to_account_info(),
        authority: ctx.accounts.pool_authority.to_account_info(),
    };
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            cpi_accounts_a,
            signer,
        ),
        amount_a,
    )?;

    let cpi_accounts_b = Transfer {
        from: ctx.accounts.token_vault_b.to_account_info(),
        to: ctx.accounts.user_token_b.to_account_info(),
        authority: ctx.accounts.pool_authority.to_account_info(),
    };
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            cpi_accounts_b,
            signer,
        ),
        amount_b,
    )?;

    // Update state
    pool_state.reserve_a -= amount_a as u128;
    pool_state.reserve_b -= amount_b as u128;
    pool_state.total_lp_shares -= shares;
    position.shares -= shares;

    msg!("Liquidity removed: {} A, {} B, {} shares", amount_a, amount_b, shares);

    Ok(())
}
