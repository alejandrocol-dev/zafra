use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::AgroError,
    state::{loan_status, warrant_status, Config, Loan, Warrant},
};

#[derive(Accounts)]
pub struct Liquidate<'info> {
    /// Permissionless: anyone can trigger liquidation of an unhealthy loan.
    pub liquidator: Signer<'info>,
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,
    #[account(
        mut,
        seeds = [WARRANT_SEED, warrant.silo_id.as_bytes()],
        bump = warrant.bump,
    )]
    pub warrant: Account<'info, Warrant>,
    #[account(
        mut,
        seeds = [LOAN_SEED, warrant.key().as_ref()],
        bump = loan.bump,
        constraint = loan.status == loan_status::OPEN @ AgroError::LoanNotOpen,
    )]
    pub loan: Account<'info, Loan>,
}

pub fn handle_liquidate(ctx: Context<Liquidate>) -> Result<()> {
    let config = &ctx.accounts.config;
    let interest = ctx
        .accounts
        .loan
        .accrued_interest(config.annual_interest_bps, Clock::get()?.unix_timestamp)?;
    let debt = (ctx.accounts.loan.principal as u128)
        .checked_add(interest as u128)
        .ok_or(AgroError::MathOverflow)?;
    let value = (ctx.accounts.warrant.tons as u128)
        .checked_mul(config.price_per_ton as u128)
        .ok_or(AgroError::MathOverflow)?;

    // health = value * liq_threshold_bps / (debt * 10_000); liquidatable iff health < 1.
    // A zero-debt loan is trivially healthy (also avoids the division).
    let healthy = debt == 0
        || value
            .checked_mul(config.liq_threshold_bps as u128)
            .ok_or(AgroError::MathOverflow)?
            >= debt.checked_mul(10_000).ok_or(AgroError::MathOverflow)?;
    require!(!healthy, AgroError::HealthyLoan);

    // The collateral stays in the warrant vault custody account: the pool keeps
    // it (the PDA authority is program-controlled). MVP keeps this state-only.
    ctx.accounts.loan.status = loan_status::LIQUIDATED;
    ctx.accounts.warrant.status = warrant_status::LIQUIDATED;

    msg!("Loan liquidated");
    Ok(())
}
