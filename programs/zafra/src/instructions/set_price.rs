use anchor_lang::prelude::*;

use crate::{constants::*, error::AgroError, state::Config};

#[derive(Accounts)]
pub struct SetPrice<'info> {
    pub admin: Signer<'info>,
    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump = config.bump,
        has_one = admin @ AgroError::NotAdmin,
    )]
    pub config: Account<'info, Config>,
}

pub fn handle_set_price(ctx: Context<SetPrice>, price: u64) -> Result<()> {
    ctx.accounts.config.price_per_ton = price;
    msg!("price_per_ton set to {}", price);
    Ok(())
}
