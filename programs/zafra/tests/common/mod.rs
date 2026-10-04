#![allow(dead_code)]

use {
    anchor_lang::{
        prelude::Pubkey,
        solana_program::{instruction::Instruction, system_program},
        InstructionData, ToAccountMetas,
    },
    anchor_spl::associated_token::{self, get_associated_token_address},
    litesvm::{types::TransactionResult, LiteSVM},
    solana_account::Account,
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
};

pub const USDC_DECIMALS: u8 = 6;
pub const ANNUAL_INTEREST_BPS: u16 = 1_200;

/// SPL Mint is a frozen 82-byte on-chain layout: COption<Pubkey> mint_authority,
/// u64 supply, u8 decimals, bool is_initialized, COption<Pubkey> freeze_authority.
pub fn pack_mint(mint_authority: &Pubkey, supply: u64, decimals: u8) -> Vec<u8> {
    let mut data = vec![0u8; 82];
    data[0..4].copy_from_slice(&1u32.to_le_bytes()); // COption::Some
    data[4..36].copy_from_slice(mint_authority.as_ref());
    data[36..44].copy_from_slice(&supply.to_le_bytes());
    data[44] = decimals;
    data[45] = 1; // is_initialized
    data
}

/// SPL token account amount lives at offset 64 (mint 32 + owner 32 + amount 8).
pub fn token_amount(data: &[u8]) -> u64 {
    u64::from_le_bytes(data[64..72].try_into().unwrap())
}

/// SPL TokenAccount is a frozen 165-byte on-chain layout: mint, owner, u64 amount,
/// delegate COption, u8 state, is_native COption, u64 delegated_amount, close_authority COption.
pub fn pack_token_account(mint: &Pubkey, owner: &Pubkey, amount: u64) -> Vec<u8> {
    let mut data = vec![0u8; 165];
    data[0..32].copy_from_slice(mint.as_ref());
    data[32..64].copy_from_slice(owner.as_ref());
    data[64..72].copy_from_slice(&amount.to_le_bytes());
    data[108] = 1; // state: Initialized
    data
}

/// SPL Mint supply lives at offset 36.
pub fn mint_supply(data: &[u8]) -> u64 {
    u64::from_le_bytes(data[36..44].try_into().unwrap())
}

pub fn setup() -> (LiteSVM, Keypair) {
    let program_id = zafra::id();
    let payer = Keypair::new();
    let mut svm = LiteSVM::new();
    let bytes = include_bytes!(concat!(
        env!("CARGO_TARGET_TMPDIR"),
        "/../deploy/zafra.so"
    ));
    svm.add_program(program_id, bytes).unwrap();
    svm.airdrop(&payer.pubkey(), 10_000_000_000).unwrap();
    (svm, payer)
}

/// Writes a raw SPL mint account owned by the classic token program.
pub fn create_mint(svm: &mut LiteSVM, mint: Pubkey, authority: Pubkey, decimals: u8) {
    svm.set_account(
        mint,
        Account {
            lamports: 1_000_000_000,
            data: pack_mint(&authority, 0, decimals),
            owner: anchor_spl::token::ID,
            executable: false,
            rent_epoch: 0,
        },
    )
    .unwrap();
}

/// Writes a raw SPL token account owned by the classic token program.
pub fn write_token_account(
    svm: &mut LiteSVM,
    address: Pubkey,
    mint: Pubkey,
    owner: Pubkey,
    amount: u64,
) {
    svm.set_account(
        address,
        Account {
            lamports: 1_000_000_000,
            data: pack_token_account(&mint, &owner, amount),
            owner: anchor_spl::token::ID,
            executable: false,
            rent_epoch: 0,
        },
    )
    .unwrap();
}

/// Funds `owner`'s ATA for `mint` with `amount`; returns the ATA address.
pub fn fund_ata(svm: &mut LiteSVM, mint: Pubkey, owner: Pubkey, amount: u64) -> Pubkey {
    let ata = get_associated_token_address(&owner, &mint);
    write_token_account(svm, ata, mint, owner, amount);
    ata
}

pub fn send_ix(
    svm: &mut LiteSVM,
    payer: &Keypair,
    ixs: &[Instruction],
    signers: &[&Keypair],
) -> TransactionResult {
    let blockhash = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(ixs, Some(&payer.pubkey()), &blockhash);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), signers).unwrap();
    svm.send_transaction(tx)
}

pub fn config_pda() -> Pubkey {
    Pubkey::find_program_address(&[zafra::constants::CONFIG_SEED], &zafra::id()).0
}

pub fn pool_vault_pda() -> Pubkey {
    Pubkey::find_program_address(&[zafra::constants::POOL_VAULT_SEED], &zafra::id()).0
}

pub fn warrant_pda(silo_id: &str) -> Pubkey {
    Pubkey::find_program_address(
        &[zafra::constants::WARRANT_SEED, silo_id.as_bytes()],
        &zafra::id(),
    )
    .0
}

pub fn mint_authority_pda(warrant: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(
        &[zafra::constants::MINT_AUTHORITY_SEED, warrant.as_ref()],
        &zafra::id(),
    )
    .0
}

pub fn warrant_mint_pda(warrant: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(
        &[zafra::constants::WARRANT_MINT_SEED, warrant.as_ref()],
        &zafra::id(),
    )
    .0
}

pub fn loan_pda(warrant: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(
        &[zafra::constants::LOAN_SEED, warrant.as_ref()],
        &zafra::id(),
    )
    .0
}

pub fn warrant_vault_pda(warrant: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(
        &[zafra::constants::WARRANT_VAULT_SEED, warrant.as_ref()],
        &zafra::id(),
    )
    .0
}

pub fn initialize_ix(admin: &Pubkey, usdc_mint: &Pubkey, certifier: &Pubkey) -> Instruction {
    Instruction::new_with_bytes(
        zafra::id(),
        &zafra::instruction::Initialize {
            certifier: *certifier,
            annual_interest_bps: ANNUAL_INTEREST_BPS,
        }
        .data(),
        zafra::accounts::Initialize {
            admin: *admin,
            config: config_pda(),
            pool_vault: pool_vault_pda(),
            usdc_mint: *usdc_mint,
            pool_vault_token_account: get_associated_token_address(
                &pool_vault_pda(),
                usdc_mint,
            ),
            token_program: anchor_spl::token::ID,
            associated_token_program: associated_token::ID,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    )
}

pub fn set_price_ix(admin: &Pubkey, price: u64) -> Instruction {
    Instruction::new_with_bytes(
        zafra::id(),
        &zafra::instruction::SetPrice { price }.data(),
        zafra::accounts::SetPrice {
            admin: *admin,
            config: config_pda(),
        }
        .to_account_metas(None),
    )
}

pub fn register_warrant_ix(
    certifier: &Pubkey,
    silo_id: &str,
    grain: u8,
    tons: u64,
    producer: &Pubkey,
) -> Instruction {
    let warrant = warrant_pda(silo_id);
    let mint = warrant_mint_pda(&warrant);
    Instruction::new_with_bytes(
        zafra::id(),
        &zafra::instruction::RegisterWarrant {
            silo_id: silo_id.to_string(),
            grain,
            tons,
            producer: *producer,
        }
        .data(),
        zafra::accounts::RegisterWarrant {
            certifier: *certifier,
            config: config_pda(),
            producer: *producer,
            warrant,
            mint_authority: mint_authority_pda(&warrant),
            mint,
            producer_token_account: get_associated_token_address(producer, &mint),
            token_program: anchor_spl::token::ID,
            associated_token_program: associated_token::ID,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    )
}

pub fn deposit_liquidity_ix(depositor: &Pubkey, usdc_mint: &Pubkey, amount: u64) -> Instruction {
    Instruction::new_with_bytes(
        zafra::id(),
        &zafra::instruction::DepositLiquidity { amount }.data(),
        zafra::accounts::DepositLiquidity {
            depositor: *depositor,
            usdc_mint: *usdc_mint,
            config: config_pda(),
            depositor_token_account: get_associated_token_address(depositor, usdc_mint),
            pool_vault: pool_vault_pda(),
            pool_vault_token_account: get_associated_token_address(&pool_vault_pda(), usdc_mint),
            token_program: anchor_spl::token::ID,
        }
        .to_account_metas(None),
    )
}

pub fn borrow_ix(borrower: &Pubkey, usdc_mint: &Pubkey, warrant: &Pubkey) -> Instruction {
    let mint = warrant_mint_pda(warrant);
    let warrant_vault = warrant_vault_pda(warrant);
    Instruction::new_with_bytes(
        zafra::id(),
        &zafra::instruction::Borrow.data(),
        zafra::accounts::Borrow {
            borrower: *borrower,
            usdc_mint: *usdc_mint,
            mint,
            config: config_pda(),
            warrant: *warrant,
            loan: loan_pda(warrant),
            warrant_vault,
            pool_vault: pool_vault_pda(),
            borrower_warrant_token_account: get_associated_token_address(borrower, &mint),
            custody_token_account: get_associated_token_address(&warrant_vault, &mint),
            pool_vault_token_account: get_associated_token_address(&pool_vault_pda(), usdc_mint),
            borrower_usdc_token_account: get_associated_token_address(borrower, usdc_mint),
            token_program: anchor_spl::token::ID,
            associated_token_program: associated_token::ID,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    )
}

pub fn repay_ix(borrower: &Pubkey, usdc_mint: &Pubkey, warrant: &Pubkey) -> Instruction {
    let mint = warrant_mint_pda(warrant);
    let warrant_vault = warrant_vault_pda(warrant);
    Instruction::new_with_bytes(
        zafra::id(),
        &zafra::instruction::Repay.data(),
        zafra::accounts::Repay {
            borrower: *borrower,
            usdc_mint: *usdc_mint,
            mint,
            config: config_pda(),
            warrant: *warrant,
            loan: loan_pda(warrant),
            warrant_vault,
            pool_vault: pool_vault_pda(),
            borrower_usdc_token_account: get_associated_token_address(borrower, usdc_mint),
            pool_vault_token_account: get_associated_token_address(&pool_vault_pda(), usdc_mint),
            custody_token_account: get_associated_token_address(&warrant_vault, &mint),
            borrower_warrant_token_account: get_associated_token_address(borrower, &mint),
            token_program: anchor_spl::token::ID,
            associated_token_program: associated_token::ID,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    )
}

pub fn liquidate_ix(liquidator: &Pubkey, warrant: &Pubkey) -> Instruction {
    Instruction::new_with_bytes(
        zafra::id(),
        &zafra::instruction::Liquidate.data(),
        zafra::accounts::Liquidate {
            liquidator: *liquidator,
            config: config_pda(),
            warrant: *warrant,
            loan: loan_pda(warrant),
        }
        .to_account_metas(None),
    )
}

/// Full happy-path setup: USDC mint + initialize. Returns (svm, admin, usdc_mint, certifier).
pub fn initialized() -> (LiteSVM, Keypair, Pubkey, Keypair) {
    let (mut svm, admin) = setup();
    let certifier = Keypair::new();
    let usdc_mint = Pubkey::new_unique();
    create_mint(&mut svm, usdc_mint, admin.pubkey(), USDC_DECIMALS);

    let ix = initialize_ix(&admin.pubkey(), &usdc_mint, &certifier.pubkey());
    let res = send_ix(&mut svm, &admin, &[ix], &[&admin]);
    assert!(res.is_ok(), "initialize failed: {:?}", res.err());

    (svm, admin, usdc_mint, certifier)
}

/// Sets the price, funds the pool via a depositor, registers `silo_id` for a
/// producer and opens the loan. Returns (svm, admin, usdc_mint, producer, warrant).
pub fn borrowed(
    silo_id: &str,
    price: u64,
    tons: u64,
    pool_usdc: u64,
) -> (LiteSVM, Keypair, Pubkey, Keypair, Pubkey) {
    let (mut svm, admin, usdc_mint, certifier) = initialized();
    svm.airdrop(&certifier.pubkey(), 1_000_000_000).unwrap();

    let ix = set_price_ix(&admin.pubkey(), price);
    let res = send_ix(&mut svm, &admin, &[ix], &[&admin]);
    assert!(res.is_ok(), "set_price failed: {:?}", res.err());

    let depositor = Keypair::new();
    svm.airdrop(&depositor.pubkey(), 1_000_000_000).unwrap();
    fund_ata(&mut svm, usdc_mint, depositor.pubkey(), pool_usdc);
    let ix = deposit_liquidity_ix(&depositor.pubkey(), &usdc_mint, pool_usdc);
    let res = send_ix(&mut svm, &admin, &[ix], &[&admin, &depositor]);
    assert!(res.is_ok(), "deposit_liquidity failed: {:?}", res.err());

    let producer = Keypair::new();
    svm.airdrop(&producer.pubkey(), 1_000_000_000).unwrap();
    let ix = register_warrant_ix(&certifier.pubkey(), silo_id, 0, tons, &producer.pubkey());
    let res = send_ix(&mut svm, &admin, &[ix], &[&admin, &certifier]);
    assert!(res.is_ok(), "register_warrant failed: {:?}", res.err());

    let warrant = warrant_pda(silo_id);
    let ix = borrow_ix(&producer.pubkey(), &usdc_mint, &warrant);
    let res = send_ix(&mut svm, &admin, &[ix], &[&admin, &producer]);
    assert!(res.is_ok(), "borrow failed: {:?}", res.err());

    (svm, admin, usdc_mint, producer, warrant)
}
