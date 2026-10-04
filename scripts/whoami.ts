import { Connection, PublicKey } from "@solana/web3.js";

async function main() {
  const conn = new Connection("https://api.devnet.solana.com", "confirmed");
  const addr = process.argv[2];
  const pk = new PublicKey(addr);
  const info = await conn.getAccountInfo(pk);
  console.log(addr, "->", info ? { owner: info.owner.toBase58(), lamports: info.lamports, dataLen: info.data.length } : "NOT FOUND");

  // Also derive the usual suspects for SILO-AR-0042 to compare
  const pid = new PublicKey("AERC53ZiqizgjYdJK9hCeGtSk6PfzwnEn2z3wkMKiqiJ");
  const [w] = PublicKey.findProgramAddressSync([Buffer.from("warrant"), Buffer.from("SILO-AR-0042")], pid);
  const [l] = PublicKey.findProgramAddressSync([Buffer.from("loan"), w.toBuffer()], pid);
  const [wv] = PublicKey.findProgramAddressSync([Buffer.from("warrant_vault"), w.toBuffer()], pid);
  const { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } = await import("@solana/spl-token");
  const warrantMint = "X2fz" + ""; // unknown, will read from warrant
  console.log("warrantPda:", w.toBase58());
  console.log("loanPda   :", l.toBase58());
  console.log("warrantVaultPda:", wv.toBase58());
  const wAcc = await conn.getAccountInfo(w);
  if (wAcc) {
    // mint is at offset: 8 disc + 32 owner + 32 certifier + 4 len + silo bytes + 1 grain + 8 tons = depends; just print data len
    console.log("warrant data len:", wAcc.data.length);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
