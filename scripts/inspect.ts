import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { getAccount, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { AnchorProvider, Program, Wallet, setProvider } from "@coral-xyz/anchor";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

async function main() {
  const REPO_ROOT = path.resolve(__dirname, "..");
  const IDL = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "target/idl/zafra.json"), "utf8"));
  const conn = new Connection("https://api.devnet.solana.com", "confirmed");
  const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(path.join(os.homedir(), ".config/solana/id.json"), "utf8"))));
  const provider = new AnchorProvider(conn, new Wallet(kp), { commitment: "confirmed" });
  setProvider(provider);
  const program = new Program(IDL, provider) as any;
  const pid: PublicKey = program.programId;

  const usdcMint = new PublicKey("12KPRGKraqyydu8favsGtMGqqm23YUEwgc3TVHGwjuef");
  const [warrantPda] = PublicKey.findProgramAddressSync([Buffer.from("warrant"), Buffer.from("SILO-TUC-001")], pid);
  const [loanPda] = PublicKey.findProgramAddressSync([Buffer.from("loan"), warrantPda.toBuffer()], pid);
  const [configPda] = PublicKey.findProgramAddressSync([Buffer.from("config")], pid);

  const ata = getAssociatedTokenAddressSync(usdcMint, kp.publicKey);
  const acc = await getAccount(conn, ata);
  console.log("borrower USDC balance:", Number(acc.amount), "uUSDC =", Number(acc.amount) / 1e6);

  const loan = await program.account.loan.fetch(loanPda);
  const cfg = await program.account.config.fetch(configPda);
  console.log("loan principal:", loan.principal.toString(), "| opened_at:", loan.openedAt.toString(), "| status:", loan.status);
  console.log("annual_interest_bps:", cfg.annualInterestBps);

  const slot = await conn.getSlot();
  const bt = await conn.getBlockTime(slot);
  const wall = Math.floor(Date.now() / 1000);
  console.log("chain blockTime:", bt, "| wall now:", wall, "| wall-chain:", wall - bt!);

  const elapsedChain = Math.max(0, bt! - Number(loan.openedAt.toString()));
  const interest = Math.floor(Number(loan.principal.toString()) * cfg.annualInterestBps * elapsedChain / (10_000 * 31_536_000));
  console.log("elapsed(chain):", elapsedChain, "s | interest:", interest, "uUSDC | total due:", Number(loan.principal.toString()) + interest, "uUSDC =", (Number(loan.principal.toString()) + interest) / 1e6);
}

main().catch((e) => { console.error(e); process.exit(1); });
