import {
  accruedDebt,
  collateralValue,
  healthFactor,
  type Config,
  type Loan,
  type Warrant,
} from "./zafra";

/**
 * Risk is expressed as the PRICE BUFFER: how far the grain price can fall
 * before liquidation (health factor = 1). It is easier to read than the raw
 * health factor and — unlike hf thresholds — is meaningful for this protocol,
 * where a fresh max-LTV loan already starts at hf ≈ 1.14 (buffer 12.5%).
 */
export type RiskTier = "safe" | "watch" | "risk" | "liquidatable";

/** 1 - 1/hf. Negative when the position is already liquidatable. */
export function priceBuffer(hf: number): number {
  if (!Number.isFinite(hf)) return 1;
  if (hf <= 0) return -1;
  return 1 - 1 / hf;
}

export function riskTier(hf: number): RiskTier {
  const buffer = priceBuffer(hf);
  if (buffer < 0) return "liquidatable";
  if (buffer < 0.05) return "risk";
  if (buffer < 0.1) return "watch";
  return "safe";
}

/**
 * Grain price (USDC / ton) at which health factor reaches 1 for the current
 * debt: tons × P × liq / 10000 = debt  →  P = debt × 10000 / (tons × liq).
 */
export function liquidationPrice(
  warrant: Warrant,
  loan: Loan,
  config: Config,
  nowSec?: number,
): number {
  const debt = accruedDebt(loan, config, nowSec);
  return (debt * 10_000) / (warrant.tons * config.liqThresholdBps);
}

export interface PositionRisk {
  debt: number;
  value: number;
  hf: number;
  tier: RiskTier;
  buffer: number;
  liqPrice: number;
}

export function positionRisk(
  warrant: Warrant,
  loan: Loan,
  config: Config,
  nowSec?: number,
): PositionRisk {
  const hf = healthFactor(warrant, loan, config, nowSec);
  return {
    debt: accruedDebt(loan, config, nowSec),
    value: collateralValue(warrant, config),
    hf,
    tier: riskTier(hf),
    buffer: priceBuffer(hf),
    liqPrice: liquidationPrice(warrant, loan, config, nowSec),
  };
}

/** Estimated debt after `days` more days (simple interest) from today's debt basis. */
export function projectedDebt(
  loanPrincipal: number,
  annualInterestBps: number,
  days: number,
): number {
  return loanPrincipal * (1 + (annualInterestBps * (days / 365.25)) / 10_000);
}
