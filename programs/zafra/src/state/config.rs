use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub admin: Pubkey,
    pub certifier: Pubkey,
    pub usdc_mint: Pubkey,
    /// USDC per ton, 6 decimals.
    pub price_per_ton: u64,
    pub ltv_bps: u16,
    pub liq_threshold_bps: u16,
    pub fee_bps: u16,
    /// Simple annual interest charged on repay, in basis points.
    pub annual_interest_bps: u16,
    pub bump: u8,
}
