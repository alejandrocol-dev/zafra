import { Connection, Keypair } from "@solana/web3.js";
import { AnchorProvider, Program, Wallet, setProvider } from "@coral-xyz/anchor";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

async function main() {
  const IDL = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../target/idl/zafra.json"), "utf8"));
  const conn = new Connection("https://api.devnet.solana.com", "confirmed");
  const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(path.join(os.homedir(), ".config/solana/id.json"), "utf8"))));
  setProvider(new AnchorProvider(conn, new Wallet(kp), { commitment: "confirmed" }));
  const program = new Program(IDL) as any;

  const warrants = await program.account.warrant.all();
  console.log(`warrants on chain: ${warrants.length}`);
  for (const w of warrants) {
    console.log(`- pda=${w.publicKey.toBase58()} silo_id=${JSON.stringify(w.account.siloId)} tons=${w.account.tons.toString()} status=${w.account.status} owner=${w.account.owner.toBase58()}`);
  }
  const loans = await program.account.loan.all();
  console.log(`loans on chain: ${loans.length}`);
  for (const l of loans) {
    console.log(`- pda=${l.publicKey.toBase58()} warrant=${l.account.warrant.toBase58()} principal=${l.account.principal.toString()} status=${l.account.status}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
