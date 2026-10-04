/** Small display helpers shared by the views. */

export function formatUsdc(n: number): string {
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} USDC`;
}

export function formatTons(n: number): string {
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 0 })} t`;
}

/** Basis points → percentage string, e.g. 7000 → "70%". */
export function formatBps(bps: number): string {
  const pct = bps / 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(2)}%`;
}

export function formatHealth(hf: number): string {
  return Number.isFinite(hf) ? hf.toFixed(2) : "—";
}

export function shortenAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 1) return address;
  return `${address.slice(0, chars)}…${address.slice(-chars)}`;
}

export function shortenSignature(sig: string): string {
  return `${sig.slice(0, 8)}…${sig.slice(-8)}`;
}

export function formatDate(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function explorerTxUrl(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

export function explorerAddressUrl(address: string): string {
  return `https://explorer.solana.com/address/${address}?cluster=devnet`;
}
