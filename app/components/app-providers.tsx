"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import {
  ConnectionProvider,
  useAnchorWallet,
  useConnection,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { clusterApiUrl } from "@solana/web3.js";

import { setZafraRuntime } from "@/lib/zafra";

import "@solana/wallet-adapter-react-ui/styles.css";

/** Devnet is fixed for the whole app — no mainnet code paths anywhere. */
const NETWORK = WalletAdapterNetwork.Devnet;
// setup-devnet.ts writes NEXT_PUBLIC_RPC_URL into .env.local; keep the older
// name as a fallback so either env file works.
const ENDPOINT =
  process.env.NEXT_PUBLIC_RPC_URL ??
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
  clusterApiUrl(NETWORK);

export function AppProviders({ children }: { children: ReactNode }) {
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={ENDPOINT}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <ZafraRuntimeBridge />
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

/**
 * Publishes the connected wallet + devnet connection to the zafra client
 * router (lib/zafra.ts). Only consumed when NEXT_PUBLIC_USE_REAL=true —
 * with the mock active this is a harmless no-op.
 */
function ZafraRuntimeBridge() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  useEffect(() => {
    setZafraRuntime(wallet ? { connection, wallet } : null);
    return () => setZafraRuntime(null);
  }, [connection, wallet]);

  return null;
}
