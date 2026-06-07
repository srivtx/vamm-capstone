use anchor_lang::prelude::*;

/// Pool state account
#[account]
pub struct PoolState {
    /// Bump seed for PDA
    pub bump: u8,
    /// Status: 0=active, 1=paused, 2=ramping
    pub status: u8,
    /// Pool ID (allows multiple pools per mint pair)
    pub pool_id: u16,

    /// Token mint A
    pub token_mint_a: Pubkey,
    /// Token mint B
    pub token_mint_b: Pubkey,
    /// Token vault A (ATA of pool_authority)
    pub token_vault_a: Pubkey,
    /// Token vault B (ATA of pool_authority)
    pub token_vault_b: Pubkey,
    /// LP token mint
    pub lp_mint: Pubkey,
    /// Pool authority PDA
    pub pool_authority: Pubkey,

    /// Reserve A
    pub reserve_a: u128,
    /// Reserve B
    pub reserve_b: u128,
    /// Total LP shares
    pub total_lp_shares: u128,

    /// Current amplification A
    pub curve_a_current: u64,
    /// Target amplification A
    pub curve_a_target: u64,
    /// Starting amplification for ramp
    pub curve_a_start: u64,
    /// Ramp start slot
    pub curve_ramp_start_slot: u64,
    /// Ramp end slot
    pub curve_ramp_end_slot: u64,

    /// Base fee in bps
    pub base_fee_bps: u16,
    /// Current dynamic fee in bps
    pub current_fee_bps: u16,
    /// Fee EMA (scaled by 1e12)
    pub fee_ema: u128,

    /// Cumulative fee per LP share (token A, scaled by 2^64)
    pub fee_growth_global_a: u128,
    /// Cumulative fee per LP share (token B, scaled by 2^64)
    pub fee_growth_global_b: u128,

    /// Protocol fees accumulated (token A)
    pub protocol_fees_a: u64,
    /// Protocol fees accumulated (token B)
    pub protocol_fees_b: u64,

    /// Last swap slot
    pub last_swap_slot: u64,
    /// Last swap price (Q64.64)
    pub last_swap_price_x64: u128,

    /// Maximum amplification parameter
    pub a_max: u64,
    /// Volatility sensitivity parameter
    pub k: u64,

    /// Volatility state PDA
    pub volatility_state: Pubkey,

    /// Last update slot
    pub last_update_slot: u64,
}

impl PoolState {
    pub const LEN: usize = 8 + // discriminator
        1 + // bump
        1 + // status
        2 + // pool_id
        32 + // token_mint_a
        32 + // token_mint_b
        32 + // token_vault_a
        32 + // token_vault_b
        32 + // lp_mint
        32 + // pool_authority
        16 + // reserve_a
        16 + // reserve_b
        16 + // total_lp_shares
        8 + // curve_a_current
        8 + // curve_a_target
        8 + // curve_a_start
        8 + // curve_ramp_start_slot
        8 + // curve_ramp_end_slot
        2 + // base_fee_bps
        2 + // current_fee_bps
        16 + // fee_ema
        16 + // fee_growth_global_a
        16 + // fee_growth_global_b
        8 + // protocol_fees_a
        8 + // protocol_fees_b
        8 + // last_swap_slot
        16 + // last_swap_price_x64
        8 + // a_max
        8 + // k
        32 + // volatility_state
        8; // last_update_slot

    /// Interpolate A during ramp
    pub fn sync_curve(&mut self, current_slot: u64) {
        if current_slot >= self.curve_ramp_end_slot {
            self.curve_a_current = self.curve_a_target;
            return;
        }

        if current_slot <= self.curve_ramp_start_slot {
            return;
        }

        let elapsed = current_slot - self.curve_ramp_start_slot;
        let duration = self.curve_ramp_end_slot - self.curve_ramp_start_slot;

        if duration == 0 {
            self.curve_a_current = self.curve_a_target;
            return;
        }

        // Linear interpolation
        let delta = if self.curve_a_target > self.curve_a_start {
            let diff = self.curve_a_target - self.curve_a_start;
            let progress = (diff as u128)
                .checked_mul(elapsed as u128)
                .unwrap_or(0)
                .checked_div(duration as u128)
                .unwrap_or(0) as u64;
            progress.min(diff)
        } else {
            let diff = self.curve_a_start - self.curve_a_target;
            let progress = (diff as u128)
                .checked_mul(elapsed as u128)
                .unwrap_or(0)
                .checked_div(duration as u128)
                .unwrap_or(0) as u64;
            progress.min(diff)
        };

        self.curve_a_current = if self.curve_a_target > self.curve_a_start {
            self.curve_a_start + delta
        } else {
            self.curve_a_start - delta
        };
    }

    /// Get reserves as array for math operations
    pub fn get_reserves(&self) -> [u128; 2] {
        [self.reserve_a, self.reserve_b]
    }

    /// Set reserves from array
    pub fn set_reserves(&mut self, reserves: [u128; 2]) {
        self.reserve_a = reserves[0];
        self.reserve_b = reserves[1];
    }
}

/// Volatility state account
#[account]
pub struct VolatilityState {
    /// Backlink to pool
    pub pool: Pubkey,
    /// Bump seed
    pub bump: u8,

    /// 15-minute bucket cursor
    pub bucket_15min_cursor: u16,
    /// Number of populated 15-min buckets
    pub bucket_15min_count: u16,
    /// 15-minute price buckets (4 buckets = 1 hour)
    pub buckets_15min: [PriceBucket; 4],

    /// 1-hour bucket cursor
    pub bucket_1hour_cursor: u16,
    /// Number of populated 1-hour buckets
    pub bucket_1hour_count: u16,
    /// 1-hour price buckets (4 buckets = 4 hours)
    pub buckets_1hour: [PriceBucket; 4],

    /// EWMA variance for 15-min buckets (scaled by 1e12)
    pub ewma_15min: u128,
    /// EWMA variance for 1-hour buckets (scaled by 1e12)
    pub ewma_1hour: u128,

    /// Last recorded tick
    pub last_tick: i32,
    /// Last update slot
    pub last_slot: u64,

    /// Current volatility from oracle (scaled by 1e12)
    pub oracle_volatility: u128,
    /// Last oracle update timestamp
    pub oracle_last_update: i64,

    /// Whether volatility updates are paused
    pub paused: bool,
}

impl VolatilityState {
    pub const LEN: usize = 8 + // discriminator
        32 + // pool
        1 + // bump
        2 + // bucket_15min_cursor
        2 + // bucket_15min_count
        4 * PriceBucket::LEN + // buckets_15min
        2 + // bucket_1hour_cursor
        2 + // bucket_1hour_count
        4 * PriceBucket::LEN + // buckets_1hour
        16 + // ewma_15min
        16 + // ewma_1hour
        4 + // last_tick
        8 + // last_slot
        16 + // oracle_volatility
        8 + // oracle_last_update
        1; // paused

    /// Get current bucket for 15-min window
    pub fn current_15min_bucket(&mut self) -> &mut PriceBucket {
        let idx = self.bucket_15min_cursor as usize % 4;
        &mut self.buckets_15min[idx]
    }

    /// Get current bucket for 1-hour window
    pub fn current_1hour_bucket(&mut self) -> &mut PriceBucket {
        let idx = self.bucket_1hour_cursor as usize % 4;
        &mut self.buckets_1hour[idx]
    }

    /// Close current 15-min bucket and advance
    pub fn close_15min_bucket(&mut self, tick: i32, volume: u64, slot: u64) {
        let idx = self.bucket_15min_cursor as usize % 4;
        self.buckets_15min[idx] = PriceBucket {
            tick_cumulative: (tick as i64).checked_mul(slot as i64).unwrap_or(0),
            volume,
            timestamp_start: slot as i64,
            timestamp_end: slot as i64,
        };
        self.bucket_15min_cursor = self.bucket_15min_cursor.wrapping_add(1);
        if self.bucket_15min_count < 4 {
            self.bucket_15min_count += 1;
        }
    }

    /// Close current 1-hour bucket and advance
    pub fn close_1hour_bucket(&mut self, tick: i32, volume: u64, slot: u64) {
        let idx = self.bucket_1hour_cursor as usize % 4;
        self.buckets_1hour[idx] = PriceBucket {
            tick_cumulative: (tick as i64).checked_mul(slot as i64).unwrap_or(0),
            volume,
            timestamp_start: slot as i64,
            timestamp_end: slot as i64,
        };
        self.bucket_1hour_cursor = self.bucket_1hour_cursor.wrapping_add(1);
        if self.bucket_1hour_count < 4 {
            self.bucket_1hour_count += 1;
        }
    }
}

/// Price bucket for volatility tracking
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Default)]
pub struct PriceBucket {
    /// Cumulative tick * time
    pub tick_cumulative: i64,
    /// Volume in the bucket
    pub volume: u64,
    /// Start timestamp
    pub timestamp_start: i64,
    /// End timestamp
    pub timestamp_end: i64,
}

impl PriceBucket {
    pub const LEN: usize = 8 + 8 + 8 + 8; // 32 bytes

    /// Get average tick for the bucket
    pub fn average_tick(&self) -> i32 {
        if self.timestamp_end <= self.timestamp_start {
            return 0;
        }
        let duration = (self.timestamp_end - self.timestamp_start) as i64;
        if duration == 0 {
            return 0;
        }
        (self.tick_cumulative / duration) as i32
    }
}

/// LP position state
#[account]
pub struct PositionState {
    /// Owner of the position
    pub owner: Pubkey,
    /// Pool this position belongs to
    pub pool: Pubkey,
    /// Bump seed
    pub bump: u8,
    /// Position nonce (allows multiple positions per user)
    pub nonce: u8,

    /// LP shares held
    pub shares: u128,

    /// Fee growth snapshot A at last sync
    pub fee_growth_inside_a_last: u128,
    /// Fee growth snapshot B at last sync
    pub fee_growth_inside_b_last: u128,

    /// Uncollected fees A
    pub uncollected_fees_a: u64,
    /// Uncollected fees B
    pub uncollected_fees_b: u64,

    /// Entry curve A (for analytics)
    pub entry_a: u64,
    /// Reserved
    pub reserved: [u8; 6],
}

impl PositionState {
    pub const LEN: usize = 8 + // discriminator
        32 + // owner
        32 + // pool
        1 + // bump
        1 + // nonce
        16 + // shares
        16 + // fee_growth_inside_a_last
        16 + // fee_growth_inside_b_last
        8 + // uncollected_fees_a
        8 + // uncollected_fees_b
        8 + // entry_a
        6; // reserved
}

/// Mock oracle state (for devnet testing)
#[account]
pub struct MockOracleState {
    /// Pool this oracle serves
    pub pool: Pubkey,
    /// Current volatility (scaled by 1e12)
    pub volatility: u128,
    /// Last update slot
    pub last_update_slot: u64,
    /// Authority that can update
    pub authority: Pubkey,
}

impl MockOracleState {
    pub const LEN: usize = 8 + 32 + 16 + 8 + 32;
}
