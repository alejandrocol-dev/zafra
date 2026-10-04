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

const PRICE: u64 = 400_000_000; // 400 USDC per ton (6 decimals)
const TONS: u64 = 100;
// value = 100 * 400e6 = 40_000e6; max_loan = value * 7000 / 10000
const MAX_LOAN: u64 = 28_000_000_000;
// fee = max_loan * 75 / 10000 = 210e6; disburse = max_loan - fee
const DISBURSE: u64 = 27_790_000_000;
const POOL_USDC: u64 = 50_000_000_000;

#[test]
fn test_deposit_and_borrow() {
    let (svm, _admin, usdc_mint, producer, warrant) =
        borrowed("SILO-B01", PRICE, TONS, POOL_USDC);
    let mint = warrant_mint_pda(&warrant);
    let warrant_vault = warrant_vault_pda(&warrant);
    let pool_ata = get_associated_token_address(&pool_vault_pda(), &usdc_mint);

    // Borrower received max_loan - fee; the fee stayed in the pool.
    let borrower_usdc =
        get_associated_token_address(&producer.pubkey(), &usdc_mint);
    assert_eq!(
        token_amount(&svm.get_account(&borrower_usdc).unwrap().data),
        DISBURSE
    );
    assert_eq!(
        token_amount(&svm.get_account(&pool_ata).unwrap().data),
        POOL_USDC - DISBURSE
    );

    // All warrant tokens moved from the borrower ATA to the custody ATA.
    let borrower_ata = get_associated_token_address(&producer.pubkey(), &mint);
    let custody_ata = get_associated_token_address(&warrant_vault, &mint);
    assert_eq!(
        token_amount(&svm.get_account(&borrower_ata).unwrap().data),
        0
    );
    let custody_account = svm.get_account(&custody_ata).unwrap();
    assert_eq!(token_amount(&custody_account.data), TONS);
    assert_eq!(&custody_account.data[32..64], warrant_vault.as_ref());

    // Loan PDA created and open.
    let loan_account = svm.get_account(&loan_pda(&warrant)).unwrap();
    let mut data: &[u8] = &loan_account.data;
    let loan = Loan::try_deserialize(&mut data).unwrap();
    assert_eq!(loan.borrower, producer.pubkey());
    assert_eq!(loan.warrant, warrant);
    assert_eq!(loan.principal, MAX_LOAN);
    assert_eq!(loan.status, loan_status::OPEN);

    // Warrant moved to InCustody.
    let warrant_account = svm.get_account(&warrant).unwrap();
    let mut data: &[u8] = &warrant_account.data;
    let warrant_state = Warrant::try_deserialize(&mut data).unwrap();
    assert_eq!(warrant_state.status, warrant_status::IN_CUSTODY);
}

#[test]
fn test_borrow_rejects_non_owner() {
    let (mut svm, admin, usdc_mint, certifier) = initialized();
    svm.airdrop(&certifier.pubkey(), 1_000_000_000).unwrap();

    let ix = set_price_ix(&admin.pubkey(), PRICE);
    send_ix(&mut svm, &admin, &[ix], &[&admin]).unwrap();

    let producer = Keypair::new();
    let ix = register_warrant_ix(&certifier.pubkey(), "SILO-B02", 0, TONS, &producer.pubkey());
    send_ix(&mut svm, &admin, &[ix], &[&admin, &certifier]).unwrap();

    let intruder = Keypair::new();
    svm.airdrop(&intruder.pubkey(), 1_000_000_000).unwrap();
    let warrant = warrant_pda("SILO-B02");
    // Empty warrant ATA for the intruder so account loading reaches the constraint checks.
    fund_ata(&mut svm, warrant_mint_pda(&warrant), intruder.pubkey(), 0);
    let ix = borrow_ix(&intruder.pubkey(), &usdc_mint, &warrant);
    let res = send_ix(&mut svm, &admin, &[ix], &[&admin, &intruder]);
    assert!(res.is_err());
    assert_eq!(
        res.err().unwrap().err,
        TransactionError::InstructionError(0, InstructionError::Custom(6002)) // NotOwner
    );
}

#[test]
fn test_borrow_rejects_double_borrow() {
    let (mut svm, admin, usdc_mint, producer, warrant) =
        borrowed("SILO-B03", PRICE, TONS, POOL_USDC);

    // The loan PDA already exists: `init` fails and enforces LoanExists.
    svm.expire_blockhash();
    let ix = borrow_ix(&producer.pubkey(), &usdc_mint, &warrant);
    let res = send_ix(&mut svm, &admin, &[ix], &[&admin, &producer]);
    assert!(res.is_err(), "double borrow should fail");
}

#[test]
fn test_borrow_rejects_insufficient_liquidity() {
    let (mut svm, admin, usdc_mint, certifier) = initialized();
    svm.airdrop(&certifier.pubkey(), 1_000_000_000).unwrap();

    let ix = set_price_ix(&admin.pubkey(), PRICE);
    send_ix(&mut svm, &admin, &[ix], &[&admin]).unwrap();

    // Pool only gets 1 USDC, far below the 28k USDC max loan.
    let depositor = Keypair::new();
    svm.airdrop(&depositor.pubkey(), 1_000_000_000).unwrap();
    fund_ata(&mut svm, usdc_mint, depositor.pubkey(), 1_000_000);
    let ix = deposit_liquidity_ix(&depositor.pubkey(), &usdc_mint, 1_000_000);
    send_ix(&mut svm, &admin, &[ix], &[&admin, &depositor]).unwrap();

    let producer = Keypair::new();
    svm.airdrop(&producer.pubkey(), 1_000_000_000).unwrap();
    let ix = register_warrant_ix(&certifier.pubkey(), "SILO-B04", 0, TONS, &producer.pubkey());
    send_ix(&mut svm, &admin, &[ix], &[&admin, &certifier]).unwrap();

    let warrant = warrant_pda("SILO-B04");
    let ix = borrow_ix(&producer.pubkey(), &usdc_mint, &warrant);
    let res = send_ix(&mut svm, &admin, &[ix], &[&admin, &producer]);
    assert!(res.is_err());
    assert_eq!(
        res.err().unwrap().err,
        TransactionError::InstructionError(0, InstructionError::Custom(6006)) // InsufficientLiquidity
    );
}

#[test]
fn test_borrow_rejects_unset_price() {
    let (mut svm, admin, usdc_mint, certifier) = initialized();
    svm.airdrop(&certifier.pubkey(), 1_000_000_000).unwrap();

    let depositor = Keypair::new();
    svm.airdrop(&depositor.pubkey(), 1_000_000_000).unwrap();
    fund_ata(&mut svm, usdc_mint, depositor.pubkey(), POOL_USDC);
    let ix = deposit_liquidity_ix(&depositor.pubkey(), &usdc_mint, POOL_USDC);
    send_ix(&mut svm, &admin, &[ix], &[&admin, &depositor]).unwrap();

    // No set_price: price_per_ton is still 0.
    let producer = Keypair::new();
    svm.airdrop(&producer.pubkey(), 1_000_000_000).unwrap();
    let ix = register_warrant_ix(&certifier.pubkey(), "SILO-B05", 0, TONS, &producer.pubkey());
    send_ix(&mut svm, &admin, &[ix], &[&admin, &certifier]).unwrap();

    let warrant = warrant_pda("SILO-B05");
    let ix = borrow_ix(&producer.pubkey(), &usdc_mint, &warrant);
    let res = send_ix(&mut svm, &admin, &[ix], &[&admin, &producer]);
    assert!(res.is_err());
    assert_eq!(
        res.err().unwrap().err,
        TransactionError::InstructionError(0, InstructionError::Custom(6011)) // PriceNotSet
    );
}
