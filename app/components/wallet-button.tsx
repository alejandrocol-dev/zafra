"use client";

import { useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { ChevronDown, LogOut, Wallet } from "lucide-react";
import { shortenAddress } from "@/lib/format";
import { useI18n, useT } from "@/lib/i18n";
import { Button, CopyButton } from "@/components/ui";

/**
 * Localized wallet button (the stock WalletMultiButton can't be translated).
 * Disconnected: opens the wallet-adapter modal. Connected: address + menu.
 */
export function WalletButton({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const t = useT();
  const { locale } = useI18n();
  const { connected, connecting, publicKey, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  if (!connected || !publicKey) {
    return (
      <Button size={size} loading={connecting} onClick={() => setVisible(true)}>
        <Wallet className="size-4" aria-hidden />
        {t("common.connectWallet")}
      </Button>
    );
  }

  const address = publicKey.toBase58();
  return (
    <div ref={ref} className="relative">
      <Button variant="secondary" size={size} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="size-2 rounded-full bg-brand" aria-hidden />
        <span className="font-mono text-xs">{shortenAddress(address)}</span>
        <ChevronDown className="size-4 text-mute" aria-hidden />
      </Button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-56 rounded-xl border border-line-strong bg-elevated p-2 shadow-xl">
          <p className="px-2 pb-2 pt-1 text-xs text-faint">
            {locale === "es" ? "Wallet conectada · devnet" : "Connected wallet · devnet"}
          </p>
          <div className="px-2 pb-2">
            <CopyButton value={address} label={locale === "es" ? "Copiar dirección" : "Copy address"} />
          </div>
          <button
            onClick={() => {
              setOpen(false);
              void disconnect();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-mute hover:bg-white/10 hover:text-ink"
          >
            <LogOut className="size-4" aria-hidden />
            {locale === "es" ? "Desconectar" : "Disconnect"}
          </button>
        </div>
      )}
    </div>
  );
}
