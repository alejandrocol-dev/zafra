<p align="center">
  <img src="app/app/icon.svg" width="88" alt="Zafra" />
</p>

<h1 align="center">Zafra</h1>

<p align="center"><b>Liquidez abierta para warrants de granos en Argentina.</b><br/>
El productor deja su warrant de garantía y recibe un préstamo en dólares digitales en segundos, sin vender la cosecha.</p>

<p align="center">
  <code>Solana devnet</code> · <code>Anchor</code> · <code>Next.js</code> · <code>USDC de prueba</code>
</p>

> **Estado:** corre solo en **devnet** (la red de prueba de Solana, con plata que no vale nada). La certificadora y el oráculo de precio están simulados. El código no está auditado.

---

## El problema: valor inmóvil en el silo

El grano cosechado y almacenado es un activo real pero ilíquido. Un productor puede tener cien toneladas de soja en un silobolsa, unos cuarenta mil dólares de mercadería, y no disponer de capital de trabajo para la campaña siguiente. Semillas, combustible y obligaciones financieras se pagan en calendario de siembra, no de venta.

Argentina cuenta con un instrumento legal sobre ese activo: el **warrant**, un título de crédito que representa mercadería depositada (Ley 9.643). En la práctica su uso como garantía queda limitado al circuito bancario y de ALyCs: operaciones bilaterales, documentación manual y plazos de aprobación que no se alinean con los tiempos de la campaña.

**Zafra convierte el warrant en garantía programable.** El documento se tokeniza on-chain a razón de un token por tonelada, el productor lo deposita como colateral en el programa y un pool abierto de liquidez en USDC le origina el préstamo. Al repagar, el colateral se libera. Si el precio del grano perfora el umbral de liquidación, la posición se liquida automáticamente.

> Por eso existe Zafra: porque la zafra no espera.

---

## Por qué importa

### Para el productor
- **Capital sin vender la cosecha.** Puede esperar un mejor precio sin quedarse sin plata para trabajar.
- **En segundos, no en semanas.** El préstamo se acredita apenas se firma la transacción.
- **Sin depender de una ventanilla.** Cualquier fondo puede prestarle, no solo su banco.
- **Reglas claras desde el principio.** Antes de firmar ve cuánto recibe, cuánto debe y a qué precio del grano se liquidaría su garantía.

### Para quien presta
- **Una garantía real detrás:** grano guardado y certificado.
- **Cobra el interés y la comisión** de cada préstamo.
- **Todo es público y auditable:** cada préstamo, pago y liquidación es una transacción que cualquiera puede revisar.

### Por qué en una blockchain y no en una planilla
- **La garantía es programable:** se bloquea sola, se libera sola cuando el préstamo se paga y la liquidación la ejecuta el código, no un juzgado.
- **En Solana cada operación tarda segundos y cuesta centavos**, que es lo que hace viable prestarle a un productor chico.
- **No hay un intermediario que custodie la garantía:** la tiene el programa, con reglas que no cambian según quién pida.

---

## El mercado y el momento: Argentina

**El instrumento existe y tiene respaldo legal.** El warrant está regulado por la **Ley 9.643**, actualizada por el **DNU 70/2023**. Esa actualización habilitó documentos electrónicos, división de lotes y la figura del productor como depositario.

**El mercado está creciendo.** En 2025 se emitieron warrants por **US$2.079 millones, un 93% más que el año anterior** (Secretaría de Agricultura, vía Bichos de Campo).

**La digitalización ya empezó:**
- **A3 Mercados** lanzó su plataforma de warrants digitales; la primera operación fue con Grassi SA y Banco Galicia.
- **Matba Rofex** lanzó su propia plataforma y tokenizó una silobolsa como garantía de futuros, junto con Origino.
- La **Bolsa de Comercio del Chaco** estructuró el **primer pagaré bursátil respaldado por un warrant digital** en el MAV, con Control Union como warrantera, y lo presentó como un modelo replicable en el norte del país.

**Del otro lado, la plata existe:**
- El **74,3% de los inversores argentinos tiene cripto**, más que en EE.UU. o el Reino Unido (Nexo, *Future of Digital Wealth* 2026).
- Las stablecoins son el **72% de las operaciones cripto locales** (EY).
- Pero esa tenencia casi no se integra a inversiones reales. Hay dólares digitales sin un destino productivo, y el campo necesita financiamiento.

### Dónde se para Zafra
**Zafra no digitaliza warrants**: eso ya lo hacen A3 y Matba Rofex. **Zafra es la capa de crédito que va encima.** Toma el warrant digital y lo vuelve prestable contra capital abierto, no solo contra el de un banco.

| | Qué hace | Diferencia con Zafra |
|---|---|---|
| A3 Mercados / Matba Rofex | Emiten y registran el warrant digital | Son la emisión. Zafra podría ser su capa de liquidez |
| Bancos y ALyCs | Prestan contra warrant, de forma bilateral | Zafra usa un fondo abierto y reglas públicas |
| Agrotoken, Nera, SiloReal, Origino | Tokenizan grano o silobolsas, o los monitorean | Otro instrumento. Zafra trabaja sobre el warrant legal |

---

## Qué hace hoy (funcionando en devnet)

El ciclo completo corre en la cadena y es verificable en el explorador:

1. **Emitir:** la certificadora registra un warrant (Silo ID, grano, toneladas) y se mintean los tokens al productor (1 token = 1 t).
2. **Fondear:** cualquiera aporta USDC al fondo de liquidez.
3. **Pedir:** el productor bloquea el warrant en una bóveda del programa y recibe hasta el **70%** del valor, menos una comisión de **0,75%**.
4. **Devolver:** paga principal más interés simple, que corre por segundo, y recupera sus tokens.
5. **Liquidar:** si el precio cae y la deuda supera el **80%** del valor de la garantía, cualquiera puede liquidar la posición y el fondo se queda con el warrant.

**Ejemplo:** 100 t de soja a 380 USDC/t equivalen a 38.000 USDC de garantía. Con eso se pueden pedir 26.600 USDC y se reciben unos 26.400 netos. Si la soja cae un 30%, la posición se vuelve liquidable.

### La app
- **Bilingüe**, en español e inglés.
- **Pantalla de revisión antes de cada firma**, que muestra qué das, qué recibís, la comisión y el precio de liquidación.
- **Riesgo explicado en lenguaje claro**, con cuatro niveles: Sano, Atención, En riesgo y Liquidable. También muestra cuánto puede caer el precio antes de la liquidación.
- **Avisos antes de que falle algo:** saldo insuficiente para devolver, Silo ID repetido, errores traducidos.
- **Herramientas de demo**, marcadas como simuladas: Certificadora (emitir warrants) y Administrador (mover el precio del grano y liquidar).

### Qué está simulado
| Real (en devnet) | Simulado |
|---|---|
| El programa, las cuentas, las firmas y el registro público | La certificadora (en producción, una warrantera habilitada) |
| La bóveda de garantía y la liquidación automática | El oráculo de precio (en producción, un feed de mercado) |
| Los tokens del warrant y el fondo de liquidez | El USDC, que es de prueba. El fondo lo pone el equipo |

---

## Lo que viene

1. **Validar con el sector:** conversaciones con productores, acopios y warranteras.
2. **Certificación real:** integrar una warrantera habilitada que firme la emisión, siguiendo el camino del precedente del Chaco.
3. **Precio real:** reemplazar el oráculo simulado por un feed de precios de granos.
4. **Sobre los rieles existentes:** conectarse a la emisión de warrants digitales de A3 y Matba Rofex como su capa de liquidez abierta.
5. **Retiros y rendimiento para quien presta:** hoy, en el MVP, lo aportado no se puede retirar.
6. **Más documentos del agro:** el mismo modelo para otros títulos negociables, como cartas de porte o cheques de pago diferido.
7. **Auditoría y marco regulatorio** antes de cualquier uso con dinero real.

---

## Una nota honesta sobre el estado

Zafra llegó a esta entrega más ajustado de lo que me hubiera gustado. Entre el tiempo de la hackathon y una conexión de internet poco confiable, no todo el pulido llegó a hacerse. La app funciona y hace lo que promete, pero el diseño todavía tiene margen: quiero transiciones más cuidadas, una mejor jerarquía visual en mobile y estados más ricos en cada pantalla.

El logo del choclo tampoco es el definitivo: se hizo con lo que el tiempo permitió y está en la lista de cosas a iterar.

Elegí deliberadamente presentar el sistema completo funcionando de verdad: emitir, prestar, devolver y liquidar, todo en devnet, antes que una interfaz perfecta sobre datos falsos. Lo próximo es cerrar esa brecha.

---

## Cómo está hecho

| Capa | Tecnología |
|---|---|
| Programa on-chain | Anchor 1.1.2 + SPL Token (clásico), un solo programa `zafra` |
| Tests | Rust + LiteSVM (`cargo test`), 16 tests de las instrucciones y sus casos negativos |
| Frontend | Next.js 16 + TypeScript + Tailwind + Solana Wallet Adapter (Phantom) |
| Scripts | TypeScript (setup de devnet, ciclo completo, inspección) |

**Instrucciones del programa:** `initialize`, `set_price`, `register_warrant`, `deposit_liquidity`, `borrow`, `repay`, `liquidate`.

**Program ID (devnet):** [`AERC53ZiqizgjYdJK9hCeGtSk6PfzwnEn2z3wkMKiqiJ`](https://explorer.solana.com/address/AERC53ZiqizgjYdJK9hCeGtSk6PfzwnEn2z3wkMKiqiJ?cluster=devnet)
**USDC de prueba:** `12KPRGKraqyydu8favsGtMGqqm23YUEwgc3TVHGwjuef`

```
programs/zafra/   Programa Anchor (src/, tests/)
app/              Frontend Next.js
scripts/          Scripts de devnet (TS)
docs/SPEC.md      Contrato técnico (manda sobre el código)
docs/DESIGN.md    Brief de diseño de la interfaz
```

### Correrlo

```bash
# Programa
anchor build
cargo test
anchor deploy --provider.cluster devnet

# Frontend (http://localhost:3000)
cd app
npm install
NEXT_PUBLIC_USE_REAL=true npm run dev
```

- **Modos del frontend:**
  - Con `NEXT_PUBLIC_USE_REAL=true` lee y escribe en devnet.
  - Sin esa variable usa datos simulados en memoria.
- **RPC:** se puede cambiar con `NEXT_PUBLIC_RPC_URL`. Por defecto usa `https://api.devnet.solana.com`.
- **Wallet:** para usarla hace falta Phantom en modo devnet.

---

## Reglas del proyecto

- Solo devnet. Nunca mainnet ni fondos reales.
- No hay claves ni secretos en el repo.
- Toda transacción necesita la firma explícita del usuario.

## Uso de IA

Hecho con Devin como asistente de programación. La idea, el diseño del producto, las especificaciones y la revisión son del autor; el código generado se revisó antes de cada commit.
