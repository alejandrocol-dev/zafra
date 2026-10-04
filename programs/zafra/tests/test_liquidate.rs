mod common;

use {
    anchor_lang::{
        solana_program::instruction::error::InstructionError, AccountDeserialize,
    },
    zafra::state::{loan_status, warrant_status, Loan, Warrant},
    anchor_spl::associated_token::get_associated_token_address,
    common::*,
    solana_keypair::Keypair,
    solana_signer::Signer,
    solana_transaction_error::TransactionError,
};

const PRICE: u64 = 400_000_000;
const TONS: u64 = 100;
const POOL_USDC: u64 = 50_000_000_000;

#[test]
fn test_liquidate_after_price_drop() {
    let (mut svm, admin, _usdc_mint, _producer, warrant) =
        borrowed("SILO-L01", PRICE, TONS, POOL_USDC);
    let mint = warrant_mint_pda(&warrant);
    let warrant_vault = warrant_vault_pda(&warrant);

    // Price crashes 75%: value = 10_000e6 < debt (~28_000e6) even before the
    // liquidation threshold, so health < 1.
    let ix = set_price_ix(&admin.pubkey(), PRICE / 4);
    let res = send_ix(&mut svm, &admin, &[ix], &[&admin]);
    assert!(res.is_ok(), "set_price failed: {:?}", res.err());

    // Permissionless: a random liquidator triggers it.
    let liquidator = Keypair::new();
    svm.airdrop(&liquidator.pubkey(), 1_000_000_000).unwrap();
    let ix = liquidate_ix(&liquidator.pubkey(), &warrant);
    let res = send_ix(&mut svm, &admin, &[ix], &[&admin, &liquidator]);
    assert!(res.is_ok(), "liquidate failed: {:?}", res.err());

    let loan_account = svm.get_account(&loan_pda(&warrant)).unwrap();
    let mut data: &[u8] = &loan_account.data;
    let loan = Loan::try_deserialize(&mut data).unwrap();
    assert_eq!(loan.status, loan_status::LIQUIDATED);

    let warrant_account = svm.get_account(&warrant).unwrap();
    let mut data: &[u8] = &warrant_account.data;
    let warrant_state = Warrant::try_deserialize(&mut data).unwrap();
    assert_eq!(warrant_state.status, warrant_status::LIQUIDATED);

    // The collateral stays in the warrant vault custody account (owned by the pool).
    let custody_ata = get_associated_token_address(&warrant_vault, &mint);
    assert_eq!(
        token_amount(&svm.get_account(&custody_ata).unwrap().data),
        TONS
    );
}

#[test]
fn test_liquidate_rejects_healthy_loan() {
    let (mut svm, admin, _usdc_mint, _producer, warrant) =
        borrowed("SILO-L02", PRICE, TONS, POOL_USDC);

    // Price unchanged: value (40_000e6) * 8000 >> debt (~28_000e6) * 10000 → healthy.
    let liquidator = Keypair::new();
    svm.airdrop(&liquidator.pubkey(), 1_000_000_000).unwrap();
    let ix = liquidate_ix(&liquidator.pubkey(), &warrant);
    let res = send_ix(&mut svm, &admin, &[ix], &[&admin, &liquidator]);
    assert!(res.is_err());
    assert_eq!(
        res.err().unwrap().err,
        TransactionError::InstructionError(0, InstructionError::Custom(6008)) // HealthyLoan
    );
}

#[test]
fn test_liquidate_rejects_non_open_loan() {
    let (mut svm, admin, _usdc_mint, _producer, warrant) =
        borrowed("SILO-L03", PRICE, TONS, POOL_USDC);

    // Liquidate once after the price drop...
    let ix = set_price_ix(&admin.pubkey(), PRICE / 4);
    send_ix(&mut svm, &admin, &[ix], &[&admin]).unwrap();
    let liquidator = Keypair::new();
    svm.airdrop(&liquidator.pubkey(), 1_000_000_000).unwrap();
    let ix = liquidate_ix(&liquidator.pubkey(), &warrant);
    send_ix(&mut svm, &admin, &[ix], &[&admin, &liquidator]).unwrap();

    // ...a second liquidation hits the LoanNotOpen constraint.
    svm.expire_blockhash();
    let ix = liquidate_ix(&liquidator.pubkey(), &warrant);
    let res = send_ix(&mut svm, &admin, &[ix], &[&admin, &liquidator]);
    assert!(res.is_err());
    assert_eq!(
        res.err().unwrap().err,
        TransactionError::InstructionError(0, InstructionError::Custom(6005)) // LoanNotOpen
    );
}
