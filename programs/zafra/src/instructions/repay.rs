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
pub struct Repay<'info> {
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
    )]
    pub warrant: Box<Account<'info, Warrant>>,
    #[account(
        mut,
        seeds = [LOAN_SEED, warrant.key().as_ref()],
        bump = loan.bump,
        constraint = loan.borrower == borrower.key() @ AgroError::NotOwner,
        constraint = loan.status == loan_status::OPEN @ AgroError::LoanNotOpen,
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
        associated_token::mint = usdc_mint,
        associated_token::authority = borrower,
        associated_token::token_program = token_program,
    )]
    pub borrower_usdc_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = pool_vault,
        associated_token::token_program = token_program,
    )]
    pub pool_vault_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = warrant_vault,
        associated_token::token_program = token_program,
    )]
    pub custody_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        init_if_needed,
        payer = borrower,
        associated_token::mint = mint,
        associated_token::authority = borrower,
        associated_token::token_program = token_program,
    )]
    pub borrower_warrant_token_account: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handle_repay(ctx: Context<Repay>) -> Result<()> {
    let interest = ctx
        .accounts
        .loan
        .accrued_interest(ctx.accounts.config.annual_interest_bps, Clock::get()?.unix_timestamp)?;
    let total = (ctx.accounts.loan.principal as u128)
        .checked_add(interest as u128)
        .ok_or(AgroError::MathOverflow)?;
    let total = u64::try_from(total).map_err(|_| AgroError::MathOverflow)?;
    require_gt!(total, 0, AgroError::NothingToRepay);

    // Borrower repays principal + simple interest into the pool.
    transfer(
        CpiContext::new(
            ctx.accounts.token_program.key(),
            Transfer {
                from: ctx.accounts.borrower_usdc_token_account.to_account_info(),
                to: ctx.accounts.pool_vault_token_account.to_account_info(),
                authority: ctx.accounts.borrower.to_account_info(),
            },
        ),
        total,
    )?;

    // Return the collateral from custody to the borrower.
    let warrant_key = ctx.accounts.warrant.key();
    let warrant_vault_bump = ctx.bumps.warrant_vault;
    let warrant_vault_seeds: &[&[u8]] = &[
        WARRANT_VAULT_SEED,
        warrant_key.as_ref(),
        &[warrant_vault_bump],
    ];
    let collateral = ctx.accounts.custody_token_account.amount;
    transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            Transfer {
                from: ctx.accounts.custody_token_account.to_account_info(),
                to: ctx.accounts.borrower_warrant_token_account.to_account_info(),
                authority: ctx.accounts.warrant_vault.to_account_info(),
            },
            &[warrant_vault_seeds],
        ),
        collateral,
    )?;

    // Accounts stay around as on-chain record; only statuses change.
    ctx.accounts.loan.status = loan_status::REPAID;
    ctx.accounts.warrant.status = warrant_status::RELEASED;

    msg!("Loan repaid: {} USDC", total);
    Ok(())
}
