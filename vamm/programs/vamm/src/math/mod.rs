use anchor_lang::prelude::*;
use crate::error::ErrorCode;

/// StableSwap math utilities for V-AMM
/// Based on Curve Finance StableSwap invariant
pub struct StableSwap;

impl StableSwap {
    /// Number of coins in the pool (always 2 for our implementation)
    pub const N_COINS: u64 = 2;
    /// Precision for amplification parameter
    pub const A_PRECISION: u64 = 100;
    /// Max iterations for Newton-Raphson
    pub const MAX_ITERATIONS: u8 = 64;

    /// Calculate D invariant given reserves and amplification parameter
    /// 
    /// Newton-Raphson iteration:
    /// D_{j+1} = (A * n^n * S + D_j^{n+1} / (n^n * P)) / (A * n^n - 1)
    /// 
    /// Where:
    /// - S = sum of reserves
    /// - P = product of reserves
    /// - n = number of coins
    /// - A = amplification parameter
    pub fn compute_d(reserves: &[u128; 2], amp: u64) -> Result<u128> {
        let sum_x = reserves[0].checked_add(reserves[1]).ok_or(ErrorCode::MathOverflow)?;
        
        if sum_x == 0 {
            return Ok(0);
        }

        let ann = (amp as u128)
            .checked_mul(Self::N_COINS as u128)
            .ok_or(ErrorCode::MathOverflow)?;
        let ann = ann
            .checked_mul(Self::N_COINS as u128)
            .ok_or(ErrorCode::MathOverflow)?;

        let mut d = sum_x;
        
        for _ in 0..Self::MAX_ITERATIONS {
            let d_p = d;
            let d_p = d_p
                .checked_mul(d)
                .ok_or(ErrorCode::MathOverflow)?
                .checked_div(reserves[0].checked_mul(Self::N_COINS as u128).ok_or(ErrorCode::MathOverflow)?)
                .ok_or(ErrorCode::MathOverflow)?;
            let d_p = d_p
                .checked_mul(d)
                .ok_or(ErrorCode::MathOverflow)?
                .checked_div(reserves[1].checked_mul(Self::N_COINS as u128).ok_or(ErrorCode::MathOverflow)?)
                .ok_or(ErrorCode::MathOverflow)?;

            let d_prev = d;
            
            let numerator = ann
                .checked_mul(sum_x)
                .ok_or(ErrorCode::MathOverflow)?
                .checked_div(Self::A_PRECISION as u128)
                .ok_or(ErrorCode::MathOverflow)?
                .checked_add(d_p.checked_mul(Self::N_COINS as u128).ok_or(ErrorCode::MathOverflow)?)
                .ok_or(ErrorCode::MathOverflow)?;
            
            let denominator = ann
                .checked_div(Self::A_PRECISION as u128)
                .ok_or(ErrorCode::MathOverflow)?
                .checked_sub(1)
                .ok_or(ErrorCode::MathOverflow)?
                .checked_mul(d)
                .ok_or(ErrorCode::MathOverflow)?
                .checked_div(Self::A_PRECISION as u128)
                .ok_or(ErrorCode::MathOverflow)?
                .checked_add(d_p.checked_mul(Self::N_COINS.checked_add(1).ok_or(ErrorCode::MathOverflow)?.into()).ok_or(ErrorCode::MathOverflow)?)
                .ok_or(ErrorCode::MathOverflow)?;

            d = numerator
                .checked_mul(d_prev)
                .ok_or(ErrorCode::MathOverflow)?
                .checked_div(denominator)
                .ok_or(ErrorCode::MathOverflow)?;

            // Check convergence
            if d > d_prev {
                if d.checked_sub(d_prev).ok_or(ErrorCode::MathOverflow)? <= 1 {
                    break;
                }
            } else {
                if d_prev.checked_sub(d).ok_or(ErrorCode::MathOverflow)? <= 1 {
                    break;
                }
            }
        }

        Ok(d)
    }

    /// Calculate output y given input x, D, and amplification
    /// Used for trade execution: given x + dx, find new y
    pub fn compute_y(x: u128, d: u128, amp: u64) -> Result<u128> {
        let ann = (amp as u128)
            .checked_mul(Self::N_COINS as u128)
            .ok_or(ErrorCode::MathOverflow)?;
        let ann = ann
            .checked_mul(Self::N_COINS as u128)
            .ok_or(ErrorCode::MathOverflow)?;
        
        let c = d
            .checked_mul(d)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(Self::N_COINS as u128)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_mul(d)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(Self::N_COINS as u128)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_mul(d)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(x.checked_mul(Self::N_COINS as u128).ok_or(ErrorCode::MathOverflow)?)
            .ok_or(ErrorCode::MathOverflow)?;

        let b = x
            .checked_add(d.checked_mul(ann).ok_or(ErrorCode::MathOverflow)?.checked_div(Self::A_PRECISION as u128).ok_or(ErrorCode::MathOverflow)?)
            .ok_or(ErrorCode::MathOverflow)?;

        let mut y = d;
        
        for _ in 0..Self::MAX_ITERATIONS {
            let y_prev = y;
            
            let numerator = y
                .checked_mul(y)
                .ok_or(ErrorCode::MathOverflow)?
                .checked_add(c)
                .ok_or(ErrorCode::MathOverflow)?;
            
            let denominator = y
                .checked_mul(2)
                .ok_or(ErrorCode::MathOverflow)?
                .checked_add(b)
                .ok_or(ErrorCode::MathOverflow)?
                .checked_sub(d)
                .ok_or(ErrorCode::MathOverflow)?;

            y = numerator
                .checked_div(denominator)
                .ok_or(ErrorCode::MathOverflow)?;

            // Check convergence
            if y > y_prev {
                if y.checked_sub(y_prev).ok_or(ErrorCode::MathOverflow)? <= 1 {
                    break;
                }
            } else {
                if y_prev.checked_sub(y).ok_or(ErrorCode::MathOverflow)? <= 1 {
                    break;
                }
            }
        }

        Ok(y)
    }

    /// Calculate the output amount for a swap
    /// Given reserves, input amount, and amplification, compute output
    pub fn get_dy(
        reserves: &[u128; 2],
        i: usize,      // index of input token
        j: usize,      // index of output token
        dx: u128,      // input amount (after fee)
        amp: u64,
    ) -> Result<u128> {
        let d = Self::compute_d(reserves, amp)?;
        
        let x = reserves[i]
            .checked_add(dx)
            .ok_or(ErrorCode::MathOverflow)?;
        
        let y = Self::compute_y(x, d, amp)?;
        
        let dy = reserves[j]
            .checked_sub(y)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_sub(1) // Subtract 1 to round down
            .ok_or(ErrorCode::MathOverflow)?;

        Ok(dy)
    }

    /// Calculate spot price (marginal rate)
    /// Returns price of token j in terms of token i
    pub fn get_price(reserves: &[u128; 2], amp: u64) -> Result<u128> {
        let d = Self::compute_d(reserves, amp)?;
        
        // Simplified price calculation
        // P = (16A * x^2 * y^2 + D^3 * y) / (16A * x^2 * y^2 + D^3 * x)
        let a = amp as u128;
        let x2y2 = reserves[0]
            .checked_mul(reserves[0])
            .ok_or(ErrorCode::MathOverflow)?
            .checked_mul(reserves[1])
            .ok_or(ErrorCode::MathOverflow)?
            .checked_mul(reserves[1])
            .ok_or(ErrorCode::MathOverflow)?;
        
        let d3 = d
            .checked_mul(d)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_mul(d)
            .ok_or(ErrorCode::MathOverflow)?;

        let term1 = 16u128
            .checked_mul(a)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_mul(x2y2)
            .ok_or(ErrorCode::MathOverflow)?;

        let numerator = term1
            .checked_add(d3.checked_mul(reserves[1]).ok_or(ErrorCode::MathOverflow)?)
            .ok_or(ErrorCode::MathOverflow)?;
        
        let denominator = term1
            .checked_add(d3.checked_mul(reserves[0]).ok_or(ErrorCode::MathOverflow)?)
            .ok_or(ErrorCode::MathOverflow)?;

        // Price scaled by 1e18
        let price = numerator
            .checked_mul(1_000_000_000_000_000_000u128)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(denominator)
            .ok_or(ErrorCode::MathOverflow)?;

        Ok(price)
    }
}

/// Volatility and fee math
pub struct VolatilityMath;

impl VolatilityMath {
    /// Scale factor for fixed-point math
    pub const SCALE: u128 = 1_000_000_000_000; // 1e12
    /// Seconds per year
    pub const SECONDS_PER_YEAR: u64 = 31_536_000;
    /// LN(1.0001) ≈ 0.000099995
    pub const LN_10001: u128 = 99_995; // Scaled by 1e9

    /// Compute EWMA variance update
    /// variance_new = lambda * variance_old + (1 - lambda) * return_sq
    pub fn update_ewma(
        variance_old: u128,
        return_sq: u128,
        lambda: u128, // Scaled by SCALE
    ) -> Result<u128> {
        let one_minus_lambda = VolatilityMath::SCALE
            .checked_sub(lambda)
            .ok_or(ErrorCode::MathOverflow)?;

        let term1 = lambda
            .checked_mul(variance_old)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(VolatilityMath::SCALE)
            .ok_or(ErrorCode::MathOverflow)?;

        let term2 = one_minus_lambda
            .checked_mul(return_sq)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(VolatilityMath::SCALE)
            .ok_or(ErrorCode::MathOverflow)?;

        term1
            .checked_add(term2)
            .ok_or(ErrorCode::MathOverflow.into())
    }

    /// Convert tick difference to squared log return
    pub fn tick_to_return_sq(delta_tick: i64) -> Result<u128> {
        let dt = delta_tick.abs() as u128;
        let return_val = dt
            .checked_mul(Self::LN_10001)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(1_000_000_000)
            .ok_or(ErrorCode::MathOverflow)?;
        
        return_val
            .checked_mul(return_val)
            .ok_or(ErrorCode::MathOverflow.into())
    }

    /// Annualize volatility from bucket variance
    pub fn annualize_volatility(
        variance: u128,
        bucket_seconds: u64,
    ) -> Result<u128> {
        // sigma_annual = sqrt(variance) * sqrt(seconds_per_year / bucket_seconds)
        let rv = Self::integer_sqrt(variance)?;
        
        let annualization_factor = Self::integer_sqrt(
            (Self::SECONDS_PER_YEAR as u128)
                .checked_mul(Self::SCALE)
                .ok_or(ErrorCode::MathOverflow)?
                .checked_div(bucket_seconds as u128)
                .ok_or(ErrorCode::MathOverflow)?,
        )?;

        rv
            .checked_mul(annualization_factor)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(Self::SCALE)
            .ok_or(ErrorCode::MathOverflow.into())
    }

    /// Integer square root using Babylonian method
    pub fn integer_sqrt(n: u128) -> Result<u128> {
        if n == 0 {
            return Ok(0);
        }

        let mut x = n;
        let mut y = (x + 1) / 2;

        for _ in 0..128 {
            if y >= x {
                break;
            }
            x = y;
            y = (x + n / x) / 2;
        }

        Ok(x)
    }

    /// Map volatility to amplification parameter A
    /// A(sigma) = A_max * exp(-k * sigma)
    /// We use a linear approximation for on-chain efficiency
    pub fn sigma_to_a(sigma: u128, a_max: u64, k: u64) -> Result<u64> {
        // sigma is scaled by SCALE (1e12)
        // k is a parameter (e.g., 200 for k=2.0 scaled by 100)
        
        let exponent = sigma
            .checked_mul(k as u128)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(100)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(Self::SCALE)
            .ok_or(ErrorCode::MathOverflow)?;

        // Approximate exp(-x) as 1 - x for small x, or use lookup table
        // For simplicity, use piecewise linear:
        let a = if exponent >= Self::SCALE {
            // sigma * k >= 1.0, use minimum A
            1u64
        } else {
            let scale_factor = Self::SCALE
                .checked_sub(exponent)
                .ok_or(ErrorCode::MathOverflow)?;
            
            ((a_max as u128)
                .checked_mul(scale_factor)
                .ok_or(ErrorCode::MathOverflow)?
                .checked_div(Self::SCALE)
                .ok_or(ErrorCode::MathOverflow)?) as u64
        };

        Ok(a.max(1))
    }

    /// Compute dynamic fee using hybrid smoothstep
    pub fn compute_fee(sigma: u128) -> Result<u64> {
        // sigma is scaled by SCALE (1e12), representing annualized volatility as decimal
        // e.g., 0.20 = 20% annualized vol
        
        let fee_bps: u64;
        
        if sigma <= 150_000_000_000u128 {
            // sigma <= 15%: 5 bps
            fee_bps = 5;
        } else if sigma < 750_000_000_000u128 {
            // 15% < sigma < 75%: smooth ramp from 5 to 30 bps
            let t = (sigma - 150_000_000_000u128)
                .checked_mul(Self::SCALE)
                .ok_or(ErrorCode::MathOverflow)?
                .checked_div(600_000_000_000u128)
                .ok_or(ErrorCode::MathOverflow)?;
            
            let smooth = Self::smoothstep(t)?;
            fee_bps = 5u64 + ((25u128
                .checked_mul(smooth)
                .ok_or(ErrorCode::MathOverflow)?
                .checked_div(Self::SCALE)
                .ok_or(ErrorCode::MathOverflow)?) as u64);
        } else if sigma < 1_200_000_000_000u128 {
            // 75% <= sigma < 120%: smooth ramp from 30 to 100 bps
            let t = (sigma - 750_000_000_000u128)
                .checked_mul(Self::SCALE)
                .ok_or(ErrorCode::MathOverflow)?
                .checked_div(450_000_000_000u128)
                .ok_or(ErrorCode::MathOverflow)?;
            
            let smooth = Self::smoothstep(t)?;
            fee_bps = 30u64 + ((70u128
                .checked_mul(smooth)
                .ok_or(ErrorCode::MathOverflow)?
                .checked_div(Self::SCALE)
                .ok_or(ErrorCode::MathOverflow)?) as u64);
        } else {
            // sigma >= 120%: cap at 100 bps
            fee_bps = 100;
        }

        Ok(fee_bps.min(150))
    }

    /// Smoothstep function: S(x) = 3x^2 - 2x^3
    /// Input and output are scaled by SCALE
    pub fn smoothstep(x: u128) -> Result<u128> {
        if x >= Self::SCALE {
            return Ok(Self::SCALE);
        }
        if x == 0 {
            return Ok(0);
        }

        let x2 = x
            .checked_mul(x)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(Self::SCALE)
            .ok_or(ErrorCode::MathOverflow)?;
        
        let x3 = x2
            .checked_mul(x)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(Self::SCALE)
            .ok_or(ErrorCode::MathOverflow)?;

        let three_x2 = 3u128
            .checked_mul(x2)
            .ok_or(ErrorCode::MathOverflow)?;
        
        let two_x3 = 2u128
            .checked_mul(x3)
            .ok_or(ErrorCode::MathOverflow)?;

        three_x2
            .checked_sub(two_x3)
            .ok_or(ErrorCode::MathOverflow.into())
    }

    /// Apply EMA smoothing to fee
    pub fn smooth_fee(fee_raw: u64, fee_ema: u128, alpha: u128) -> Result<u64> {
        let fee_raw_scaled = (fee_raw as u128)
            .checked_mul(Self::SCALE)
            .ok_or(ErrorCode::MathOverflow)?;

        let one_minus_alpha = Self::SCALE
            .checked_sub(alpha)
            .ok_or(ErrorCode::MathOverflow)?;

        let new_ema = alpha
            .checked_mul(fee_ema)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(Self::SCALE)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_add(
                one_minus_alpha
                    .checked_mul(fee_raw_scaled)
                    .ok_or(ErrorCode::MathOverflow)?
                    .checked_div(Self::SCALE)
                    .ok_or(ErrorCode::MathOverflow)?,
            )
            .ok_or(ErrorCode::MathOverflow)?;

        Ok((new_ema
            .checked_div(Self::SCALE)
            .ok_or(ErrorCode::MathOverflow)?) as u64)
    }

    /// Apply rate limiting to fee changes
    pub fn limit_fee_change(fee_new: u64, fee_old: u64, max_delta: u64) -> u64 {
        if fee_new > fee_old {
            let delta = fee_new - fee_old;
            if delta > max_delta {
                fee_old + max_delta
            } else {
                fee_new
            }
        } else {
            let delta = fee_old - fee_new;
            if delta > max_delta {
                fee_old - max_delta
            } else {
                fee_new
            }
        }
    }
}
