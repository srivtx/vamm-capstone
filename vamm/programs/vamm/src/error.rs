use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Math overflow occurred")]
    MathOverflow,
    
    #[msg("Invalid reserves")]
    InvalidReserves,
    
    #[msg("Invalid amplification parameter")]
    InvalidAmplification,
    
    #[msg("Newton-Raphson convergence failed")]
    ConvergenceFailed,
    
    #[msg("Slippage tolerance exceeded")]
    SlippageExceeded,
    
    #[msg("Pool is paused")]
    PoolPaused,
    
    #[msg("Unauthorized access")]
    Unauthorized,
    
    #[msg("Invalid fee parameter")]
    InvalidFee,
    
    #[msg("Volatility oracle paused")]
    VolatilityPaused,
    
    #[msg("Zero amount")]
    ZeroAmount,
    
    #[msg("Invalid token account")]
    InvalidTokenAccount,
}
