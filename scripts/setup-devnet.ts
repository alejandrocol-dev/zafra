/**
 * setup-devnet.ts — Zafra demo bootstrap on devnet.
 *
 * One wallet plays every demo role (admin + certifier + investor + producer):
 * the solana-cli keypair at ~/.config/solana/id.json.
 *
 *   1. Creates a test USDC mint (6 decimals, payer = authority), reused from .env if present.
 *   2. `initialize` — certifier = payer, annual_interest_bps = 1200 (skipped if Config exists).
 *   3. `set_price(380_000_000)` — 380 USDC/ton in 6-decimals units.
 *   4. Mints USDC to the payer and `deposit_liquidity` until the pool holds 500_000 USDC.
 *   5. `register_warrant` — silo "SILO-TUC-001", grain 0 (soybean), 100 tons, producer = payer.
 *   6. Writes .env and app/.env.local.
 *   7. Reads Config + pool balance back as a sanity check.
 *
 * Run:  npx tsx scripts/setup-devnet.ts   (from repo root, inside WSL)
 * Idempotent: re-running reuses the mint and skips already-done steps.
 */

import { AnchorProvider, BN, Program, Wallet, setProvider } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createMint,
  getAccount,
  getAssociatedTokenAddressSync,
  getMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import {
  Commitment,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REPO_ROOT = path.resolve(__dirname, "..");
const IDL_PATH = path.join(REPO_ROOT, "target", "idl", "zafra.json");
const ENV_PATH = path.join(REPO_ROOT, ".env");
const APP_ENV_PATH = path.join(REPO_ROOT, "app", ".env.local");
const KEYPAIR_PATH = path.join(os.homedir(), ".config", "solana", "id.json");

const RPC_URL = "https://api.devnet.solana.com";
const COMMITMENT: Commitment = "confirmed";

const ANNUAL_INTEREST_BPS = 1200; // 12% APR — demo assumption, not a real rate
const PRICE_PER_TON = new BN(380_000_000); // 380 USDC, 6 decimals
const POOL_TARGET_USDC = new BN(500_000).muln(1_000_000); // 500k USDC, 6 decimals

const SILO_ID = "SILO-TUC-001";
const GRAIN_SOYBEAN = 0;
const WARRANT_TONS = new BN(100);

const explorerTx = (sig: string) =>
  `https://explorer.solana.com/tx/${sig}?cluster=devnet`;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retry transient devnet-RPC failures (429s, timeouts, lost confirmations). */
async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  attempts = 6
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = String((err as Error)?.message ?? err);
      const transient =
        /429|too many requests|rate.?limit|timed? ?out|ETIMEDOUT|ECONNRESET|ENOTFOUND|fetch failed|socket hang|blockhash|not confirmed|node is (behind|unhealthy)|503|502/i.test(
          msg
        );
      if (!transient || i === attempts - 1) throw err;
      const delay = Math.min(1000 * 2 ** i, 15_000);
      console.log(
        `  [retry ${i + 1}/${attempts}] ${label}: ${msg.slice(0, 140)} — waiting ${delay}ms`
      );
      await sleep(delay);
    }
  }
  throw lastErr;
}

/** Parse KEY=VALUE pairs from a dotenv-style file (missing file → {}). */
function readEnvFile(file: string): Record<string, string> {
  if (!fs.existsSync(file)) return {};
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function loadPayer(): Keypair {
  const secret = JSON.parse(fs.readFileSync(KEYPAIR_PATH, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const payer = loadPayer();
  const connection = new Connection(RPC_URL, {
    commitment: COMMITMENT,
    confirmTransactionInitialTimeout: 90_000,
  });
  const provider = new AnchorProvider(connection, new Wallet(payer), {
    commitment: COMMITMENT,
    preflightCommitment: COMMITMENT,
  });
  setProvider(provider);

  const idl = JSON.parse(fs.readFileSync(IDL_PATH, "utf8"));
  const program = new Program(idl, provider);
  const programId = program.programId;

  console.log("== Zafra devnet setup ==");
  console.log("program :", programId.toBase58());
  console.log("payer   :", payer.publicKey.toBase58());
  console.log(
    "balance :",
    ((await withRetry("balance", () => connection.getBalance(payer.publicKey))) / 1e9).toFixed(4),
    "SOL"
  );

  const sigs: Record<string, string> = {};

  // -- PDAs ---------------------------------------------------------------
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    programId
  );
  const [poolVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("pool_vault")],
    programId
  );
  const [warrantPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("warrant"), Buffer.from(SILO_ID, "utf8")],
    programId
  );
  const [mintAuthorityPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("mint_authority"), warrantPda.toBuffer()],
    programId
  );
  const [warrantMintPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("warrant_mint"), warrantPda.toBuffer()],
    programId
  );

  // -- 1. Test USDC mint ----------------------------------------------------
  const prevEnv = readEnvFile(ENV_PATH);
  let usdcMint: PublicKey | null = null;

  if (prevEnv.USDC_MINT) {
    try {
      const candidate = new PublicKey(prevEnv.USDC_MINT);
      const mintInfo = await withRetry("getMint", () =>
        getMint(connection, candidate, COMMITMENT, TOKEN_PROGRAM_ID)
      );
      if (mintInfo.decimals === 6) {
        usdcMint = candidate;
        console.log("\n[1] Reusing USDC mint from .env:", usdcMint.toBase58());
      } else {
        console.log("\n[1] .env mint has wrong decimals, creating a new one");
      }
    } catch {
      console.log("\n[1] .env mint not found on-chain, creating a new one");
    }
  }

  if (!usdcMint) {
    // Explicit keypair so a retried createMint recreates the *same* mint.
    const mintKeypair = Keypair.generate();
    usdcMint = await withRetry("createMint", () =>
      createMint(
        connection,
        payer,
        payer.publicKey, // mint authority
        null, // no freeze authority
        6,
        mintKeypair,
        { commitment: COMMITMENT },
        TOKEN_PROGRAM_ID
      )
    );
    console.log("\n[1] Created test USDC mint:", usdcMint.toBase58());
  }

  // -- 2. initialize ---------------------------------------------------------
  const configInfo = await withRetry("config lookup", () =>
    connection.getAccountInfo(configPda)
  );
  if (configInfo) {
    console.log("\n[2] Config already initialized — skipping initialize");
  } else {
    const poolVaultAta = getAssociatedTokenAddressSync(
      usdcMint,
      poolVaultPda,
      true, // owner is a PDA
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    try {
      const sig = await withRetry("initialize", () =>
        program.methods
          .initialize(payer.publicKey, ANNUAL_INTEREST_BPS)
          .accounts({
            admin: payer.publicKey,
            config: configPda,
            poolVault: poolVaultPda,
            usdcMint,
            poolVaultTokenAccount: poolVaultAta,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .rpc()
      );
      sigs.initialize = sig;
      console.log("\n[2] initialize:", sig, "->", explorerTx(sig));
    } catch (err) {
      // Another run may have initialized meanwhile — treat as done if so.
      const again = await withRetry("config re-lookup", () =>
        connection.getAccountInfo(configPda)
      );
      if (!again) throw err;
      console.log("\n[2] Config appeared concurrently — continuing");
    }
  }

  const poolVaultAta = getAssociatedTokenAddressSync(
    usdcMint,
    poolVaultPda,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  // -- 3. set_price ----------------------------------------------------------
  const config = await withRetry("fetch config", () =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (program.account as any).config.fetch(configPda)
  );
  if (new BN(config.pricePerTon.toString()).eq(PRICE_PER_TON)) {
    console.log("\n[3] price_per_ton already 380 USDC — skipping set_price");
  } else {
    const sig = await withRetry("set_price", () =>
      program.methods
        .setPrice(PRICE_PER_TON)
        .accounts({ admin: payer.publicKey, config: configPda })
        .rpc()
    );
    sigs.setPrice = sig;
    console.log("\n[3] set_price:", sig, "->", explorerTx(sig));
  }

  // -- 4. Mint USDC + deposit_liquidity until the pool reaches 500k ----------
  const payerUsdcAta = (
    await withRetry("payer ATA", () =>
      getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        usdcMint!,
        payer.publicKey,
        false,
        COMMITMENT,
        { commitment: COMMITMENT },
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    )
  ).address;

  for (let round = 0; round < 5; round++) {
    const poolAcc = await withRetry("pool balance", () =>
      getAccount(connection, poolVaultAta, COMMITMENT, TOKEN_PROGRAM_ID)
    );
    const shortfall = POOL_TARGET_USDC.sub(new BN(poolAcc.amount.toString()));
    if (shortfall.lte(new BN(0))) {
      console.log(
        `\n[4] Pool already holds ${poolAcc.amount.toString()} uUSDC — nothing to deposit`
      );
      break;
    }
    console.log(
      `\n[4] Pool shortfall ${shortfall.toString()} uUSDC — minting + depositing`
    );
    await withRetry("mintTo", () =>
      mintTo(
        connection,
        payer,
        usdcMint!,
        payerUsdcAta,
        payer, // mint authority
        BigInt(shortfall.toString()),
        [],
        { commitment: COMMITMENT },
        TOKEN_PROGRAM_ID
      )
    );
    const sig = await withRetry("deposit_liquidity", () =>
      program.methods
        .depositLiquidity(shortfall)
        .accounts({
          depositor: payer.publicKey,
          usdcMint: usdcMint!,
          config: configPda,
          depositorTokenAccount: payerUsdcAta,
          poolVault: poolVaultPda,
          poolVaultTokenAccount: poolVaultAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc()
    );
    sigs.depositLiquidity = sig;
    console.log("    deposit_liquidity:", sig, "->", explorerTx(sig));
  }

  // -- 5. register_warrant ---------------------------------------------------
  const warrantInfo = await withRetry("warrant lookup", () =>
    connection.getAccountInfo(warrantPda)
  );
  if (warrantInfo) {
    console.log("\n[5] Warrant already registered — skipping register_warrant");
  } else {
    const producerAta = getAssociatedTokenAddressSync(
      warrantMintPda,
      payer.publicKey, // producer = payer
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    const sig = await withRetry("register_warrant", () =>
      program.methods
        .registerWarrant(SILO_ID, GRAIN_SOYBEAN, WARRANT_TONS, payer.publicKey)
        .accounts({
          certifier: payer.publicKey,
          config: configPda,
          producer: payer.publicKey,
          warrant: warrantPda,
          mintAuthority: mintAuthorityPda,
          mint: warrantMintPda,
          producerTokenAccount: producerAta,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc()
    );
    sigs.registerWarrant = sig;
    console.log("\n[5] register_warrant:", sig, "->", explorerTx(sig));
    console.log(
      "    producer received",
      WARRANT_TONS.toString(),
      "warrant tokens at",
      producerAta.toBase58()
    );
  }

  // -- 6. Env files ----------------------------------------------------------
  const envOut =
    `# Zafra devnet — generated by scripts/setup-devnet.ts (gitignored)\n` +
    `PROGRAM_ID=${programId.toBase58()}\n` +
    `USDC_MINT=${usdcMint.toBase58()}\n` +
    `RPC_URL=${RPC_URL}\n`;
  fs.writeFileSync(ENV_PATH, envOut);

  const appEnvOut =
    `# Zafra frontend — generated by scripts/setup-devnet.ts (gitignored)\n` +
    `NEXT_PUBLIC_PROGRAM_ID=${programId.toBase58()}\n` +
    `NEXT_PUBLIC_USDC_MINT=${usdcMint.toBase58()}\n` +
    `NEXT_PUBLIC_RPC_URL=${RPC_URL}\n`;
  fs.mkdirSync(path.dirname(APP_ENV_PATH), { recursive: true });
  fs.writeFileSync(APP_ENV_PATH, appEnvOut);
  console.log("\n[6] Wrote .env and app/.env.local");

  // -- 7. Read-back ----------------------------------------------------------
  console.log("\n== Read-back ==");
  const cfg = await withRetry("fetch config", () =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (program.account as any).config.fetch(configPda)
  );
  console.log("Config PDA        :", configPda.toBase58());
  console.log("  admin           :", cfg.admin.toBase58());
  console.log("  certifier       :", cfg.certifier.toBase58());
  console.log("  usdc_mint       :", cfg.usdcMint.toBase58());
  console.log(
    "  price_per_ton   :",
    cfg.pricePerTon.toString(),
    `(${Number(cfg.pricePerTon.toString()) / 1e6} USDC/ton)`
  );
  console.log("  ltv_bps         :", cfg.ltvBps);
  console.log("  liq_threshold   :", cfg.liqThresholdBps);
  console.log("  fee_bps         :", cfg.feeBps);
  console.log("  annual_int_bps  :", cfg.annualInterestBps);

  const pool = await withRetry("pool balance", () =>
    getAccount(connection, poolVaultAta, COMMITMENT, TOKEN_PROGRAM_ID)
  );
  console.log("Pool vault PDA    :", poolVaultPda.toBase58());
  console.log("Pool vault ATA    :", poolVaultAta.toBase58());
  console.log(
    "Pool balance      :",
    pool.amount.toString(),
    `(${Number(pool.amount) / 1e6} USDC)`
  );

  const warrant = await withRetry("fetch warrant", () =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (program.account as any).warrant.fetch(warrantPda)
  );
  console.log("Warrant PDA       :", warrantPda.toBase58());
  console.log("  silo_id         :", warrant.siloId);
  console.log("  grain           :", warrant.grain, "| tons:", warrant.tons.toString());
  console.log("  mint            :", warrant.mint.toBase58());
  console.log("  status          :", warrant.status, "| owner:", warrant.owner.toBase58());

  console.log("\n== Transaction signatures ==");
  for (const [k, v] of Object.entries(sigs)) console.log(`  ${k}: ${v}`);
  console.log("\nDone. Devnet demo state is ready.");
}

main().catch((err) => {
  console.error("\nsetup-devnet failed:", err);
  process.exit(1);
});
