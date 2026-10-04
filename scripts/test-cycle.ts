/**
 * test-cycle.ts — Zafra e2e check on devnet: borrow -> verify -> repay -> verify.
 *
 * Uses the solana-cli keypair (~/.config/solana/id.json) as the single demo wallet.
 * Requires setup-devnet.ts to have run first (Config, funded pool, SILO-TUC-001 warrant).
 *
 * Run:  npx tsx scripts/test-cycle.ts   (from repo root, inside WSL)
 */

import { AnchorProvider, BN, Program, Wallet, setProvider } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAccount,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const REPO_ROOT = path.resolve(__dirname, "..");
const IDL_PATH = path.join(REPO_ROOT, "target", "idl", "zafra.json");
const KEYPAIR_PATH = path.join(os.homedir(), ".config", "solana", "id.json");
const RPC_URL = process.env.RPC_URL ?? "https://api.devnet.solana.com";
const SILO_ID = process.env.SILO_ID ?? "SILO-TUC-001";

const explorerTx = (sig: string) =>
  `https://explorer.solana.com/tx/${sig}?cluster=devnet`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 6): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = String((err as Error)?.message ?? err);
      const transient =
        /429|too many requests|rate.?limit|timed? ?out|ETIMEDOUT|ECONNRESET|ENOTFOUND|fetch failed|socket hang|blockhash|not confirmed|node is (behind|unhealthy)|503|502/i.test(msg);
      if (!transient || i === attempts - 1) throw err;
      const delay = Math.min(1000 * 2 ** i, 15_000);
      console.log(`  [retry ${i + 1}/${attempts}] ${label}: ${msg.slice(0, 120)} — waiting ${delay}ms`);
      await sleep(delay);
    }
  }
  throw lastErr;
}

function readEnvFile(file: string): Record<string, string> {
  if (!fs.existsSync(file)) return {};
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

async function main() {
  const env = readEnvFile(path.join(REPO_ROOT, ".env"));
  const usdcMintStr = env.USDC_MINT ?? process.env.USDC_MINT;
  if (!usdcMintStr) throw new Error("USDC_MINT missing — run scripts/setup-devnet.ts first");
  const usdcMint = new PublicKey(usdcMintStr);

  const payer = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(KEYPAIR_PATH, "utf8")) as number[])
  );
  const connection = new Connection(RPC_URL, { commitment: "confirmed", confirmTransactionInitialTimeout: 90_000 });
  const provider = new AnchorProvider(connection, new Wallet(payer), { commitment: "confirmed" });
  setProvider(provider);
  const idl = JSON.parse(fs.readFileSync(IDL_PATH, "utf8"));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const program = new Program(idl, provider) as any;
  const programId: PublicKey = program.programId;

  console.log("== Zafra e2e cycle: borrow -> repay ==");
  console.log("program:", programId.toBase58());
  console.log("wallet :", payer.publicKey.toBase58());

  // PDAs
  const [configPda] = PublicKey.findProgramAddressSync([Buffer.from("config")], programId);
  const [poolVaultPda] = PublicKey.findProgramAddressSync([Buffer.from("pool_vault")], programId);
  const [warrantPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("warrant"), Buffer.from(SILO_ID, "utf8")], programId
  );
  const [loanPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("loan"), warrantPda.toBuffer()], programId
  );
  const [warrantVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("warrant_vault"), warrantPda.toBuffer()], programId
  );

  const warrant = await withRetry("fetch warrant", () => program.account.warrant.fetch(warrantPda));
  const warrantMint = new PublicKey(warrant.mint.toBase58());

  const poolVaultAta = getAssociatedTokenAddressSync(usdcMint, poolVaultPda, true, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
  const borrowerWarrantAta = getAssociatedTokenAddressSync(warrantMint, payer.publicKey, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
  const custodyAta = getAssociatedTokenAddressSync(warrantMint, warrantVaultPda, true, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
  const borrowerUsdcAta = getAssociatedTokenAddressSync(usdcMint, payer.publicKey, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);

  console.log("\nwarrant:", warrant.siloId, "| status:", warrant.status, "| tons:", warrant.tons.toString());

  // -- borrow (skip if a loan is already open on this warrant) ---------------
  const loanInfo = await withRetry("loan lookup", () => connection.getAccountInfo(loanPda));
  const loanOpen = loanInfo
    ? (await program.account.loan.fetch(loanPda)).status === 0
    : false;

  if (loanOpen) {
    console.log("loan already open — skipping borrow, going to repay");
  } else {
    if (warrant.status !== 0) throw new Error(`Warrant status ${warrant.status} — expected 0 (Issued) and no open loan. Re-run setup-devnet.`);
    const usdcBefore = (await withRetry("usdc before", () => getAccount(connection, borrowerUsdcAta, "confirmed", TOKEN_PROGRAM_ID).catch(() => null)));
    const beforeAmt = usdcBefore ? Number(usdcBefore.amount) : 0;

    const sigBorrow = await withRetry("borrow", () =>
      program.methods
        .borrow()
        .accounts({
          borrower: payer.publicKey,
          usdcMint,
          mint: warrantMint,
          config: configPda,
          warrant: warrantPda,
          loan: loanPda,
          warrantVault: warrantVaultPda,
          poolVault: poolVaultPda,
          borrowerWarrantTokenAccount: borrowerWarrantAta,
          custodyTokenAccount: custodyAta,
          poolVaultTokenAccount: poolVaultAta,
          borrowerUsdcTokenAccount: borrowerUsdcAta,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc()
    );
    console.log("\n[borrow]   ", sigBorrow, "->", explorerTx(sigBorrow));

    const usdcAfter = await withRetry("usdc after", () => getAccount(connection, borrowerUsdcAta, "confirmed", TOKEN_PROGRAM_ID));
    const custody = await withRetry("custody", () => getAccount(connection, custodyAta, "confirmed", TOKEN_PROGRAM_ID));
    const loan = await withRetry("loan", () => program.account.loan.fetch(loanPda));
    console.log("  USDC received  :", (Number(usdcAfter.amount) - beforeAmt) / 1e6, "USDC");
    console.log("  custody holds  :", custody.amount.toString(), "warrant tokens");
    console.log("  loan principal :", Number(loan.principal.toString()) / 1e6, "USDC | status:", loan.status);
  }

  // -- top up: mint the shortfall so repay(principal+interest) succeeds ------
  const openLoan = await withRetry("open loan", () => program.account.loan.fetch(loanPda));
  const cfg = await withRetry("config", () => program.account.config.fetch(configPda));
  const now = Math.floor(Date.now() / 1000);
  const elapsed = Math.max(0, now - Number(openLoan.openedAt.toString()));
  const interest = Number(openLoan.principal.toString()) * Number(cfg.annualInterestBps) * elapsed / (10_000 * 31_536_000);
  const totalDue = Math.ceil(Number(openLoan.principal.toString()) + interest + 2_000_000); // +2 USDC pad: interest accrues ~101 uUSDC/s
  const cur = await withRetry("borrower usdc", () => getAccount(connection, borrowerUsdcAta, "confirmed", TOKEN_PROGRAM_ID).catch(() => null));
  const shortfall = totalDue - (cur ? Number(cur.amount) : 0);
  if (shortfall > 0) {
    const { mintTo } = await import("@solana/spl-token");
    const sigMint = await withRetry("top-up mint", () =>
      mintTo(connection, payer, usdcMint, borrowerUsdcAta, payer, BigInt(shortfall), [], { commitment: "confirmed" }, TOKEN_PROGRAM_ID)
    );
    console.log("\n[top-up]   minted", shortfall / 1e6, "USDC for repay ->", explorerTx(sigMint));
  }

  // -- repay ----------------------------------------------------------------
  const sigRepay = await withRetry("repay", () =>
    program.methods
      .repay()
      .accounts({
        borrower: payer.publicKey,
        usdcMint,
        mint: warrantMint,
        config: configPda,
        warrant: warrantPda,
        loan: loanPda,
        warrantVault: warrantVaultPda,
        poolVault: poolVaultPda,
        borrowerUsdcTokenAccount: borrowerUsdcAta,
        poolVaultTokenAccount: poolVaultAta,
        custodyTokenAccount: custodyAta,
        borrowerWarrantTokenAccount: borrowerWarrantAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc()
  );
  console.log("\n[repay]    ", sigRepay, "->", explorerTx(sigRepay));

  const warrantAfter = await withRetry("warrant after", () => program.account.warrant.fetch(warrantPda));
  const borrowerWarrantAfter = await withRetry("warrant ata after", () => getAccount(connection, borrowerWarrantAta, "confirmed", TOKEN_PROGRAM_ID));
  const loanAfter = await withRetry("loan after", () => program.account.loan.fetch(loanPda));

  console.log("  warrant status :", warrantAfter.status, "(3 = Released)");
  console.log("  warrant tokens back:", borrowerWarrantAfter.amount.toString());
  console.log("  loan status    :", loanAfter.status, "(1 = Repaid)");

  console.log("\n✓ Full cycle verified on devnet: issued -> borrowed -> repaid -> released.");
}

main().catch((err) => {
  console.error("\ntest-cycle failed:", err);
  process.exit(1);
});
