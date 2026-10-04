mod common;

use {
    anchor_lang::{
        solana_program::{clock::Clock, instruction::error::InstructionError},
        AccountDeserialize,
    },
    zafra::{
        constants::SECONDS_PER_YEAR,
        state::{loan_status, warrant_status, Loan, Warrant},
    },
    anchor_spl::associated_token::get_associated_token_address,
    common::*,
    litesvm::LiteSVM,
    solana_keypair::Keypair,
    solana_signer::Signer,
    solana_transaction_error::TransactionError,
};

const PRICE: u64 = 400_000_000;
const TONS: u64 = 100;
const MAX_LOAN: u64 = 28_000_000_000;
const POOL_USDC: u64 = 50_000_000_000;

/// Warps the LiteSVM clock so `elapsed_seconds` passed since `opened_at`.
fn warp_forward(svm: &mut LiteSVM, opened_at: i64, elapsed_seconds: i64) {
    let mut clock = svm.get_sysvar::<Clock>();
    clock.unix_timestamp = opened_at + elapsed_seconds;
    svm.set_sysvar(&clock);
}

#[test]
fn test_repay_after_one_year() {
    let (mut svm, admin, usdc_mint, producer, warrant) =
        borrowed("SILO-R01", PRICE, TONS, POOL_USDC);
    let mint = warrant_mint_pda(&warrant);
    let warrant_vault = warrant_vault_pda(&warrant);
    let pool_ata = get_associated_token_address(&pool_vault_pda(), &usdc_mint);
    let pool_before = token_amount(&svm.get_account(&pool_ata).unwrap().data);

    // One full year of simple interest at ANNUAL_INTEREST_BPS (12%).
    let loan_account = svm.get_account(&loan_pda(&warrant)).unwrap();
    let mut data: &[u8] = &loan_account.data;
    let loan = Loan::try_deserialize(&mut data).unwrap();
    warp_forward(&mut svm, loan.opened_at, SECONDS_PER_YEAR as i64);

    let interest = MAX_LOAN * ANNUAL_INTEREST_BPS as u64 / 10_000;
    let total = MAX_LOAN + interest;

    // The borrower only received max_loan - fee; top up so it can cover interest.
    let borrower_usdc =
        fund_ata(&mut svm, usdc_mint, producer.pubkey(), total);
    let ix = repay_ix(&producer.pubkey(), &usdc_mint, &warrant);
    let res = send_ix(&mut svm, &admin, &[ix], &[&admin, &producer]);
    assert!(res.is_ok(), "repay failed: {:?}", res.err());

    // Pool received principal + interest.
    assert_eq!(
        token_amount(&svm.get_account(&pool_ata).unwrap().data),
        pool_before + total
    );
    assert_eq!(
        token_amount(&svm.get_account(&borrower_usdc).unwrap().data),
        0
    );

    // Collateral returned to the borrower; custody empty.
    let borrower_ata = get_associated_token_address(&producer.pubkey(), &mint);
    let custody_ata = get_associated_token_address(&warrant_vault, &mint);
    assert_eq!(
        token_amount(&svm.get_account(&borrower_ata).unwrap().data),
        TONS
    );
    assert_eq!(
        token_amount(&svm.get_account(&custody_ata).unwrap().data),
        0
    );

    let loan_account = svm.get_account(&loan_pda(&warrant)).unwrap();
    let mut data: &[u8] = &loan_account.data;
    let loan = Loan::try_deserialize(&mut data).unwrap();
    assert_eq!(loan.status, loan_status::REPAID);

    let warrant_account = svm.get_account(&warrant).unwrap();
    let mut data: &[u8] = &warrant_account.data;
    let warrant_state = Warrant::try_deserialize(&mut data).unwrap();
    assert_eq!(warrant_state.status, warrant_status::RELEASED);
}

#[test]
fn test_repay_rejects_non_open_loan() {
    let (mut svm, admin, usdc_mint, producer, warrant) =
        borrowed("SILO-R02", PRICE, TONS, POOL_USDC);

    fund_ata(&mut svm, usdc_mint, producer.pubkey(), MAX_LOAN * 2);
    let ix = repay_ix(&producer.pubkey(), &usdc_mint, &warrant);
    send_ix(&mut svm, &admin, &[ix], &[&admin, &producer]).unwrap();

    // Second repay on an already-repaid loan.
    svm.expire_blockhash();
    let ix = repay_ix(&producer.pubkey(), &usdc_mint, &warrant);
    let res = send_ix(&mut svm, &admin, &[ix], &[&admin, &producer]);
    assert!(res.is_err());
    assert_eq!(
        res.err().unwrap().err,
        TransactionError::InstructionError(0, InstructionError::Custom(6005)) // LoanNotOpen
    );
}

#[test]
fn test_repay_rejects_non_borrower() {
    let (mut svm, admin, usdc_mint, _producer, warrant) =
        borrowed("SILO-R03", PRICE, TONS, POOL_USDC);

    let intruder = Keypair::new();
    svm.airdrop(&intruder.pubkey(), 1_000_000_000).unwrap();
    fund_ata(&mut svm, usdc_mint, intruder.pubkey(), MAX_LOAN * 2);
    let ix = repay_ix(&intruder.pubkey(), &usdc_mint, &warrant);
    let res = send_ix(&mut svm, &admin, &[ix], &[&admin, &intruder]);
    assert!(res.is_err());
    assert_eq!(
        res.err().unwrap().err,
        TransactionError::InstructionError(0, InstructionError::Custom(6002)) // NotOwner
    );
}
