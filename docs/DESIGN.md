# DESIGN — Zafra UI/UX brief

Goal: make the demo look and feel like a mainstream fintech/DeFi product (think Kamino / Aave / Morpho / a neobank), not a developer dashboard. Judges and first-time users must understand in 10 seconds: **who it's for, what they get, what it costs, and what can go wrong.** All UI copy ships in **English and Spanish (es-AR, voseo)** with a language switch.

Research basis (web3ux.design "Loans, Health, TVL" and "Transaction flows", Sailor Lend case study, Legasi/Pencil/Autonom submissions): risk first, plain language, one button per action, explicit step/state feedback, human error messages, a live "try it in N steps" path for judges.

Non-negotiables
- Devnet only. Never imply real money. Persistent, friendly notice: "Demo on Solana devnet — test funds, no real money" (ES: "Demo en Solana devnet — fondos de prueba, sin dinero real").
- Keep the data layer contract: `lib/zafra.ts` (`ZafraClient`) and `lib/zafra-real.ts`. Additive helpers are OK; do not break existing signatures. Never fall back to mock data when `NEXT_PUBLIC_USE_REAL=true`.
- Do not touch `programs/`, `scripts/`, `docs/SPEC.md`.
- `npm run build`, `npm run lint` and `npx tsc --noEmit` must pass.

## 1. Information architecture

Top nav (sticky): logo wordmark **Zafra** · "Overview" · "Borrow" (Producer) · "Earn" (Investor) · "Demo tools" dropdown (Certifier, Admin — labelled *Simulated by Zafra team*) · language switch (EN | ES) · wallet button.

Naming (EN → ES):
- Warrant → *Warrant (certificado de depósito)*, first mention explains it; afterwards "warrant"
- Collateral → *Garantía*
- Borrow → *Pedir préstamo* · Repay → *Devolver préstamo*
- Liquidity pool → *Fondo de liquidez* · Supply/Deposit → *Aportar*
- APR → *Tasa anual (TNA)* · Origination fee → *Comisión de otorgamiento*
- Health / Risk → *Salud del préstamo* / *Riesgo*
- Liquidation → *Liquidación (se ejecuta la garantía)*
- Certifier → *Certificadora (simulada)* · Oracle price → *Precio de referencia (simulado)*

## 2. Overview (landing section of `/`)
- Hero: EN "Cash today against the grain you already stored." / ES "Cobrá hoy contra la cosecha que ya tenés guardada." Sub: one sentence on warrants + open USDC liquidity. CTAs: "Try the demo" (opens guided demo) and "How it works".
- Live on-chain KPI row (read from devnet): pool liquidity, outstanding loans, tons tokenized, max LTV. Badge "Live on devnet".
- "How it works" in 4 steps with icons: 1 Certified warrant → 2 Lock as collateral → 3 Receive USDC → 4 Repay and recover your grain.
- **Guided demo panel** (collapsible, bottom-right on desktop, top card on mobile): checklist "Try it in 4 steps" — Issue a warrant · Borrow · Simulate a price drop · Liquidate (or Repay). Steps tick automatically when the wallet has completed them on-chain. Each step has a "Go" button that jumps to the right screen.
- Footer: disclaimer "Hackathon prototype on Solana devnet. Not audited. Certifier and price oracle are simulated. Not financial advice." + links (GitHub, program on Solana Explorer devnet, Superteam/Colosseum).

## 3. Visual system
- Dark theme, refined: bg `#0b0f0e`, surface `#111715`, elevated `#161e1b`, border `rgba(255,255,255,.08)`, text `#e8efec`, muted `#8fa39b`. Accent emerald (`emerald-500`), warning amber, danger rose, info sky. Define as CSS variables + Tailwind tokens in `globals.css`; no ad-hoc hex in components.
- Typography: Inter via `next/font`; tabular numbers (`font-variant-numeric: tabular-nums`) for all amounts.
- Radius 12–16px, soft 1px borders, subtle shadow on elevated cards, 8px spacing grid, max content width ~1120px, fully responsive down to 360px.
- Icons: `lucide-react`. Toasts: `sonner`. Dialog: `@radix-ui/react-dialog` (or an accessible equivalent). Tooltips for jargon (APR, LTV, liquidation). Pick versions published >7 days ago; no other new deps without need.
- Motion: 150–200ms fades/slides, skeleton loaders (never bare "Loading…"), respect `prefers-reduced-motion`.
- Accessible: focus rings, aria labels, contrast AA, keyboard-closable dialogs.

## 4. Risk display (borrowers)
- Four tiers with color + icon + word (never color alone): **Safe** (green), **Watch** (amber), **At risk** (orange/red), **Liquidatable** (red). Map from health factor: ≥1.5 Safe, 1.2–1.5 Watch, 1.0–1.2 At risk, <1 Liquidatable.
- Always show: collateral value, debt (accruing), **liquidation price** (USDC/ton at which health = 1), and **price buffer** ("price can fall 12% before liquidation"). Health factor number is secondary, in a tooltip/detail row.
- Proactive banner on positions in "At risk"/"Liquidatable": what is happening, what to do (Repay now) with a button.

## 5. Transaction UX (the most important part)
Every on-chain action uses the same pattern:
1. **Review dialog** (before the wallet): plain-language summary table — what you give, what you get, fees, rates, what changes. Warnings in context. Primary button names the action ("Borrow 26,400 USDC"). Disabled for ~0.6s after open; requires a checkbox for risky actions (borrow: "I understand my warrant can be liquidated if the price falls below X").
2. **Progress states** inside the same dialog: *Waiting for your wallet…* → *Confirming on Solana…* → *Done* (with explorer link, copy-signature, next-step suggestion) or *Failed* (human message + "Try again"). Show the step count when more than one wallet prompt is possible.
3. **Pre-flight checks** before opening the wallet: wallet connected, enough SOL for fees, enough USDC (repay/deposit), valid inputs, duplicate Silo ID. Show fixes inline ("You need 13,312.45 USDC to repay. You have 13,000.00 — get test USDC").
4. **Error translation**: map wallet rejections ("You cancelled the request — nothing was charged"), simulation reverts, `insufficient funds`, account-already-in-use (duplicate Silo ID), program error codes 6000–6011 (`NotAdmin`, `NotCertifier`, `NotOwner`, `WarrantNotIssued`, `LoanExists`, `LoanNotOpen`, `InsufficientLiquidity`, `LtvExceeded`, `HealthyLoan`, `MathOverflow`, `NothingToRepay`, `PriceNotSet`), RPC rate limits. Raw error text goes in a collapsible "Technical details".
5. After success: toast + refresh affected data + suggested next action.

Repay specifics: interest accrues per second, so the exact amount at signing time is slightly higher than the preview. Show "≈" and a small safety buffer note; do not let the user start repay if balance < estimate.

## 6. Screens
- **Borrow (Producer)**: wallet-connect empty state with explanation; list of warrants as cards with a 3-step progress (Warrant issued → Borrowed → Repaid). Borrow dialog shows: grain/tons, collateral value, LTV 70%, fee, **you receive**, APR (labelled *demo assumption*), estimated repayment in 30/90 days, liquidation price.
- **Earn (Investor)**: pool stats (liquidity, utilization, APR assumption flagged as demo), deposit form with max button + wallet balance, review dialog; explanation of where yield comes from and the risk.
- **Certifier (demo tool)**: banner "This role is simulated: in production a licensed warehouse/warrant issuer signs this." Silo ID with automatic next-free suggestion and live duplicate check; review dialog before signing.
- **Admin (demo tool)**: banner "Simulated price oracle". Price card + "Simulate price drop −30%" and "Reset to 380", slider optional; table of open loans with risk tier, liquidation price and Liquidate button enabled only when liquidatable; explanation text of what a liquidation does.
- Empty states for every list; clear "connect wallet" state; never show internal words like "mock", "seeded demo producer".

## 7. i18n
- Lightweight, no routing change: React context + typed dictionaries, `useT()` hook returning `t(key, params)`; `<LocaleSwitch />` in the header; default from `navigator.language` (`es*` → ES, else EN); persisted in `localStorage`; `<html lang>` updated.
- Dictionaries split by namespace so parallel work doesn't conflict: `lib/i18n/messages/{common,overview,producer,investor,certifier,admin}.ts`, each exporting `{ en: {...}, es: {...} }`; `lib/i18n/index.ts` merges them. Keys are namespaced (`producer.borrow.title`). Missing ES key falls back to EN in dev with a console warning.
- Numbers/dates via `Intl` with the active locale (es-AR / en-US). USDC amounts: 2 decimals; tons: integer.
- Program/identifier names (Silo ID, token symbols, addresses) are never translated.

## 8. Ownership for parallel work
- Phase 1 (single agent): design tokens, `components/ui/*` primitives, `ConfirmDialog` + `TxFlow`, error translation (`lib/errors.ts`), `RiskBadge`/`PositionGauge`, `Skeleton`, toasts, i18n infrastructure + empty namespace files, header/footer/layout, Overview + Guided demo, page shell with routing between screens.
- Phase 2 (four agents, one file each + its own namespace file): `components/views/producer-view.tsx` + `messages/producer.ts`; `investor-view.tsx` + `messages/investor.ts`; `certifier-view.tsx` + `messages/certifier.ts`; `admin-view.tsx` + `messages/admin.ts`. They must not edit shared primitives; if one is missing, they report it instead.
