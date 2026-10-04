use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};

use crate::{constants::*, state::Config};

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init,
        payer = admin,
        space = 8 + Config::INIT_SPACE,
        seeds = [CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, Config>,
    /// CHECK: PDA that only acts as token authority over the pool vault; stores no data.
    #[account(seeds = [POOL_VAULT_SEED], bump)]
    pub pool_vault: UncheckedAccount<'info>,
    pub usdc_mint: Account<'info, Mint>,
    #[account(
        init,
        payer = admin,
        associated_token::mint = usdc_mint,
        associated_token::authority = pool_vault,
        associated_token::token_program = token_program,
    )]
    pub pool_vault_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handle_initialize(
    ctx: Context<Initialize>,
    certifier: Pubkey,
    annual_interest_bps: u16,
) -> Result<()> {
    let config = &mut ctx.accounts.config;
    config.admin = ctx.accounts.admin.key();
    config.certifier = certifier;
    config.usdc_mint = ctx.accounts.usdc_mint.key();
    config.price_per_ton = 0;
    config.ltv_bps = DEFAULT_LTV_BPS;
    config.liq_threshold_bps = DEFAULT_LIQ_THRESHOLD_BPS;
    config.fee_bps = DEFAULT_FEE_BPS;
    config.annual_interest_bps = annual_interest_bps;
    config.bump = ctx.bumps.config;

    msg!("Zafra initialized");
    Ok(())
}
