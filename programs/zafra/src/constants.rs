use anchor_lang::prelude::*;

#[constant]
pub const CONFIG_SEED: &[u8] = b"config";

#[constant]
pub const WARRANT_SEED: &[u8] = b"warrant";

#[constant]
pub const LOAN_SEED: &[u8] = b"loan";

#[constant]
pub const POOL_VAULT_SEED: &[u8] = b"pool_vault";

#[constant]
pub const WARRANT_VAULT_SEED: &[u8] = b"warrant_vault";

#[constant]
pub const MINT_AUTHORITY_SEED: &[u8] = b"mint_authority";

#[constant]
pub const WARRANT_MINT_SEED: &[u8] = b"warrant_mint";

/// Max byte length of `Warrant::silo_id` (String prefix + 32 bytes of capacity).
pub const MAX_SILO_ID_LEN: usize = 32;

#[constant]
pub const DEFAULT_LTV_BPS: u16 = 7_000;

#[constant]
pub const DEFAULT_LIQ_THRESHOLD_BPS: u16 = 8_000;

#[constant]
pub const DEFAULT_FEE_BPS: u16 = 75;

/// Seconds in a 365-day year; denominator for simple annual interest.
#[constant]
pub const SECONDS_PER_YEAR: u64 = 31_536_000;
