use anchor_lang::prelude::*;

pub mod warrant_status {
    pub const ISSUED: u8 = 0;
    pub const IN_CUSTODY: u8 = 1;
    pub const LIQUIDATED: u8 = 2;
    pub const RELEASED: u8 = 3;
}

#[account]
#[derive(InitSpace)]
pub struct Warrant {
    /// Producer that owns the warrant tokens.
    pub owner: Pubkey,
    pub certifier: Pubkey,
    #[max_len(32)]
    pub silo_id: String,
    /// Grain type (0 = soybean).
    pub grain: u8,
    pub tons: u64,
    /// SPL mint backing this warrant (1 token = 1 ton, 0 decimals).
    pub mint: Pubkey,
    /// See [`warrant_status`].
    pub status: u8,
    pub bump: u8,
}
