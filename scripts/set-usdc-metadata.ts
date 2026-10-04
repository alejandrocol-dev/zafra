/**
 * set-usdc-metadata.ts — attach Metaplex Token Metadata to the devnet test-USDC
 * mint so wallets (Phantom, Solflare, explorer) show "Test USDC" / "tUSDC"
 * instead of an unknown token.
 *
 * Uses createMetadataAccountV3 from mpl-token-metadata (legacy web3.js SDK).
 * The metadata PDA is derived as ["metadata", TOKEN_METADATA_PROGRAM_ID, mint].
 *
 *   1. Loads the CLI keypair (~/.config/solana/id.json) in memory — never written
 *      or printed.
 *   2. Reads USDC_MINT from .env (written by setup-devnet.ts).
 *   3. If the metadata account does not exist → createMetadataAccountV3
 *      (name "Test USDC", symbol "tUSDC", uri "", sellerFeeBasisPoints 0,
 *      isMutable true, payer = updateAuthority = mint authority).
 *   4. If it exists but differs → updateMetadataAccountV2.
 *   5. Reads the account back and prints name/symbol.
 *
 * Run:  npx tsx scripts/set-usdc-metadata.ts   (from repo root, inside WSL)
 * Idempotent: re-running is a no-op when the metadata is already correct.
 */

import {
  Metadata,
  PROGRAM_ID as TOKEN_METADATA_PROGRAM_ID,
  createCreateMetadataAccountV3Instruction,
  createUpdateMetadataAccountV2Instruction,
} from "@metaplex-foundation/mpl-token-metadata";
import { DataV2 } from "@metaplex-foundation/mpl-token-metadata";
import {
  Commitment,
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REPO_ROOT = path.resolve(__dirname, "..");
const ENV_PATH = path.join(REPO_ROOT, ".env");
const KEYPAIR_PATH = path.join(os.homedir(), ".config", "solana", "id.json");

const RPC_URL = "https://api.devnet.solana.com";
const COMMITMENT: Commitment = "confirmed";

const TOKEN_NAME = "Test USDC";
const TOKEN_SYMBOL = "tUSDC";
const TOKEN_URI = "";

const explorerTx = (sig: string) =>
  `https://explorer.solana.com/tx/${sig}?cluster=devnet`;

// ---------------------------------------------------------------------------
// Small helpers (same conventions as setup-devnet.ts)
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

function metadataPda(mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("metadata"), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    TOKEN_METADATA_PROGRAM_ID
  )[0];
}

/** On-chain strings are zero-padded — strip trailing NULs for comparison/print. */
const stripNul = (s: string) => s.replace(/\0+$/g, "");

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const payer = loadPayer();
  const connection = new Connection(RPC_URL, {
    commitment: COMMITMENT,
    confirmTransactionInitialTimeout: 90_000,
  });

  const env = readEnvFile(ENV_PATH);
  if (!env.USDC_MINT) {
    throw new Error("USDC_MINT not found in .env — run setup-devnet.ts first");
  }
  const mint = new PublicKey(env.USDC_MINT);
  const metadata = metadataPda(mint);

  console.log("== Zafra: set test-USDC metadata (devnet) ==");
  console.log("mint     :", mint.toBase58());
  console.log("metadata :", metadata.toBase58());
  console.log("payer    :", payer.publicKey.toBase58());
  console.log(
    "balance  :",
    (
      (await withRetry("balance", () =>
        connection.getBalance(payer.publicKey)
      )) / 1e9
    ).toFixed(4),
    "SOL"
  );

  const data: DataV2 = {
    name: TOKEN_NAME,
    symbol: TOKEN_SYMBOL,
    uri: TOKEN_URI,
    sellerFeeBasisPoints: 0,
    creators: null,
    collection: null,
    uses: null,
  };

  let sig: string | null = null;
  const existing = await withRetry("metadata lookup", () =>
    connection.getAccountInfo(metadata)
  );

  if (!existing) {
    // -- createMetadataAccountV3 -------------------------------------------
    const ix = createCreateMetadataAccountV3Instruction(
      {
        metadata,
        mint,
        mintAuthority: payer.publicKey,
        payer: payer.publicKey,
        updateAuthority: payer.publicKey,
      },
      {
        createMetadataAccountArgsV3: {
          data,
          isMutable: true,
          collectionDetails: null,
        },
      }
    );
    sig = await withRetry("createMetadataAccountV3", () =>
      sendAndConfirmTransaction(
        connection,
        new Transaction().add(ix),
        [payer],
        { commitment: COMMITMENT }
      )
    );
    console.log("\ncreateMetadataAccountV3:", sig);
    console.log("  ->", explorerTx(sig));
  } else {
    // -- already exists: no-op if correct, else updateMetadataAccountV2 -----
    const current = Metadata.fromAccountInfo(existing)[0];
    const cur = current.data;
    const alreadyCorrect =
      stripNul(cur.name) === TOKEN_NAME &&
      stripNul(cur.symbol) === TOKEN_SYMBOL &&
      stripNul(cur.uri) === TOKEN_URI &&
      cur.sellerFeeBasisPoints === 0;

    if (alreadyCorrect) {
      console.log(
        "\nMetadata account already exists with the desired values — nothing to do."
      );
    } else {
      console.log(
        `\nMetadata exists but differs (name="${stripNul(cur.name)}", ` +
          `symbol="${stripNul(cur.symbol)}") — updating…`
      );
      const ix = createUpdateMetadataAccountV2Instruction(
        {
          metadata,
          updateAuthority: payer.publicKey,
        },
        {
          updateMetadataAccountArgsV2: {
            data,
            updateAuthority: null,
            primarySaleHappened: null,
            isMutable: true,
          },
        }
      );
      sig = await withRetry("updateMetadataAccountV2", () =>
        sendAndConfirmTransaction(
          connection,
          new Transaction().add(ix),
          [payer],
          { commitment: COMMITMENT }
        )
      );
      console.log("updateMetadataAccountV2:", sig);
      console.log("  ->", explorerTx(sig));
    }
  }

  // -- Read-back -------------------------------------------------------------
  const decoded = await withRetry("metadata read-back", () =>
    Metadata.fromAccountAddress(connection, metadata, COMMITMENT)
  );
  console.log("\n== Read-back ==");
  console.log("  name    :", stripNul(decoded.data.name));
  console.log("  symbol  :", stripNul(decoded.data.symbol));
  console.log("  uri     :", JSON.stringify(stripNul(decoded.data.uri)));
  console.log("  mutable :", decoded.isMutable);
  console.log("  mint    :", decoded.mint.toBase58());
  console.log("  updAuth :", decoded.updateAuthority.toBase58());
  if (sig) console.log("\nTx signature:", sig);
  console.log("\nDone. Wallets should now show 'Test USDC' (tUSDC) on devnet.");
}

main().catch((err) => {
  console.error("\nset-usdc-metadata failed:", err);
  process.exit(1);
});
