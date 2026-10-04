# Zafra — Frontend

Next.js 16 (App Router) + TypeScript + Tailwind v4 + Solana wallet adapter.
**Devnet only.** See `../docs/SPEC.md` for the product contract.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm run lint       # eslint
```

Optional: copy `.env.example` → `.env.local` to override the devnet RPC
(defaults to `https://api.devnet.solana.com`).

## Structure

- `lib/zafra.ts` — typed data layer (`ZafraClient` interface) matching
  the SPEC accounts/instructions. Currently a **mock** with in-memory state,
  artificial latency and fake tx signatures; swap the singleton export for the
  real IDL-generated client without touching the views.
- `lib/format.ts` — display helpers (USDC, bps, health factor, explorer links).
- `lib/use-tx.ts` — pending/signature/error wrapper around instruction calls.
- `components/views/` — one screen per role: Certifier, Producer, Investor,
  Admin (selected via tabs on the home page).
- `components/app-providers.tsx` — `ConnectionProvider` (devnet fixed) +
  `WalletProvider` (Phantom) + modal.

## Demo flow

1. **Certifier**: issue a warrant (silo id, grain, tons, producer wallet).
2. **Producer**: see "My warrants" — borrow on Issued ones, track collateral
   value / debt / health factor, repay.
3. **Investor**: deposit USDC, watch pool liquidity and utilization.
4. **Admin**: set the oracle price or "Simulate price drop −30%", then
   liquidate loans whose health factor drops below 1.00.

Every action returns a mock signature rendered as a Solana Explorer devnet link.
