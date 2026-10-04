import { AgroError, ZafraError } from "./zafra";
import type { MessageKey } from "./i18n/messages";

export interface FriendlyError {
  titleKey: MessageKey;
  bodyKey: MessageKey;
  /** Raw message for the collapsible "Technical details". */
  technical: string;
  /** True when the user simply cancelled in the wallet (not a failure). */
  cancelled: boolean;
}

const PROGRAM_CODES: Record<number, AgroError> = {
  6000: AgroError.NotAdmin,
  6001: AgroError.NotCertifier,
  6002: AgroError.NotOwner,
  6003: AgroError.WarrantNotIssued,
  6004: AgroError.LoanExists,
  6005: AgroError.LoanNotOpen,
  6006: AgroError.InsufficientLiquidity,
  6007: AgroError.LtvExceeded,
  6008: AgroError.HealthyLoan,
  6009: AgroError.MathOverflow,
  6010: AgroError.NothingToRepay,
  6011: AgroError.PriceNotSet,
};

function rawMessage(err: unknown): string {
  if (err instanceof Error) {
    const logs = (err as { logs?: string[] }).logs;
    return [err.message, ...(logs ?? [])].join("\n");
  }
  return String(err);
}

function programError(variant: AgroError): FriendlyError {
  return {
    titleKey: "err.simulation.title",
    bodyKey: `err.${variant}` as MessageKey,
    technical: variant,
    cancelled: false,
  };
}

/** Turn anything thrown by wallet / RPC / program into translatable keys. */
export function translateError(err: unknown): FriendlyError {
  if (err instanceof ZafraError) return programError(err.code);

  const technical = rawMessage(err);
  const lower = technical.toLowerCase();
  const make = (titleKey: MessageKey, bodyKey: MessageKey, cancelled = false) => ({
    titleKey,
    bodyKey,
    technical,
    cancelled,
  });

  if (/user rejected|rejected the request|user denied|declined|cancelled|canceled/.test(lower))
    return make("err.rejected.title", "err.rejected.body", true);
  if (/wallet not connected|no wallet connected|walletnotconnected/.test(lower))
    return make("err.noWallet.title", "err.noWallet.body");

  const code = /custom program error: (?:0x([0-9a-f]+)|(\d+))/i.exec(technical);
  if (code) {
    const n = code[1] ? parseInt(code[1], 16) : Number(code[2]);
    if (PROGRAM_CODES[n]) return programError(PROGRAM_CODES[n]);
  }
  const named = /Error Code: (\w+)/.exec(technical);
  if (named && named[1] in AgroError) return programError(named[1] as AgroError);

  if (/already in use|custom program error: 0x0\b/.test(lower))
    return make("err.siloExists.title", "err.siloExists.body");
  if (/attempt to debit an account but found no record|insufficient lamports|prior credit/.test(lower))
    return make("err.noSol.title", "err.noSol.body");
  if (/insufficient funds|insufficient balance|custom program error: 0x1\b|0x1$/.test(lower))
    return make("err.noFunds.title", "err.noFunds.body");
  if (/429|too many requests|rate limit|failed to fetch|timed out|timeout|blockhash not found|503|502/.test(lower))
    return make("err.rpc.title", "err.rpc.body");
  if (/simulation failed|reverted|transaction simulation/.test(lower))
    return make("err.simulation.title", "err.simulation.body");

  return make("err.unknown.title", "err.unknown.body");
}
