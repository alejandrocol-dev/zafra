mod common;

use {
    anchor_lang::{solana_program::instruction::error::InstructionError, AccountDeserialize},
    zafra::state::Config,
    common::*,
    solana_keypair::Keypair,
    solana_signer::Signer,
    solana_transaction_error::TransactionError,
};

#[test]
fn test_initialize_and_set_price() {
    let (mut svm, admin, usdc_mint, certifier) = initialized();

    let config_account = svm.get_account(&config_pda()).unwrap();
    let mut data: &[u8] = &config_account.data;
    let config = Config::try_deserialize(&mut data).unwrap();
    assert_eq!(config.admin, admin.pubkey());
    assert_eq!(config.certifier, certifier.pubkey());
    assert_eq!(config.usdc_mint, usdc_mint);
    assert_eq!(config.price_per_ton, 0);
    assert_eq!(config.ltv_bps, 7_000);
    assert_eq!(config.liq_threshold_bps, 8_000);
    assert_eq!(config.fee_bps, 75);
    assert_eq!(config.annual_interest_bps, ANNUAL_INTEREST_BPS);

    // Pool vault ATA exists, holds no USDC yet, and is owned by the pool vault PDA.
    let pool_ata =
        anchor_spl::associated_token::get_associated_token_address(&pool_vault_pda(), &usdc_mint);
    let pool_account = svm.get_account(&pool_ata).unwrap();
    assert_eq!(pool_account.owner, anchor_spl::token::ID);
    assert_eq!(token_amount(&pool_account.data), 0);
    assert_eq!(&pool_account.data[32..64], pool_vault_pda().as_ref());

    // Admin updates the price.
    let ix = set_price_ix(&admin.pubkey(), 50_000_000);
    let res = send_ix(&mut svm, &admin, &[ix], &[&admin]);
    assert!(res.is_ok(), "set_price failed: {:?}", res.err());

    let config_account = svm.get_account(&config_pda()).unwrap();
    let mut data: &[u8] = &config_account.data;
    let config = Config::try_deserialize(&mut data).unwrap();
    assert_eq!(config.price_per_ton, 50_000_000);
}

#[test]
fn test_set_price_rejects_non_admin() {
    let (mut svm, admin, _usdc_mint, _certifier) = initialized();
    let intruder = Keypair::new();
    svm.airdrop(&intruder.pubkey(), 1_000_000_000).unwrap();

    let ix = set_price_ix(&intruder.pubkey(), 1);
    let res = send_ix(&mut svm, &admin, &[ix], &[&admin, &intruder]);
    assert!(res.is_err());
    assert_eq!(
        res.err().unwrap().err,
        TransactionError::InstructionError(0, InstructionError::Custom(6000)) // NotAdmin
    );
}
