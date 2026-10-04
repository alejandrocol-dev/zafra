use anchor_lang::prelude::*;

use crate::{constants::SECONDS_PER_YEAR, error::AgroError};

pub mod loan_status {
    pub const OPEN: u8 = 0;
    pub const REPAID: u8 = 1;
    pub const LIQUIDATED: u8 = 2;
}

#[account]
#[derive(InitSpace)]
pub struct Loan {
    pub borrower: Pubkey,
    pub warrant: Pubkey,
    /// USDC disbursed at open (6 decimals), before pool fee.
    pub principal: u64,
    pub opened_at: i64,
    /// See [`loan_status`].
    pub status: u8,
    pub bump: u8,
}

impl Loan {
    /// Simple annual interest: `principal * annual_interest_bps * elapsed / (10000 * SECONDS_PER_YEAR)`.
    /// Negative elapsed time (clock skew) counts as zero.
    pub fn accrued_interest(&self, annual_interest_bps: u16, now: i64) -> Result<u64> {
        let elapsed = now.saturating_sub(self.opened_at).max(0) as u64;
        let interest = (self.principal as u128)
            .checked_mul(annual_interest_bps as u128)
            .and_then(|v| v.checked_mul(elapsed as u128))
            .map(|v| v / (10_000u128 * SECONDS_PER_YEAR as u128))
            .ok_or(AgroError::MathOverflow)?;
        u64::try_from(interest).map_err(|_| AgroError::MathOverflow.into())
    }
}
