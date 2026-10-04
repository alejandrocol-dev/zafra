use anchor_lang::prelude::*;

#[error_code]
pub enum AgroError {
    #[msg("Signer is not the config admin")]
    NotAdmin,
    #[msg("Signer is not the config certifier")]
    NotCertifier,
    #[msg("Signer is not the warrant owner")]
    NotOwner,
    #[msg("Warrant is not in Issued status")]
    WarrantNotIssued,
    #[msg("A loan already exists for this warrant")]
    LoanExists,
    #[msg("Loan is not open")]
    LoanNotOpen,
    #[msg("Pool does not have enough USDC liquidity")]
    InsufficientLiquidity,
    #[msg("Requested amount exceeds the allowed LTV")]
    LtvExceeded,
    #[msg("Loan is healthy and cannot be liquidated")]
    HealthyLoan,
    #[msg("Arithmetic overflow")]
    MathOverflow,
    #[msg("Nothing left to repay")]
    NothingToRepay,
    #[msg("Price per ton is not set")]
    PriceNotSet,
}
