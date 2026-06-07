use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, Transfer};
use crate::state::*;
use crate::math::*;

/// Add liquidity to the pool
#[derive(Accounts)]
pub struct AddLiquidity<'info> {
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
        init_if_needed,
        payer = user,
        space = PositionState::LEN,
        seeds = [b"position", pool_state.key().as_ref(), user.key().as_ref(), &[0u8]],
        bump
    )]
    pub position: Account<'info, PositionState>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = lp_mint,
        associated_token::authority = user,
    )]
    pub user_lp_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, anchor_spl::associated_token::AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(
    ctx: Context<AddLiquidity>,
    amount_a: u64,
    amount_b: u64,
) -> Result<()> {
    let pool_state = &mut ctx.accounts.pool_state;
    let position = &mut ctx.accounts.position;
    let clock = Clock::get()?;

    // Sync curve before operations
    pool_state.sync_curve(clock.slot);

    // Transfer tokens from user to vaults
    let cpi_accounts_a = Transfer {
        from: ctx.accounts.user_token_a.to_account_info(),
        to: ctx.accounts.token_vault_a.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.key();
    token::transfer(
        CpiContext::new(cpi_program.clone(), cpi_accounts_a),
        amount_a,
    )?;

    let cpi_accounts_b = Transfer {
        from: ctx.accounts.user_token_b.to_account_info(),
        to: ctx.accounts.token_vault_b.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };
    token::transfer(
        CpiContext::new(cpi_program, cpi_accounts_b),
        amount_b,
    )?;

    // Calculate LP shares
    let shares = if pool_state.total_lp_shares == 0 {
        // First liquidity provider
        let d = StableSwap::compute_d(
            &[amount_a as u128, amount_b as u128],
            pool_state.curve_a_current,
        )?;
        d
    } else {
        // Subsequent providers
        let old_reserves = pool_state.get_reserves();
        let new_reserves = [
            old_reserves[0] + amount_a as u128,
            old_reserves[1] + amount_b as u128,
        ];
        let old_d = StableSwap::compute_d(&old_reserves, pool_state.curve_a_current)?;
        let new_d = StableSwap::compute_d(&new_reserves, pool_state.curve_a_current)?;
        
        let share_ratio = new_d
            .checked_sub(old_d)
            .ok_or(crate::error::ErrorCode::MathOverflow)?
            .checked_mul(pool_state.total_lp_shares)
            .ok_or(crate::error::ErrorCode::MathOverflow)?
            .checked_div(old_d)
            .ok_or(crate::error::ErrorCode::MathOverflow)?;
        
        share_ratio
    };

    // Update reserves
    pool_state.reserve_a += amount_a as u128;
    pool_state.reserve_b += amount_b as u128;
    pool_state.total_lp_shares += shares;

    // Mint LP tokens to user
    let seeds = &[
        b"authority",
        pool_state.to_account_info().key.as_ref(),
        &[ctx.bumps.pool_authority],
    ];
    let signer = &[&seeds[..]];

    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            token::MintTo {
                mint: ctx.accounts.lp_mint.to_account_info(),
                to: ctx.accounts.user_lp_token.to_account_info(),
                authority: ctx.accounts.pool_authority.to_account_info(),
            },
            signer,
        ),
        shares as u64,
    )?;

    // Initialize or update position
    if position.shares == 0 {
        position.owner = ctx.accounts.user.key();
        position.pool = pool_state.key();
        position.bump = ctx.bumps.position;
        position.nonce = 0;
        position.entry_a = pool_state.curve_a_current;
    }
    position.shares += shares;
    position.fee_growth_inside_a_last = pool_state.fee_growth_global_a;
    position.fee_growth_inside_b_last = pool_state.fee_growth_global_b;

    msg!("Liquidity added: {} A, {} B, {} shares", amount_a, amount_b, shares);

    Ok(())
}
