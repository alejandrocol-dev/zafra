pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("AERC53ZiqizgjYdJK9hCeGtSk6PfzwnEn2z3wkMKiqiJ");

#[program]
pub mod zafra {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        certifier: Pubkey,
        annual_interest_bps: u16,
    ) -> Result<()> {
        crate::instructions::initialize::handle_initialize(ctx, certifier, annual_interest_bps)
    }

    pub fn set_price(ctx: Context<SetPrice>, price: u64) -> Result<()> {
        crate::instructions::set_price::handle_set_price(ctx, price)
    }

    pub fn register_warrant(
        ctx: Context<RegisterWarrant>,
        silo_id: String,
        grain: u8,
        tons: u64,
        producer: Pubkey,
    ) -> Result<()> {
        crate::instructions::register_warrant::handle_register_warrant(
            ctx, silo_id, grain, tons, producer,
        )
    }

    pub fn deposit_liquidity(ctx: Context<DepositLiquidity>, amount: u64) -> Result<()> {
        crate::instructions::deposit_liquidity::handle_deposit_liquidity(ctx, amount)
    }

    pub fn borrow(ctx: Context<Borrow>) -> Result<()> {
        crate::instructions::borrow::handle_borrow(ctx)
    }

    pub fn repay(ctx: Context<Repay>) -> Result<()> {
        crate::instructions::repay::handle_repay(ctx)
    }

    pub fn liquidate(ctx: Context<Liquidate>) -> Result<()> {
        crate::instructions::liquidate::handle_liquidate(ctx)
    }
}
