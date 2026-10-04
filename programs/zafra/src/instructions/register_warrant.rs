use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{mint_to, Mint, MintTo, Token, TokenAccount},
};

use crate::{
    constants::*,
    error::AgroError,
    state::{warrant_status, Config, Warrant},
};

#[derive(Accounts)]
#[instruction(silo_id: String, grain: u8, tons: u64, producer: Pubkey)]
pub struct RegisterWarrant<'info> {
    #[account(mut)]
    pub certifier: Signer<'info>,
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        has_one = certifier @ AgroError::NotCertifier,
    )]
    pub config: Account<'info, Config>,
    /// CHECK: producer wallet; only used to own the warrant ATA. Checked against the `producer` arg in the handler.
    pub producer: UncheckedAccount<'info>,
    #[account(
        init,
        payer = certifier,
        space = 8 + Warrant::INIT_SPACE,
        seeds = [WARRANT_SEED, silo_id.as_bytes()],
        bump
    )]
    pub warrant: Account<'info, Warrant>,
    /// CHECK: PDA mint authority of the warrant mint; signs `mint_to` via seeds.
    #[account(
        seeds = [MINT_AUTHORITY_SEED, warrant.key().as_ref()],
        bump
    )]
    pub mint_authority: UncheckedAccount<'info>,
    #[account(
        init,
        payer = certifier,
        mint::decimals = 0,
        mint::authority = mint_authority,
        seeds = [WARRANT_MINT_SEED, warrant.key().as_ref()],
        bump
    )]
    pub mint: Account<'info, Mint>,
    #[account(
        init_if_needed,
        payer = certifier,
        associated_token::mint = mint,
        associated_token::authority = producer,
        associated_token::token_program = token_program,
    )]
    pub producer_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handle_register_warrant(
    ctx: Context<RegisterWarrant>,
    silo_id: String,
    grain: u8,
    tons: u64,
    producer: Pubkey,
) -> Result<()> {
    require_keys_eq!(
        ctx.accounts.producer.key(),
        producer,
        anchor_lang::error::ErrorCode::ConstraintAddress
    );

    let warrant = &mut ctx.accounts.warrant;
    warrant.owner = ctx.accounts.producer.key();
    warrant.certifier = ctx.accounts.certifier.key();
    warrant.silo_id = silo_id;
    warrant.grain = grain;
    warrant.tons = tons;
    warrant.mint = ctx.accounts.mint.key();
    warrant.status = warrant_status::ISSUED;
    warrant.bump = ctx.bumps.warrant;

    // 1 token = 1 ton (0-decimals mint).
    let warrant_key = ctx.accounts.warrant.key();
    let mint_authority_bump = ctx.bumps.mint_authority;
    let signer_seeds: &[&[u8]] = &[
        MINT_AUTHORITY_SEED,
        warrant_key.as_ref(),
        &[mint_authority_bump],
    ];
    mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            MintTo {
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.producer_token_account.to_account_info(),
                authority: ctx.accounts.mint_authority.to_account_info(),
            },
            &[signer_seeds],
        ),
        tons,
    )?;

    msg!("Warrant {} registered: {} tons", ctx.accounts.warrant.silo_id, tons);
    Ok(())
}
