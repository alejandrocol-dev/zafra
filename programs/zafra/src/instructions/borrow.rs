use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{transfer, Mint, Token, TokenAccount, Transfer},
};

use crate::{
    constants::*,
    error::AgroError,
    state::{loan_status, warrant_status, Config, Loan, Warrant},
};

#[derive(Accounts)]
pub struct Borrow<'info> {
    #[account(mut)]
    pub borrower: Signer<'info>,
    pub usdc_mint: Box<Account<'info, Mint>>,
    /// Warrant mint backing the collateral (1 token = 1 ton).
    pub mint: Box<Account<'info, Mint>>,
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        has_one = usdc_mint,
    )]
    pub config: Box<Account<'info, Config>>,
    #[account(
        mut,
        seeds = [WARRANT_SEED, warrant.silo_id.as_bytes()],
        bump = warrant.bump,
        has_one = mint,
        constraint = warrant.owner == borrower.key() @ AgroError::NotOwner,
        constraint = warrant.status == warrant_status::ISSUED @ AgroError::WarrantNotIssued,
    )]
    pub warrant: Box<Account<'info, Warrant>>,
    #[account(
        init,
        payer = borrower,
        space = 8 + Loan::INIT_SPACE,
        seeds = [LOAN_SEED, warrant.key().as_ref()],
        bump
    )]
    pub loan: Box<Account<'info, Loan>>,
    /// CHECK: PDA that only acts as token authority over the warrant custody account; stores no data.
    #[account(
        seeds = [WARRANT_VAULT_SEED, warrant.key().as_ref()],
        bump
    )]
    pub warrant_vault: UncheckedAccount<'info>,
    /// CHECK: PDA that only acts as token authority over the pool vault; stores no data.
    #[account(seeds = [POOL_VAULT_SEED], bump)]
    pub pool_vault: UncheckedAccount<'info>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = borrower,
        associated_token::token_program = token_program,
    )]
    pub borrower_warrant_token_account: Box<Account<'info, TokenAccount>>,
    /// Custody for the collateral: ATA of the `["warrant_vault", warrant]` PDA.
    #[account(
        init,
        payer = borrower,
        associated_token::mint = mint,
        associated_token::authority = warrant_vault,
        associated_token::token_program = token_program,
    )]
    pub custody_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = pool_vault,
        associated_token::token_program = token_program,
    )]
    pub pool_vault_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        init_if_needed,
        payer = borrower,
        associated_token::mint = usdc_mint,
        associated_token::authority = borrower,
        associated_token::token_program = token_program,
    )]
    pub borrower_usdc_token_account: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handle_borrow(ctx: Context<Borrow>) -> Result<()> {
    let config = &ctx.accounts.config;
    require_gt!(config.price_per_ton, 0, AgroError::PriceNotSet);

    // u128 intermediates: tons * price and the bps products can overflow u64.
    let max_loan = (ctx.accounts.warrant.tons as u128)
        .checked_mul(config.price_per_ton as u128)
        .and_then(|v| v.checked_mul(config.ltv_bps as u128))
        .map(|v| v / 10_000)
        .ok_or(AgroError::MathOverflow)?;
    let max_loan = u64::try_from(max_loan).map_err(|_| AgroError::MathOverflow)?;
    let fee = (max_loan as u128)
        .checked_mul(config.fee_bps as u128)
        .map(|v| v / 10_000)
        .ok_or(AgroError::MathOverflow)?;
    let fee = u64::try_from(fee).map_err(|_| AgroError::MathOverflow)?;
    let disburse = max_loan.checked_sub(fee).ok_or(AgroError::MathOverflow)?;

    require_gte!(
        ctx.accounts.pool_vault_token_account.amount,
        max_loan,
        AgroError::InsufficientLiquidity
    );

    // Lock all of the borrower's warrant tokens in the custody ATA.
    let collateral = ctx.accounts.borrower_warrant_token_account.amount;
    transfer(
        CpiContext::new(
            ctx.accounts.token_program.key(),
            Transfer {
                from: ctx.accounts.borrower_warrant_token_account.to_account_info(),
                to: ctx.accounts.custody_token_account.to_account_info(),
                authority: ctx.accounts.borrower.to_account_info(),
            },
        ),
        collateral,
    )?;

    // Disburse max_loan - fee; the fee stays in the pool.
    let pool_vault_bump = ctx.bumps.pool_vault;
    let pool_signer_seeds: &[&[u8]] = &[POOL_VAULT_SEED, &[pool_vault_bump]];
    transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            Transfer {
                from: ctx.accounts.pool_vault_token_account.to_account_info(),
                to: ctx.accounts.borrower_usdc_token_account.to_account_info(),
                authority: ctx.accounts.pool_vault.to_account_info(),
            },
            &[pool_signer_seeds],
        ),
        disburse,
    )?;

    let loan = &mut ctx.accounts.loan;
    loan.borrower = ctx.accounts.borrower.key();
    loan.warrant = ctx.accounts.warrant.key();
    loan.principal = max_loan;
    loan.opened_at = Clock::get()?.unix_timestamp;
    loan.status = loan_status::OPEN;
    loan.bump = ctx.bumps.loan;

    ctx.accounts.warrant.status = warrant_status::IN_CUSTODY;

    msg!("Loan opened: principal {} USDC", max_loan);
    Ok(())
}
