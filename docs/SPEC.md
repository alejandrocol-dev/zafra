# SPEC — Zafra (contrato técnico)

> **Este archivo es el contrato entre los subagentes.** El programa y el frontend se construyen contra esto, no uno contra el otro. Si algo cambia, cambia acá primero.

## Programa Anchor `zafra` (un solo programa)

### Cuentas

| Cuenta | Tipo | Campos |
|---|---|---|
| `Config` | PDA seeds `["config"]` | `admin`, `certifier`, `usdc_mint`, `price_per_ton` (u64, USDC 6 decimales), `ltv_bps` (u16, def 7000), `liq_threshold_bps` (u16, def 8000), `fee_bps` (u16, def 75), `annual_interest_bps` (u16, configurable, **supuesto**), `bump` |
| `Warrant` | PDA seeds `["warrant", silo_id]` | `owner` (productor), `certifier`, `silo_id` (string/u64), `grain` (u8: 0=soja), `tons` (u64), `mint` (SPL), `status` (0=Issued, 1=InCustody, 2=Liquidated, 3=Released), `bump` |
| `Loan` | PDA seeds `["loan", warrant]` | `borrower`, `warrant`, `principal` (u64), `opened_at` (i64), `status` (0=Open, 1=Repaid, 2=Liquidated), `bump` |
| Pool USDC | Token account del PDA `["pool_vault"]` | custodia la liquidez |
| Warrant custody | Token account del PDA `["warrant_vault", warrant]` | custodia el colateral |

El warrant es un **mint SPL clásico** (0 decimales, supply = toneladas) con autoridad PDA `["mint_authority", warrant]`. **No usar Token-2022 en el MVP.**

### Instrucciones

| Instrucción | Quién | Qué hace |
|---|---|---|
| `initialize` | admin | Crea `Config` y el pool vault. |
| `set_price(price)` | solo admin | Actualiza `price_per_ton`. |
| `deposit_liquidity(amount)` | cualquiera | Transfiere USDC propio al pool. |
| `register_warrant(silo_id, grain, tons, productor)` | solo `certifier` | Crea `Warrant`, mint SPL y mintea `tons` al productor. |
| `borrow(warrant)` | dueño del warrant | Verifica status Issued y propiedad; mueve los tokens del warrant a custodia del PDA; `max = tons × price × ltv_bps / 10000`; transfiere `max - fee` de USDC al prestatario (fee al pool); crea `Loan`. |
| `repay(warrant)` | prestatario | `total = principal + principal × annual_interest_bps × elapsed_years / 10000` (interés simple por timestamp); transfiere USDC al pool; devuelve el warrant; cierra `Loan` (Repaid), `Warrant` → Released. |
| `liquidate(warrant)` | cualquiera | `health = valor × liq_threshold_bps / (deuda × 10000)` donde `valor = tons × price`; si `health < 1`: el pool se queda el warrant custodiado, `Loan` → Liquidated, `Warrant` → Liquidated. |
| `withdraw_liquidity` | EXTRA, fuera del MVP | — |

### Matemática

- Todo en **enteros** (u64/u128 para productos), sin floats.
- `value = tons × price_per_ton`.
- `max_loan = value × ltv_bps / 10000`.
- `health = value × liq_threshold_bps / (debt × 10000)`; liquidar si `health < 1`.
- USDC de prueba con 6 decimales; warrant con 0 decimales (1 token = 1 tonelada).

### Errores (enum `AgroError`)

`NotAdmin`, `NotCertifier`, `NotOwner`, `WarrantNotIssued`, `LoanExists`, `LoanNotOpen`, `InsufficientLiquidity`, `LtvExceeded`, `HealthyLoan`, `MathOverflow`, `NothingToRepay`.

## Tests — Rust con LiteSVM (`cargo test`)

> Anchor 1.1.2 genera la plantilla moderna: tests en `programs/zafra/tests/*.rs` con `litesvm`, que cargan el `.so` compilado y corren en proceso (rápido, sin validador). Se corre con `cargo test` desde la raíz del repo. Opcional extra: tests TS contra devnet real más adelante.

Feliz: initialize → set_price → deposit → register → borrow → repay.
Negativos: LTV excedido; no-certifier registra; no-admin cambia precio; doble borrow sobre el mismo warrant; borrow de quien no es owner; liquidate sobre préstamo sano; liquidate tras caída de precio (pasa); pool sin liquidez suficiente.

## Frontend (`app/`, Next.js + TS + Tailwind + wallet adapter)

- Cluster **devnet fijo**, Phantom. UI en **inglés**. Banner persistente: `Devnet · simulated certifier and oracle · not audited`.
- 4 vistas/roles (mismo layout, selector simple):
  - **Certifier:** formulario (silo, grano, toneladas, wallet del productor) → `register_warrant`.
  - **Producer:** mis warrants; sobre uno Issued → `borrow`; sobre la posición → factor de salud, deuda, `repay`.
  - **Investor:** depositar USDC de prueba al pool; ver liquidez y (si está) rendimiento.
  - **Admin:** set price (con botón "Simulate price drop −30%") y `liquidate` sobre posiciones abiertas.
- Cada transacción muestra su link al explorador (devnet).
- Datos: primero capa **simulada detrás de una interfaz tipada** (`lib/zafra.ts`), después se reemplaza por el cliente real generado desde el IDL.

## Scripts (`scripts/`)

- `setup-devnet.ts`: crea el mint de USDC de prueba, mintea a las wallets de demo, fondea el pool, registra un warrant de ejemplo. Claves **fuera del repo** (env vars, nunca commiteadas).
- `keygen-demo.sh` (WSL): genera 3 keypairs de devnet fuera del repo y los fondea vía faucet.

## Convenciones

- Rust: `anchor` estándar, `thiserror`-style errors, comentarios solo donde la regla de negocio no es obvia. Sin unsafe.
- TS: ESLint de Next.js, sin `any` en el cliente del programa.
- Commits: chicos, a nombre de alejandrocol-dev, sin atribución a IA.
- **Regla dura:** nada de mainnet, nada de claves en archivos, toda firma de transacción con aprobación humana.
