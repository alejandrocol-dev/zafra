/**
 * Zafra data layer.
 *
 * Everything the UI needs from the on-chain program goes through the
 * `ZafraClient` interface below. The exported `zafra` singleton is a
 * MOCK implementation: it keeps in-memory state, adds artificial latency and
 * returns fake (but well-formed) transaction signatures so the UI can already
 * render devnet explorer links.
 *
 * Swap path: build the real client from the generated IDL
 * (target/idl/zafra.json), implement this same interface against it and
 * change the single export at the bottom of the file. No view code should
 * need to change.
 *
 * Conventions (mirror docs/SPEC.md):
 * - Pubkeys / account addresses are base58 strings.
 * - Money and commodity amounts are expressed in UI units
 *   (1 = 1 USDC, 1 = 1 ton). The real implementation converts to u64 base
 *   units (USDC 6 decimals, warrant 0 decimals) at this boundary so views
 *   never deal with lamports.
 * - Errors thrown by instructions carry the on-chain AgroError variant name.
 */

import { Connection } from "@solana/web3.js";
import type {
  PublicKey,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";

// ---------------------------------------------------------------------------
// Types — match docs/SPEC.md accounts and enums
// ---------------------------------------------------------------------------

export enum Grain {
  Soybean = 0,
}

export const GRAIN_LABELS: Record<Grain, string> = {
  [Grain.Soybean]: "Soybean",
};

export enum WarrantStatus {
  Issued = 0,
  InCustody = 1,
  Liquidated = 2,
  Released = 3,
}

export const WARRANT_STATUS_LABELS: Record<WarrantStatus, string> = {
  [WarrantStatus.Issued]: "Issued",
  [WarrantStatus.InCustody]: "In custody",
  [WarrantStatus.Liquidated]: "Liquidated",
  [WarrantStatus.Released]: "Released",
};

export enum LoanStatus {
  Open = 0,
  Repaid = 1,
  Liquidated = 2,
}

export const LOAN_STATUS_LABELS: Record<LoanStatus, string> = {
  [LoanStatus.Open]: "Open",
  [LoanStatus.Repaid]: "Repaid",
  [LoanStatus.Liquidated]: "Liquidated",
};

/** Variant names mirror the on-chain `AgroError` enum (SPEC). */
export enum AgroError {
  NotAdmin = "NotAdmin",
  NotCertifier = "NotCertifier",
  NotOwner = "NotOwner",
  WarrantNotIssued = "WarrantNotIssued",
  LoanExists = "LoanExists",
  LoanNotOpen = "LoanNotOpen",
  InsufficientLiquidity = "InsufficientLiquidity",
  LtvExceeded = "LtvExceeded",
  HealthyLoan = "HealthyLoan",
  MathOverflow = "MathOverflow",
  NothingToRepay = "NothingToRepay",
  PriceNotSet = "PriceNotSet",
}

export class ZafraError extends Error {
  constructor(public readonly code: AgroError) {
    super(code);
    this.name = "ZafraError";
  }
}

/** On-chain `Config` PDA (seeds ["config"]). */
export interface Config {
  admin: string;
  certifier: string;
  usdcMint: string;
  /** USDC per ton. On-chain: u64 with 6 decimals. Here: UI units. */
  pricePerTon: number;
  /** Loan-to-value in basis points (def 7000 = 70%). */
  ltvBps: number;
  /** Liquidation threshold in basis points (def 8000 = 80%). */
  liqThresholdBps: number;
  /** Origination fee in basis points (def 75). */
  feeBps: number;
  /** Simple annual interest in basis points. */
  annualInterestBps: number;
}

/** On-chain `Warrant` PDA (seeds ["warrant", silo_id]). */
export interface Warrant {
  /** Warrant PDA address. */
  address: string;
  /** Producer wallet that owns the warrant tokens. */
  owner: string;
  certifier: string;
  siloId: string;
  grain: Grain;
  /** Tons of grain = SPL mint supply (0 decimals on-chain). */
  tons: number;
  /** SPL mint address of the warrant token. */
  mint: string;
  status: WarrantStatus;
}

/** On-chain `Loan` PDA (seeds ["loan", warrant]). */
export interface Loan {
  /** Loan PDA address. */
  address: string;
  borrower: string;
  /** Warrant PDA backing this loan. */
  warrant: string;
  /** USDC principal. */
  principal: number;
  /** Unix timestamp (seconds). */
  openedAt: number;
  status: LoanStatus;
}

/** A warrant plus its associated loan (if any) — what the Producer view needs. */
export interface WarrantPosition {
  warrant: Warrant;
  loan: Loan | null;
}

/** Aggregate view of the USDC liquidity pool. */
export interface PoolStats {
  /** Total USDC managed by the pool (deposits + collected interest/fees). */
  totalLiquidity: number;
  /** USDC currently lent out (accrued debt of open loans). */
  outstandingDebt: number;
  /** USDC available to borrow. */
  available: number;
  /** outstandingDebt / totalLiquidity, in basis points. */
  utilizationBps: number;
}

/** An open loan enriched with risk data — what the Admin view needs. */
export interface OpenLoan {
  loan: Loan;
  warrant: Warrant;
  /** tons × pricePerTon, in USDC. */
  collateralValue: number;
  /** principal + accrued simple interest, in USDC. */
  debt: number;
  /** collateralValue × liqThreshold / debt. Liquidatable when < 1. */
  healthFactor: number;
}

export interface RegisterWarrantInput {
  siloId: string;
  grain: Grain;
  tons: number;
  /** Producer wallet address that receives the warrant tokens. */
  producer: string;
}

export interface TxResult {
  /** Transaction signature (fake in the mock, real once on-chain). */
  signature: string;
}

export interface WalletBalances {
  /** SOL for network fees. */
  sol: number;
  /** Test USDC, UI units. */
  usdc: number;
}

/** Program instruction a transaction executed (read from its logs). */
export type ActivityKind =
  | "initialize"
  | "setPrice"
  | "registerWarrant"
  | "depositLiquidity"
  | "borrow"
  | "repay"
  | "liquidate"
  | "other";

/** One recent program transaction — what the activity feed shows. */
export interface Activity {
  signature: string;
  kind: ActivityKind;
  /** Unix seconds (null if the RPC didn't report it). */
  blockTime: number | null;
  failed: boolean;
}

/** Map an Anchor "Program log: Instruction: Xyz" line to an ActivityKind. */
export function activityKindFromLogs(logs: readonly string[] | null | undefined): ActivityKind {
  const line = logs?.find((l) => l.startsWith("Program log: Instruction: "));
  const name = line?.slice("Program log: Instruction: ".length).trim().toLowerCase();
  const map: Record<string, ActivityKind> = {
    initialize: "initialize",
    setprice: "setPrice",
    registerwarrant: "registerWarrant",
    depositliquidity: "depositLiquidity",
    borrow: "borrow",
    repay: "repay",
    liquidate: "liquidate",
  };
  return (name && map[name]) || "other";
}

/** Demo reference price (USDC per ton) used by the "reset" button and the demo guide. */
export const DEFAULT_PRICE_PER_TON = 380;

/** Next free Silo ID given the ones already taken, e.g. SILO-TUC-005. */
export function suggestNextSiloId(taken: string[], prefix = "SILO-TUC-"): string {
  const used = taken
    .filter((id) => id.startsWith(prefix))
    .map((id) => Number(id.slice(prefix.length)))
    .filter((n) => Number.isInteger(n));
  const next = (used.length ? Math.max(...used) : 0) + 1;
  return `${prefix}${String(next).padStart(3, "0")}`;
}

// ---------------------------------------------------------------------------
// Client interface — implement this against the real program to go live
// ---------------------------------------------------------------------------

export interface ZafraClient {
  getConfig(): Promise<Config>;
  /** Warrants owned by `owner` (pass null to preview demo data). */
  getMyWarrants(owner: string | null): Promise<WarrantPosition[]>;
  /** All open loans with live risk metrics (admin / liquidator view). */
  getOpenLoans(): Promise<OpenLoan[]>;
  getPoolStats(): Promise<PoolStats>;
  /** SOL and test-USDC balances of a wallet (0 when the token account doesn't exist). */
  getWalletBalances(owner: string): Promise<WalletBalances>;
  /** Whether a warrant with this Silo ID already exists (the PDA is unique per ID). */
  siloIdExists(siloId: string): Promise<boolean>;
  /** Every warrant in the program (for KPIs and Silo ID suggestions). */
  getAllWarrants(): Promise<Warrant[]>;
  /** Most recent program transactions, newest first (activity feed). */
  getRecentActivity(limit?: number): Promise<Activity[]>;

  /** Instruction: register_warrant (certifier only on-chain). */
  registerWarrant(
    input: RegisterWarrantInput,
  ): Promise<TxResult & { warrant: Warrant }>;
  /** Instruction: borrow — custody warrant, draw max LTV minus fee. */
  borrow(warrantAddress: string): Promise<TxResult & { loan: Loan }>;
  /** Instruction: repay — pay debt, release collateral. */
  repay(warrantAddress: string): Promise<TxResult>;
  /** Instruction: deposit_liquidity — add USDC to the pool. */
  depositLiquidity(amount: number): Promise<TxResult>;
  /** Instruction: set_price (admin only on-chain). */
  setPrice(pricePerTon: number): Promise<TxResult>;
  /** Instruction: liquidate — permissionless when health < 1. */
  liquidate(warrantAddress: string): Promise<TxResult>;
}

// ---------------------------------------------------------------------------
// Pure math helpers — same formulas as the program (SPEC §Matemática)
// ---------------------------------------------------------------------------

/** value = tons × price_per_ton */
export function collateralValue(warrant: Warrant, config: Config): number {
  return warrant.tons * config.pricePerTon;
}

/** max_loan = value × ltv_bps / 10000 */
export function maxBorrowAmount(warrant: Warrant, config: Config): number {
  return (collateralValue(warrant, config) * config.ltvBps) / 10_000;
}

/** Origination fee charged on draw: max_loan × fee_bps / 10000. */
export function originationFee(warrant: Warrant, config: Config): number {
  return (maxBorrowAmount(warrant, config) * config.feeBps) / 10_000;
}

const SECONDS_PER_YEAR = 365.25 * 24 * 60 * 60;

/** debt = principal + principal × annual_interest_bps × elapsed_years / 10000 */
export function accruedDebt(
  loan: Loan,
  config: Config,
  nowSec: number = Date.now() / 1000,
): number {
  const elapsedYears = Math.max(0, nowSec - loan.openedAt) / SECONDS_PER_YEAR;
  return loan.principal * (1 + (config.annualInterestBps * elapsedYears) / 10_000);
}

/** health = value × liq_threshold_bps / (debt × 10000). Liquidatable when < 1. */
export function healthFactor(
  warrant: Warrant,
  loan: Loan,
  config: Config,
  nowSec: number = Date.now() / 1000,
): number {
  const debt = accruedDebt(loan, config, nowSec);
  if (debt <= 0) return Number.POSITIVE_INFINITY;
  return (collateralValue(warrant, config) * config.liqThresholdBps) / (debt * 10_000);
}

// ---------------------------------------------------------------------------
// Mock implementation
// ---------------------------------------------------------------------------

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** Deterministic base58-looking 44-char string, so addresses look real. */
function fakePubkey(seed: string): string {
  let x = 2166136261;
  for (const c of seed) {
    x ^= c.charCodeAt(0);
    x = Math.imul(x, 16777619);
  }
  let out = "";
  for (let i = 0; i < 44; i++) {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    out += B58[x % 58];
  }
  return out;
}

/** Random 88-char base58 string — looks like a real tx signature. */
function fakeSig(): string {
  let out = "";
  for (let i = 0; i < 88; i++) out += B58[Math.floor(Math.random() * 58)];
  return out;
}

/** Demo producer used to seed positions (and shown when no wallet is connected). */
export const DEMO_PRODUCER = fakePubkey("zafra-demo-producer");

const LATENCY_MS = 700;
const delay = () =>
  new Promise<void>((resolve) =>
    setTimeout(resolve, LATENCY_MS + Math.random() * 400),
  );

interface MockState {
  config: Config;
  /** USDC held by the pool vault (deposits + fees + interest). */
  poolTotal: number;
  warrants: Warrant[];
  loans: Loan[];
  activity: Activity[];
}

const DAY = 24 * 60 * 60;
const nowSec = () => Date.now() / 1000;

function makeWarrant(
  siloId: string,
  owner: string,
  certifier: string,
  tons: number,
  status: WarrantStatus,
): Warrant {
  return {
    address: fakePubkey(`warrant:${siloId}`),
    owner,
    certifier,
    siloId,
    grain: Grain.Soybean,
    tons,
    mint: fakePubkey(`mint:${siloId}`),
    status,
  };
}

function seed(): MockState {
  const config: Config = {
    admin: fakePubkey("zafra-admin"),
    certifier: fakePubkey("zafra-certifier"),
    usdcMint: fakePubkey("zafra-usdc-mint"),
    pricePerTon: 380,
    ltvBps: 7000,
    liqThresholdBps: 8000,
    feeBps: 75,
    annualInterestBps: 900,
  };

  const demo = DEMO_PRODUCER;
  const otherProducer = fakePubkey("zafra-other-producer");

  const w1 = makeWarrant("SILO-AR-0042", demo, config.certifier, 120, WarrantStatus.InCustody);
  const w2 = makeWarrant("SILO-AR-0117", demo, config.certifier, 80, WarrantStatus.Issued);
  const w3 = makeWarrant("SILO-BR-0208", otherProducer, config.certifier, 200, WarrantStatus.InCustody);

  const loans: Loan[] = [w1, w3].map((w, i) => ({
    address: fakePubkey(`loan:${w.address}`),
    borrower: w.owner,
    warrant: w.address,
    principal: maxBorrowAmount(w, config),
    openedAt: nowSec() - (i === 0 ? 6 : 21) * DAY,
    status: LoanStatus.Open,
  }));

  const kinds: Array<[ActivityKind, number]> = [
    ["borrow", 6 * DAY],
    ["registerWarrant", 7 * DAY],
    ["borrow", 21 * DAY],
    ["registerWarrant", 22 * DAY],
    ["depositLiquidity", 25 * DAY],
    ["setPrice", 26 * DAY],
    ["initialize", 26 * DAY + 60],
  ];
  const activity = kinds.map(([kind, ago]) => ({
    signature: fakeSig(),
    kind,
    blockTime: nowSec() - ago,
    failed: false,
  }));

  return { config, poolTotal: 400_000, warrants: [w1, w2, w3], loans, activity };
}

class MockZafraClient implements ZafraClient {
  private state = seed();

  async getConfig(): Promise<Config> {
    await delay();
    return { ...this.state.config };
  }

  async getMyWarrants(owner: string | null): Promise<WarrantPosition[]> {
    await delay();
    const positions = this.state.warrants.filter((w) => w.owner === owner);
    return positions
      .map((warrant) => ({
        warrant: { ...warrant },
        loan: this.findLatestLoan(warrant.address),
      }))
      .sort((a, b) => a.warrant.siloId.localeCompare(b.warrant.siloId));
  }

  async getOpenLoans(): Promise<OpenLoan[]> {
    await delay();
    return this.state.loans
      .filter((l) => l.status === LoanStatus.Open)
      .map((loan) => {
        const warrant = this.mustWarrant(loan.warrant);
        const debt = accruedDebt(loan, this.state.config);
        return {
          loan: { ...loan },
          warrant: { ...warrant },
          collateralValue: collateralValue(warrant, this.state.config),
          debt,
          healthFactor: healthFactor(warrant, loan, this.state.config),
        };
      })
      .sort((a, b) => a.healthFactor - b.healthFactor);
  }

  async getWalletBalances(): Promise<WalletBalances> {
    await delay();
    return { sol: 5, usdc: 100_000 };
  }

  async siloIdExists(siloId: string): Promise<boolean> {
    await delay();
    return this.state.warrants.some((w) => w.siloId === siloId);
  }

  async getAllWarrants(): Promise<Warrant[]> {
    await delay();
    return this.state.warrants.map((w) => ({ ...w }));
  }

  async getRecentActivity(limit = 10): Promise<Activity[]> {
    await delay();
    return this.state.activity.slice(0, limit).map((a) => ({ ...a }));
  }

  async getPoolStats(): Promise<PoolStats> {
    await delay();
    const outstanding = this.state.loans
      .filter((l) => l.status === LoanStatus.Open)
      .reduce((sum, l) => sum + accruedDebt(l, this.state.config), 0);
    const total = this.state.poolTotal;
    return {
      totalLiquidity: total,
      outstandingDebt: outstanding,
      available: Math.max(0, total - outstanding),
      utilizationBps: total > 0 ? Math.round((outstanding / total) * 10_000) : 0,
    };
  }

  async registerWarrant(
    input: RegisterWarrantInput,
  ): Promise<TxResult & { warrant: Warrant }> {
    await delay();
    if (!input.siloId.trim()) throw new ZafraError(AgroError.MathOverflow);
    if (input.tons <= 0) throw new ZafraError(AgroError.MathOverflow);
    if (this.state.warrants.some((w) => w.siloId === input.siloId)) {
      throw new ZafraError(AgroError.LoanExists);
    }
    const warrant = makeWarrant(
      input.siloId.trim(),
      input.producer.trim(),
      this.state.config.certifier,
      input.tons,
      WarrantStatus.Issued,
    );
    this.state.warrants.push(warrant);
    return { signature: this.log("registerWarrant"), warrant: { ...warrant } };
  }

  async borrow(warrantAddress: string): Promise<TxResult & { loan: Loan }> {
    await delay();
    const warrant = this.mustWarrant(warrantAddress);
    if (warrant.status !== WarrantStatus.Issued) {
      throw new ZafraError(AgroError.WarrantNotIssued);
    }
    if (this.openLoanFor(warrantAddress)) {
      throw new ZafraError(AgroError.LoanExists);
    }
    const principal = maxBorrowAmount(warrant, this.state.config);
    const draw = principal - originationFee(warrant, this.state.config);
    const outstanding = this.state.loans
      .filter((l) => l.status === LoanStatus.Open)
      .reduce((sum, l) => sum + l.principal, 0);
    if (this.state.poolTotal - outstanding < draw) {
      throw new ZafraError(AgroError.InsufficientLiquidity);
    }
    const loan: Loan = {
      address: fakePubkey(`loan:${warrant.address}`),
      borrower: warrant.owner,
      warrant: warrant.address,
      principal,
      openedAt: nowSec(),
      status: LoanStatus.Open,
    };
    this.state.loans.push(loan);
    warrant.status = WarrantStatus.InCustody;
    return { signature: this.log("borrow"), loan: { ...loan } };
  }

  async repay(warrantAddress: string): Promise<TxResult> {
    await delay();
    const warrant = this.mustWarrant(warrantAddress);
    const loan = this.openLoanFor(warrantAddress);
    if (!loan) throw new ZafraError(AgroError.LoanNotOpen);
    const debt = accruedDebt(loan, this.state.config);
    if (debt <= 0) throw new ZafraError(AgroError.NothingToRepay);
    // Interest earned stays in the pool.
    this.state.poolTotal += debt - loan.principal;
    loan.status = LoanStatus.Repaid;
    warrant.status = WarrantStatus.Released;
    return { signature: this.log("repay") };
  }

  async depositLiquidity(amount: number): Promise<TxResult> {
    await delay();
    if (!(amount > 0)) throw new ZafraError(AgroError.MathOverflow);
    this.state.poolTotal += amount;
    return { signature: this.log("depositLiquidity") };
  }

  async setPrice(pricePerTon: number): Promise<TxResult> {
    await delay();
    if (!(pricePerTon > 0)) throw new ZafraError(AgroError.MathOverflow);
    this.state.config.pricePerTon = pricePerTon;
    return { signature: this.log("setPrice") };
  }

  async liquidate(warrantAddress: string): Promise<TxResult> {
    await delay();
    const warrant = this.mustWarrant(warrantAddress);
    const loan = this.openLoanFor(warrantAddress);
    if (!loan) throw new ZafraError(AgroError.LoanNotOpen);
    if (healthFactor(warrant, loan, this.state.config) >= 1) {
      throw new ZafraError(AgroError.HealthyLoan);
    }
    loan.status = LoanStatus.Liquidated;
    warrant.status = WarrantStatus.Liquidated;
    return { signature: this.log("liquidate") };
  }

  // -- internals ------------------------------------------------------------

  private log(kind: ActivityKind): string {
    const signature = fakeSig();
    this.state.activity.unshift({ signature, kind, blockTime: nowSec(), failed: false });
    return signature;
  }

  private mustWarrant(address: string): Warrant {
    const warrant = this.state.warrants.find((w) => w.address === address);
    if (!warrant) throw new ZafraError(AgroError.NotOwner);
    return warrant;
  }

  private openLoanFor(warrantAddress: string): Loan | undefined {
    return this.state.loans.find(
      (l) => l.warrant === warrantAddress && l.status === LoanStatus.Open,
    );
  }

  private findLatestLoan(warrantAddress: string): Loan | null {
    const loan = this.state.loans.find((l) => l.warrant === warrantAddress);
    return loan ? { ...loan } : null;
  }
}

// ---------------------------------------------------------------------------
// Mock/real router
// ---------------------------------------------------------------------------

/**
 * Minimal signer shape published by the app shell once a wallet connects —
 * structurally identical to the wallet-adapter's `AnchorWallet` and to the
 * anchor `Wallet` interface, declared here so this module keeps no anchor
 * dependency.
 */
export interface ZafraSigner {
  publicKey: PublicKey;
  signTransaction<T extends Transaction | VersionedTransaction>(
    tx: T,
  ): Promise<T>;
  signAllTransactions<T extends Transaction | VersionedTransaction>(
    txs: T[],
  ): Promise<T[]>;
}

/** Connection + signer the app shell registers when a wallet connects. */
export interface ZafraRuntime {
  connection: Connection;
  wallet: ZafraSigner;
}

let runtime: ZafraRuntime | null = null;

/**
 * Called by AppProviders whenever the wallet-adapter connection or signer
 * changes (including on disconnect, with `null`). Only consumed when the
 * real client is enabled — registering is always safe.
 */
export function setZafraRuntime(rt: ZafraRuntime | null): void {
  runtime = rt;
}

const USE_REAL = process.env.NEXT_PUBLIC_USE_REAL === "true";
/** True when the UI talks to the on-chain program (devnet) instead of the in-memory mock. */
export const isRealMode = USE_REAL;
const RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.devnet.solana.com";

/**
 * The client the UI talks to.
 *
 * Routing rules (the swap to on-chain is a single env var, no code change):
 * - `NEXT_PUBLIC_USE_REAL !== "true"` → the in-memory mock (current default;
 *   keeps the UI fully demoable until the devnet setup exists).
 * - real mode + wallet connected → `RealZafraClient` over
 *   `@coral-xyz/anchor`, lazy-imported so anchor never lands in the default
 *   bundle.
 * - real mode without a wallet → `RealZafraClient` in read-only mode.
 *   NEVER fall back to the mock in real mode: the demo must show chain state
 *   or nothing — fake data presented as real is worse than an error.
 */
class ZafraRouter implements ZafraClient {
  private readonly mock = new MockZafraClient();
  private cached: {
    wallet: ZafraSigner | null;
    client: ZafraClient;
  } | null = null;

  private async target(): Promise<ZafraClient> {
    if (!USE_REAL) return this.mock;
    const rt = runtime;
    if (!this.cached || this.cached.wallet !== (rt?.wallet ?? null)) {
      const { RealZafraClient } = await import("./zafra-real");
      this.cached = {
        wallet: rt?.wallet ?? null,
        client: new RealZafraClient(
          rt?.connection ?? new Connection(RPC_ENDPOINT, "confirmed"),
          rt?.wallet ?? null,
        ),
      };
    }
    return this.cached.client;
  }

  /**
   * Reads on the public devnet RPC are rate-limited (HTTP 429), and several
   * screens ask for the same data at once. In real mode we dedupe identical
   * in-flight/recent reads (short TTL), serialize them through a small queue
   * so they don't burst, and retry 429s with backoff. Every write clears the
   * cache so the UI never shows pre-transaction state.
   */
  private readCache = new Map<string, { at: number; promise: Promise<unknown> }>();
  private readQueue: Promise<unknown> = Promise.resolve();

  /** Runs reads one at a time with a short gap, so page loads don't burst. */
  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.readQueue.then(fn);
    this.readQueue = run
      .then(() => new Promise((r) => setTimeout(r, 150)), () => new Promise((r) => setTimeout(r, 150)));
    return run;
  }

  private read<T>(
    key: string,
    fn: (c: ZafraClient) => Promise<T>,
    ttlMs = 6_000,
  ): Promise<T> {
    if (!USE_REAL) return this.target().then(fn);
    const scoped = `${runtime?.wallet.publicKey.toBase58() ?? "anon"}:${key}`;
    const hit = this.readCache.get(scoped);
    if (hit && Date.now() - hit.at < ttlMs) return hit.promise as Promise<T>;
    const promise = withTimeout(
      withRateLimitRetry(() => this.enqueue(() => this.target().then(fn))),
      READ_TIMEOUT_MS,
    );
    this.readCache.set(scoped, { at: Date.now(), promise });
    promise.catch(() => {
      if (this.readCache.get(scoped)?.promise === promise) {
        this.readCache.delete(scoped);
      }
    });
    return promise;
  }

  private async write<T>(fn: (c: ZafraClient) => Promise<T>): Promise<T> {
    try {
      return await this.target().then(fn);
    } finally {
      this.readCache.clear();
    }
  }

  getConfig() {
    return this.read("config", (c) => c.getConfig());
  }
  getMyWarrants(owner: string | null) {
    return this.read(`warrants:${owner}`, (c) => c.getMyWarrants(owner));
  }
  getOpenLoans() {
    return this.read("openLoans", (c) => c.getOpenLoans());
  }
  getPoolStats() {
    return this.read("pool", (c) => c.getPoolStats());
  }
  getWalletBalances(owner: string) {
    return this.read(`balances:${owner}`, (c) => c.getWalletBalances(owner));
  }
  siloIdExists(siloId: string) {
    return this.read(`silo:${siloId}`, (c) => c.siloIdExists(siloId), 3_000);
  }
  getAllWarrants() {
    return this.read("allWarrants", (c) => c.getAllWarrants());
  }
  getRecentActivity(limit = 10) {
    return this.read(`activity:${limit}`, (c) => c.getRecentActivity(limit), 20_000);
  }
  registerWarrant(input: RegisterWarrantInput) {
    return this.write((c) => c.registerWarrant(input));
  }
  borrow(warrantAddress: string) {
    return this.write((c) => c.borrow(warrantAddress));
  }
  repay(warrantAddress: string) {
    return this.write((c) => c.repay(warrantAddress));
  }
  depositLiquidity(amount: number) {
    return this.write((c) => c.depositLiquidity(amount));
  }
  setPrice(pricePerTon: number) {
    return this.write((c) => c.setPrice(pricePerTon));
  }
  liquidate(warrantAddress: string) {
    return this.write((c) => c.liquidate(warrantAddress));
  }
}

/**
 * A public-RPC request that never answers must surface as an error — otherwise
 * the UI sits on skeletons forever. Covers the whole retry sequence.
 */
const READ_TIMEOUT_MS = 30_000;

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Devnet RPC timed out")),
          ms,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** Retry only HTTP 429 / rate-limit failures, with growing jittered delays. */
async function withRateLimitRetry<T>(fn: () => Promise<T>, attempts = 6): Promise<T> {
  let delayMs = 800;
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (err) {
      const msg = String((err as Error)?.message ?? err);
      const limited = /429|too many requests|rate.?limit/i.test(msg);
      if (!limited || i >= attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, delayMs + Math.random() * 400));
      delayMs = Math.min(delayMs * 2, 8_000);
    }
  }
}

export const zafra: ZafraClient = new ZafraRouter();
