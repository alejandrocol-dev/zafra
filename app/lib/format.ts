/** Small display helpers shared by the views. Locale-aware number/date
    formatting lives in `useFmt` (lib/i18n), not here. */

export function shortenAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 1) return address;
  return `${address.slice(0, chars)}…${address.slice(-chars)}`;
}

export function shortenSignature(sig: string): string {
  return `${sig.slice(0, 8)}…${sig.slice(-8)}`;
}

export function explorerTxUrl(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

export function explorerAddressUrl(address: string): string {
  return `https://explorer.solana.com/address/${address}?cluster=devnet`;
}
