/**
 * Read-only devnet smoke check for the real Zafra client.
 *
 *   npm run verify:devnet        (npx tsx scripts/verify-devnet.ts)
 *
 * Reads Config → pool stats → the keypair's warrants. No transactions are
 * built or signed; the keypair is only used to build a NodeWallet provider.
 *
 * Env vars (nothing secret is ever committed):
 *   KEYPAIR_PATH       — keypair JSON, default ~/.config/solana/id.json
 *   ZAFRA_RPC_URL  — RPC endpoint, default public devnet
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Wallet as NodeWallet } from "@coral-xyz/anchor";
import { clusterApiUrl, Connection, Keypair } from "@solana/web3.js";

import { PROGRAM_ID, RealZafraClient } from "../lib/zafra-real";

async function main() {
  const rpcUrl =
    process.env.ZAFRA_RPC_URL ??
    process.env.SOLANA_RPC_URL ??
    clusterApiUrl("devnet");
  const keypairPath =
    process.env.KEYPAIR_PATH ?? join(homedir(), ".config", "solana", "id.json");

  const secret = JSON.parse(readFileSync(keypairPath, "utf8")) as number[];
  const payer = Keypair.fromSecretKey(Uint8Array.from(secret));

  const client = new RealZafraClient(
    new Connection(rpcUrl, "confirmed"),
    new NodeWallet(payer),
  );

  console.log(`Zafra devnet verify`);
  console.log(`  program : ${PROGRAM_ID.toBase58()}`);
  console.log(`  rpc     : ${rpcUrl}`);
  console.log(`  keypair : ${payer.publicKey.toBase58()} (${keypairPath})`);
  console.log();

  const config = await client.getConfig();
  console.log(`Config`);
  console.log(`  admin                : ${config.admin}`);
  console.log(`  certifier            : ${config.certifier}`);
  console.log(`  usdc_mint            : ${config.usdcMint}`);
  console.log(`  price_per_ton        : ${config.pricePerTon} USDC`);
  console.log(`  ltv_bps              : ${config.ltvBps}`);
  console.log(`  liq_threshold_bps    : ${config.liqThresholdBps}`);
  console.log(`  fee_bps              : ${config.feeBps}`);
  console.log(`  annual_interest_bps  : ${config.annualInterestBps}`);
  console.log();

  const pool = await client.getPoolStats();
  console.log(`Pool`);
  console.log(`  total_liquidity      : ${pool.totalLiquidity.toFixed(2)} USDC`);
  console.log(`  outstanding_debt     : ${pool.outstandingDebt.toFixed(2)} USDC`);
  console.log(`  available            : ${pool.available.toFixed(2)} USDC`);
  console.log(`  utilization_bps      : ${pool.utilizationBps}`);
  console.log();

  const positions = await client.getMyWarrants(payer.publicKey.toBase58());
  console.log(
    `Warrants owned by ${payer.publicKey.toBase58()}: ${positions.length}`,
  );
  for (const { warrant, loan } of positions) {
    console.log(
      `  - ${warrant.siloId} (${warrant.tons}t, status ${warrant.status}) ` +
        `mint ${warrant.mint}` +
        (loan ? ` loan ${loan.address} status ${loan.status}` : ""),
    );
  }
  console.log();
  console.log("verify-devnet: OK");
}

main().catch((err) => {
  console.error("verify-devnet: FAILED");
  console.error(err instanceof Error ? `  ${err.message}` : `  ${String(err)}`);
  process.exit(1);
});
