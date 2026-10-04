/**
 * Real Zafra client — the on-chain implementation of `ZafraClient`
 * from `./zafra.ts`, built on @coral-xyz/anchor + the generated IDL
 * (`idl/zafra.json`, camelCase type in `./zafra.idl.ts`).
 *
 * Cluster is devnet-only, enforced by the caller (AppProviders pins the
 * Connection to devnet; the verify script uses clusterApiUrl("devnet")).
 *
 * Amount conventions (mirror the mock): the interface deals in UI units
 * (1 = 1 USDC / 1 ton). Conversion to u64 base units happens at this
 * boundary — USDC has 6 decimals, warrant tokens have 0.
 *
 * This module is lazy-loaded (`await import("./zafra-real")`) by the
 * router in `./zafra.ts` so anchor never lands in the default bundle.
 */
import { AnchorError, AnchorProvider, BN, Program } from "@coral-xyz/anchor";
import {
  PublicKey,
  SystemProgram,
  type Commitment,
  type Connection,
  type Transaction,
  type VersionedTransaction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAccount,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

import idlJson from "../idl/zafra.json";
import type { Zafra } from "./zafra.idl";
import {
  accruedDebt,
  AgroError,
  ZafraError,
  collateralValue,
  healthFactor,
  LoanStatus,
  type ZafraClient,
  type Config,
  type Loan,
  type OpenLoan,
  type PoolStats,
  type RegisterWarrantInput,
  type TxResult,
  type Warrant,
  type WalletBalances,
  type WarrantPosition,
} from "./zafra";

// ---------------------------------------------------------------------------
// Signer abstraction — matches @solana/wallet-adapter's AnchorWallet and the
// anchor `Wallet` interface (AnchorProvider constructor parameter).
// ---------------------------------------------------------------------------

export type ZafraWallet = ConstructorParameters<typeof AnchorProvider>[1];

/** Placeholder signer for read-only access (writes fail fast on the client). */
class ReadOnlyWallet implements ZafraWallet {
  publicKey = PublicKey.default;

  signTransaction<T extends Transaction | VersionedTransaction>(
    tx: T,
  ): Promise<T> {
    void tx;
    return Promise.reject(
      new Error(
        "No wallet connected — connect Phantom on devnet to send transactions.",
      ),
    );
  }

  signAllTransactions<T extends Transaction | VersionedTransaction>(
    txs: T[],
  ): Promise<T[]> {
    void txs;
    return Promise.reject(
      new Error(
        "No wallet connected — connect Phantom on devnet to send transactions.",
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// PDA seeds (docs/SPEC.md, mirrored by programs/zafra/src/constants.rs)
// ---------------------------------------------------------------------------

export const PROGRAM_ID = new PublicKey(idlJson.address);

const seed = (s: string) => Buffer.from(s, "utf8");
const CONFIG_SEED = seed("config");
const POOL_VAULT_SEED = seed("pool_vault");
const WARRANT_SEED = seed("warrant");
const LOAN_SEED = seed("loan");
const WARRANT_VAULT_SEED = seed("warrant_vault");
const WARRANT_MINT_SEED = seed("warrant_mint");
const MINT_AUTHORITY_SEED = seed("mint_authority");

function pda(...seeds: Uint8Array[]): PublicKey {
  return PublicKey.findProgramAddressSync(seeds, PROGRAM_ID)[0];
}

export const configPda = () => pda(CONFIG_SEED);
export const poolVaultPda = () => pda(POOL_VAULT_SEED);
/** Warrant PDA — seeds ["warrant", silo_id.as_bytes()]. */
export const warrantPda = (siloId: string) =>
  pda(WARRANT_SEED, seed(siloId));
export const loanPda = (warrant: PublicKey) =>
  pda(LOAN_SEED, warrant.toBuffer());
export const warrantVaultPda = (warrant: PublicKey) =>
  pda(WARRANT_VAULT_SEED, warrant.toBuffer());
export const warrantMintPda = (warrant: PublicKey) =>
  pda(WARRANT_MINT_SEED, warrant.toBuffer());
export const mintAuthorityPda = (warrant: PublicKey) =>
  pda(MINT_AUTHORITY_SEED, warrant.toBuffer());

// ---------------------------------------------------------------------------
// Amount conversion — UI units <-> u64 base units
// ---------------------------------------------------------------------------

const USDC_FACTOR = 10 ** 6; // test USDC mint: 6 decimals

/** UI USDC -> u64 base units. */
const usdcToBase = (amount: number): BN =>
  new BN(Math.round(amount * USDC_FACTOR));

/** u64 base units -> UI USDC. */
const usdcFromBase = (amount: BN | bigint): number =>
  Number(amount.toString()) / USDC_FACTOR;

const unixNowSec = () => Date.now() / 1000;

// ---------------------------------------------------------------------------
// Decoded account shapes (subset of the IDL-generated types, camelCase)
// ---------------------------------------------------------------------------

interface DecodedConfig {
  admin: PublicKey;
  certifier: PublicKey;
  usdcMint: PublicKey;
  pricePerTon: BN;
  ltvBps: number;
  liqThresholdBps: number;
  feeBps: number;
  annualInterestBps: number;
  bump: number;
}

interface DecodedWarrant {
  owner: PublicKey;
  certifier: PublicKey;
  siloId: string;
  grain: number;
  tons: BN;
  mint: PublicKey;
  status: number;
  bump: number;
}

interface DecodedLoan {
  borrower: PublicKey;
  warrant: PublicKey;
  principal: BN;
  openedAt: BN;
  status: number;
  bump: number;
}

// ---------------------------------------------------------------------------
// Error mapping — on-chain AgroError code -> ZafraError with variant name
// ---------------------------------------------------------------------------

/** AgroError discriminants, in IDL order (programs/zafra/src/error.rs). */
const AGRO_ERROR_BY_CODE: Record<number, AgroError> = {
  6000: AgroError.NotAdmin,
  6001: AgroError.NotCertifier,
  6002: AgroError.NotOwner,
  6003: AgroError.WarrantNotIssued,
  6004: AgroError.LoanExists,
  6005: AgroError.LoanNotOpen,
  6006: AgroError.InsufficientLiquidity,
  6007: AgroError.LtvExceeded,
  6008: AgroError.HealthyLoan,
  6009: AgroError.MathOverflow,
  6010: AgroError.NothingToRepay,
  6011: AgroError.PriceNotSet,
};

/** Unwrap Anchor/RPC errors into ZafraError when a known code is found. */
function mapError(err: unknown): unknown {
  if (err instanceof AnchorError) {
    const code = AGRO_ERROR_BY_CODE[err.error.errorCode.number];
    if (code !== undefined) return new ZafraError(code);
  }
  return err;
}

const SETUP_HINT =
  "Zafra Config account not found on devnet — run setup-devnet first " +
  "(scripts/setup-devnet.ts initializes Config, the USDC mint and the pool).";

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class RealZafraClient implements ZafraClient {
  readonly program: Program<Zafra>;
  readonly provider: AnchorProvider;
  private readonly commitment: Commitment;

  constructor(
    connection: Connection,
    wallet?: ZafraWallet | null,
    commitment: Commitment = "confirmed",
  ) {
    this.commitment = commitment;
    this.provider = new AnchorProvider(
      connection,
      wallet ?? new ReadOnlyWallet(),
      { commitment },
    );
    this.program = new Program<Zafra>(idlJson, this.provider);
  }

  // -- reads ---------------------------------------------------------------

  async getConfig(): Promise<Config> {
    const acc = (await this.program.account.config.fetchNullable(
      configPda(),
      this.commitment,
    )) as DecodedConfig | null;
    if (!acc) throw new Error(SETUP_HINT);
    return {
      admin: acc.admin.toBase58(),
      certifier: acc.certifier.toBase58(),
      usdcMint: acc.usdcMint.toBase58(),
      pricePerTon: usdcFromBase(acc.pricePerTon),
      ltvBps: acc.ltvBps,
      liqThresholdBps: acc.liqThresholdBps,
      feeBps: acc.feeBps,
      annualInterestBps: acc.annualInterestBps,
    };
  }

  /**
   * Warrants owned by `owner` via a getProgramAccounts memcmp filter on the
   * `owner` field (offset 8, right after the account discriminator). With a
   * null owner every warrant is returned — used as a read-only preview before
   * a wallet is connected.
   */
  async getMyWarrants(owner: string | null): Promise<WarrantPosition[]> {
    const filters = owner
      ? [
          {
            memcmp: { offset: 8, bytes: new PublicKey(owner).toBase58() },
          },
        ]
      : [];
    const accounts = await this.program.account.warrant.all(filters);
    const positions = await Promise.all(
      accounts.map(async ({ publicKey, account }) => {
        const decoded = account as DecodedWarrant;
        const loanAcc = (await this.program.account.loan.fetchNullable(
          loanPda(publicKey),
          this.commitment,
        )) as DecodedLoan | null;
        return {
          warrant: toWarrant(publicKey, decoded),
          loan: loanAcc ? toLoan(loanPda(publicKey), loanAcc) : null,
        };
      }),
    );
    return positions.sort((a, b) =>
      a.warrant.siloId.localeCompare(b.warrant.siloId),
    );
  }

  async getOpenLoans(): Promise<OpenLoan[]> {
    const [config, loans] = await Promise.all([
      this.getConfig(),
      this.program.account.loan.all(),
    ]);
    const open = loans.filter((l) => l.account.status === LoanStatus.Open);
    const warrants = await this.program.account.warrant.fetchMultiple(
      open.map((l) => l.account.warrant),
      this.commitment,
    );
    const nowSec = unixNowSec();
    return open
      .map((l, i) => {
        const decodedLoan = l.account as DecodedLoan;
        const decodedWarrant = warrants[i] as DecodedWarrant | null;
        if (!decodedWarrant) return null;
        const warrant = toWarrant(l.account.warrant, decodedWarrant);
        const loan = toLoan(l.publicKey, decodedLoan);
        return {
          loan,
          warrant,
          collateralValue: collateralValue(warrant, config),
          debt: accruedDebt(loan, config, nowSec),
          healthFactor: healthFactor(warrant, loan, config, nowSec),
        };
      })
      .filter((o): o is OpenLoan => o !== null)
      .sort((a, b) => a.healthFactor - b.healthFactor);
  }

  async getPoolStats(): Promise<PoolStats> {
    const config = await this.getConfig();
    const poolAta = getAssociatedTokenAddressSync(
      new PublicKey(config.usdcMint),
      poolVaultPda(),
      /* allowOwnerOffCurve */ true,
    );
    // USDC actually held by the pool vault = what can still be borrowed.
    let available = 0;
    try {
      const vault = await getAccount(
        this.provider.connection,
        poolAta,
        this.commitment,
      );
      available = usdcFromBase(vault.amount);
    } catch {
      // Vault ATA absent until initialize deposits run — report an empty pool.
    }
    const loans = await this.program.account.loan.all();
    const outstandingDebt = loans
      .filter((l) => l.account.status === LoanStatus.Open)
      .reduce(
        (sum, l) =>
          sum + accruedDebt(toLoan(l.publicKey, l.account as DecodedLoan), config),
        0,
      );
    const totalLiquidity = available + outstandingDebt;
    return {
      totalLiquidity,
      outstandingDebt,
      available,
      utilizationBps:
        totalLiquidity > 0
          ? Math.round((outstandingDebt / totalLiquidity) * 10_000)
          : 0,
    };
  }

  // -- writes --------------------------------------------------------------

  /** Instruction: register_warrant (certifier-only on-chain). */
  async registerWarrant(
    input: RegisterWarrantInput,
  ): Promise<TxResult & { warrant: Warrant }> {
    const certifier = this.signer();
    const producer = new PublicKey(input.producer);
    const warrant = warrantPda(input.siloId);
    const mint = warrantMintPda(warrant);
    const tx = await this.program.methods
      .registerWarrant(
        input.siloId,
        input.grain,
        new BN(Math.round(input.tons)),
        producer,
      )
      .accountsPartial({
        certifier,
        config: configPda(),
        producer,
        warrant,
        mintAuthority: mintAuthorityPda(warrant),
        mint,
        producerTokenAccount: getAssociatedTokenAddressSync(mint, producer),
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .transaction();
    const signature = await this.send(tx);
    const acc = (await this.program.account.warrant.fetch(
      warrant,
      this.commitment,
    )) as DecodedWarrant;
    return { signature, warrant: toWarrant(warrant, acc) };
  }

  /** Instruction: borrow — move collateral to custody, draw USDC. */
  async borrow(warrantAddress: string): Promise<TxResult & { loan: Loan }> {
    const borrower = this.signer();
    const warrant = new PublicKey(warrantAddress);
    const wAcc = (await this.program.account.warrant.fetch(
      warrant,
      this.commitment,
    )) as DecodedWarrant;
    const usdcMint = await this.usdcMint();
    const warrantVault = warrantVaultPda(warrant);
    const poolVault = poolVaultPda();
    const loan = loanPda(warrant);
    const tx = await this.program.methods
      .borrow()
      .accountsPartial({
        borrower,
        usdcMint,
        mint: wAcc.mint,
        config: configPda(),
        warrant,
        loan,
        warrantVault,
        poolVault,
        borrowerWarrantTokenAccount: getAssociatedTokenAddressSync(
          wAcc.mint,
          borrower,
        ),
        custodyTokenAccount: getAssociatedTokenAddressSync(
          wAcc.mint,
          warrantVault,
          /* allowOwnerOffCurve */ true,
        ),
        poolVaultTokenAccount: getAssociatedTokenAddressSync(
          usdcMint,
          poolVault,
          /* allowOwnerOffCurve */ true,
        ),
        borrowerUsdcTokenAccount: getAssociatedTokenAddressSync(
          usdcMint,
          borrower,
        ),
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .transaction();
    const signature = await this.send(tx);
    const acc = (await this.program.account.loan.fetch(
      loan,
      this.commitment,
    )) as DecodedLoan;
    return { signature, loan: toLoan(loan, acc) };
  }

  /** Instruction: repay — pay debt with interest, release collateral. */
  async repay(warrantAddress: string): Promise<TxResult> {
    const borrower = this.signer();
    const warrant = new PublicKey(warrantAddress);
    const wAcc = (await this.program.account.warrant.fetch(
      warrant,
      this.commitment,
    )) as DecodedWarrant;
    const usdcMint = await this.usdcMint();
    const warrantVault = warrantVaultPda(warrant);
    const poolVault = poolVaultPda();
    const tx = await this.program.methods
      .repay()
      .accountsPartial({
        borrower,
        usdcMint,
        mint: wAcc.mint,
        config: configPda(),
        warrant,
        loan: loanPda(warrant),
        warrantVault,
        poolVault,
        borrowerUsdcTokenAccount: getAssociatedTokenAddressSync(
          usdcMint,
          borrower,
        ),
        poolVaultTokenAccount: getAssociatedTokenAddressSync(
          usdcMint,
          poolVault,
          /* allowOwnerOffCurve */ true,
        ),
        custodyTokenAccount: getAssociatedTokenAddressSync(
          wAcc.mint,
          warrantVault,
          /* allowOwnerOffCurve */ true,
        ),
        borrowerWarrantTokenAccount: getAssociatedTokenAddressSync(
          wAcc.mint,
          borrower,
        ),
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .transaction();
    return { signature: await this.send(tx) };
  }

  /** Instruction: deposit_liquidity — send USDC to the pool vault. */
  async depositLiquidity(amount: number): Promise<TxResult> {
    const depositor = this.signer();
    const usdcMint = await this.usdcMint();
    const poolVault = poolVaultPda();
    const tx = await this.program.methods
      .depositLiquidity(usdcToBase(amount))
      .accountsPartial({
        depositor,
        usdcMint,
        config: configPda(),
        depositorTokenAccount: getAssociatedTokenAddressSync(
          usdcMint,
          depositor,
        ),
        poolVault,
        poolVaultTokenAccount: getAssociatedTokenAddressSync(
          usdcMint,
          poolVault,
          /* allowOwnerOffCurve */ true,
        ),
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .transaction();
    return { signature: await this.send(tx) };
  }

  /** Instruction: set_price (admin-only on-chain). */
  async setPrice(pricePerTon: number): Promise<TxResult> {
    const admin = this.signer();
    const tx = await this.program.methods
      .setPrice(usdcToBase(pricePerTon))
      .accountsPartial({ admin, config: configPda() })
      .transaction();
    return { signature: await this.send(tx) };
  }

  /** Instruction: liquidate — permissionless when health < 1. */
  async liquidate(warrantAddress: string): Promise<TxResult> {
    const liquidator = this.signer();
    const warrant = new PublicKey(warrantAddress);
    const tx = await this.program.methods
      .liquidate()
      .accountsPartial({
        liquidator,
        config: configPda(),
        warrant,
        loan: loanPda(warrant),
      })
      .transaction();
    return { signature: await this.send(tx) };
  }

  // -- internals ------------------------------------------------------------

  /** Signer pubkey for write paths; fails fast when read-only. */
  async getWalletBalances(owner: string): Promise<WalletBalances> {
    const ownerPk = new PublicKey(owner);
    const connection = this.provider.connection;
    const [lamports, config] = await Promise.all([
      connection.getBalance(ownerPk, this.commitment),
      this.getConfig(),
    ]);
    let usdc = 0;
    try {
      const ata = getAssociatedTokenAddressSync(
        new PublicKey(config.usdcMint),
        ownerPk,
      );
      usdc = usdcFromBase((await getAccount(connection, ata, this.commitment)).amount);
    } catch {
      // No USDC token account yet — balance is zero.
    }
    return { sol: lamports / 1e9, usdc };
  }

  async siloIdExists(siloId: string): Promise<boolean> {
    const info = await this.provider.connection.getAccountInfo(
      warrantPda(siloId),
      this.commitment,
    );
    return info !== null;
  }

  async getAllWarrants(): Promise<Warrant[]> {
    const all = await this.program.account.warrant.all();
    return all.map((w) => toWarrant(w.publicKey, w.account as DecodedWarrant));
  }

  private signer(): PublicKey {
    const pk = this.provider.wallet.publicKey;
    if (!pk || pk.equals(PublicKey.default)) {
      throw new Error(
        "No wallet connected — connect Phantom on devnet to send transactions.",
      );
    }
    return pk;
  }

  /** Fetch usdc_mint from the Config PDA (source of truth on-chain). */
  private async usdcMint(): Promise<PublicKey> {
    const config = await this.getConfig();
    return new PublicKey(config.usdcMint);
  }

  /** Sign + send + confirm, mapping on-chain errors to ZafraError. */
  private async send(tx: Transaction): Promise<string> {
    try {
      return await this.provider.sendAndConfirm(tx, [], {
        commitment: this.commitment,
      });
    } catch (err) {
      throw mapError(err);
    }
  }
}

// ---------------------------------------------------------------------------
// Decoded -> UI-unit mappers
// ---------------------------------------------------------------------------

function toWarrant(address: PublicKey, acc: DecodedWarrant): Warrant {
  return {
    address: address.toBase58(),
    owner: acc.owner.toBase58(),
    certifier: acc.certifier.toBase58(),
    siloId: acc.siloId,
    grain: acc.grain,
    tons: Number(acc.tons.toString()),
    mint: acc.mint.toBase58(),
    status: acc.status,
  };
}

function toLoan(address: PublicKey, acc: DecodedLoan): Loan {
  return {
    address: address.toBase58(),
    borrower: acc.borrower.toBase58(),
    warrant: acc.warrant.toBase58(),
    principal: usdcFromBase(acc.principal),
    openedAt: Number(acc.openedAt.toString()),
    status: acc.status,
  };
}
