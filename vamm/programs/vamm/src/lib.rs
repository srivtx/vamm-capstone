use anchor_lang::prelude::*;

pub mod constants;
pub mod error;
pub mod instructions;
pub mod math;
pub mod state;

pub use constants::*;
pub use error::*;
pub use instructions::*;
pub use math::*;
pub use state::*;

declare_id!("75yCYNeZrSoVKWk5kFti7tRpRacZHptmAqtPwfc9U4Zt");

#[program]
pub mod vamm {
    use super::*;

    /// Initialize a new V-AMM pool
    pub fn initialize_pool(
        ctx: Context<InitializePool>,
        pool_id: u16,
        base_fee_bps: u16,
        a_max: u64,
        k: u64,
    ) -> Result<()> {
        instructions::initialize_pool::handler(ctx, pool_id, base_fee_bps, a_max, k)
    }

    /// Add liquidity to the pool
    pub fn add_liquidity(
        ctx: Context<AddLiquidity>,
        amount_a: u64,
        amount_b: u64,
    ) -> Result<()> {
        instructions::add_liquidity::handler(ctx, amount_a, amount_b)
    }

    /// Remove liquidity from the pool
    pub fn remove_liquidity(
        ctx: Context<RemoveLiquidity>,
        shares: u128,
    ) -> Result<()> {
        instructions::remove_liquidity::handler(ctx, shares)
    }

    /// Execute a swap
    pub fn swap(
        ctx: Context<Swap>,
        amount_in: u64,
        min_amount_out: u64,
        is_a_to_b: bool,
    ) -> Result<()> {
        instructions::swap::handler(ctx, amount_in, min_amount_out, is_a_to_b)
    }

    /// Update volatility state (permissionless crank)
    pub fn update_volatility(ctx: Context<UpdateVolatility>) -> Result<()> {
        instructions::update_volatility::handler(ctx)
    }

    /// Update curve parameters (permissionless crank)
    pub fn update_curve(ctx: Context<UpdateCurve>) -> Result<()> {
        instructions::update_curve::handler(ctx)
    }
}
