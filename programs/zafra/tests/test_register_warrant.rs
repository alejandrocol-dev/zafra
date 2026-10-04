mod common;

use {
    anchor_lang::{
        prelude::Pubkey,
        solana_program::instruction::error::InstructionError,
        AccountDeserialize,
    },
    zafra::state::{warrant_status, Warrant},
    anchor_spl::associated_token::get_associated_token_address,
    common::*,
    solana_keypair::Keypair,
    solana_signer::Signer,
    solana_transaction_error::TransactionError,
};

#[test]
fn test_register_warrant() {
    let (mut svm, admin, _usdc_mint, certifier) = initialized();
    svm.airdrop(&certifier.pubkey(), 1_000_000_000).unwrap();
    let producer = Keypair::new();

    let ix = register_warrant_ix(
        &certifier.pubkey(),
        "SILO-001",
        0,
        100,
        &producer.pubkey(),
    );
    let res = send_ix(&mut svm, &admin, &[ix], &[&admin, &certifier]);
    assert!(res.is_ok(), "register_warrant failed: {:?}", res.err());

    let warrant_pda = warrant_pda("SILO-001");
    let mint_pda = warrant_mint_pda(&warrant_pda);

    let warrant_account = svm.get_account(&warrant_pda).unwrap();
    let mut data: &[u8] = &warrant_account.data;
    let warrant = Warrant::try_deserialize(&mut data).unwrap();
    assert_eq!(warrant.owner, producer.pubkey());
    assert_eq!(warrant.certifier, certifier.pubkey());
    assert_eq!(warrant.silo_id, "SILO-001");
    assert_eq!(warrant.grain, 0);
    assert_eq!(warrant.tons, 100);
    assert_eq!(warrant.mint, mint_pda);
    assert_eq!(warrant.status, warrant_status::ISSUED);

    // Warrant mint: 0 decimals, supply == tons, mint authority is the mint_authority PDA.
    let mint_account = svm.get_account(&mint_pda).unwrap();
    assert_eq!(mint_account.owner, anchor_spl::token::ID);
    assert_eq!(mint_supply(&mint_account.data), 100);
    assert_eq!(mint_account.data[44], 0); // decimals
    assert_eq!(
        &mint_account.data[4..36],
        mint_authority_pda(&warrant_pda).as_ref()
    );

    // Producer received `tons` warrant tokens in its ATA.
    let producer_ata = get_associated_token_address(&producer.pubkey(), &mint_pda);
    let ata_account = svm.get_account(&producer_ata).unwrap();
    assert_eq!(token_amount(&ata_account.data), 100);
    assert_eq!(&ata_account.data[32..64], producer.pubkey().as_ref());
}

#[test]
fn test_register_warrant_rejects_non_certifier() {
    let (mut svm, admin, _usdc_mint, _certifier) = initialized();
    let intruder = Keypair::new();
    svm.airdrop(&intruder.pubkey(), 1_000_000_000).unwrap();
    let producer = Pubkey::new_unique();

    let ix = register_warrant_ix(&intruder.pubkey(), "SILO-002", 0, 10, &producer);
    let res = send_ix(&mut svm, &admin, &[ix], &[&admin, &intruder]);
    assert!(res.is_err());
    assert_eq!(
        res.err().unwrap().err,
        TransactionError::InstructionError(0, InstructionError::Custom(6001)) // NotCertifier
    );
}

#[test]
fn test_register_warrant_rejects_duplicate_silo_id() {
    let (mut svm, admin, _usdc_mint, certifier) = initialized();
    svm.airdrop(&certifier.pubkey(), 1_000_000_000).unwrap();
    let producer = Pubkey::new_unique();

    let ix = register_warrant_ix(&certifier.pubkey(), "SILO-003", 0, 10, &producer);
    let res = send_ix(&mut svm, &admin, &[ix], &[&admin, &certifier]);
    assert!(res.is_ok(), "first register failed: {:?}", res.err());

    // Same silo_id derives the same warrant PDA, which is already initialized.
    let ix = register_warrant_ix(&certifier.pubkey(), "SILO-003", 0, 20, &producer);
    let res = send_ix(&mut svm, &admin, &[ix], &[&admin, &certifier]);
    assert!(res.is_err(), "duplicate silo_id should fail");
}
