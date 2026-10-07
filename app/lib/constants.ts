/** Shared app constants. */

/** Deployed program id — falls back to the known devnet deployment. */
export const PROGRAM_ID =
  process.env.NEXT_PUBLIC_PROGRAM_ID ?? "AERC53ZiqizgjYdJK9hCeGtSk6PfzwnEn2z3wkMKiqiJ";

/** Minimum SOL a wallet needs to cover network fees before sending a tx. */
export const MIN_SOL_FOR_FEES = 0.003;
