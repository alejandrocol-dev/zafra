import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { getAccount, getAssociatedTokenAddressSync } from "@solana/spl-token";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

async function main() {
  const conn = new Connection("https://api.devnet.solana.com", "confirmed");
  const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(path.join(os.homedir(), ".config/solana/id.json"), "utf8"))));

  console.log("address (devnet):", kp.publicKey.toBase58());
  console.log("SOL balance:", (await conn.getBalance(kp.publicKey)) / 1e9);

  const usdcMint = new PublicKey("12KPRGKraqyydu8favsGtMGqqm23YUEwgc3TVHGwjuef");
  const usdcAta = getAssociatedTokenAddressSync(usdcMint, kp.publicKey);
  try {
    const u = await getAccount(conn, usdcAta);
    console.log("test USDC:", Number(u.amount) / 1e6);
  } catch { console.log("test USDC: (no token account)"); }

  const warrantMint = new PublicKey("DbJyGeTuHJysuM69Kj23oBJStivY8F7Pm73kFa4mGLzY");
  const wAta = getAssociatedTokenAddressSync(warrantMint, kp.publicKey);
  try {
    const w = await getAccount(conn, wAta);
    console.log("warrant tokens (SILO-TUC-001):", w.amount.toString());
  } catch { console.log("warrant tokens: (no token account)"); }
}

main().catch((e) => { console.error(e); process.exit(1); });
