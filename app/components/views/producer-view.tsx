  "use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Coins, FileCheck2, Wallet } from "lucide-react";
import {
  accruedDebt,
  zafra,
  collateralValue,
  maxBorrowAmount,
  originationFee,
  LoanStatus,
  WarrantStatus,
  type Config,
  type Loan,
  type PoolStats,
  type Warrant,
} from "@/lib/zafra";
import { useNowSec } from "@/lib/data-bus";
import { useFmt, useT } from "@/lib/i18n";
import { useView } from "@/lib/nav";
import { positionRisk, projectedDebt } from "@/lib/risk";
import { useAsyncData } from "@/lib/use-async";
import { PositionGauge, RiskBanner } from "@/components/risk";
import { TxDialog } from "@/components/tx-dialog";
import { WalletButton } from "@/components/wallet-button";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Skeleton,
  Stat,
  Steps,
  type Tone,
  type StepState,
} from "@/components/ui";

const MIN_SOL_FOR_FEES = 0.003;

export function ProducerView() {
  const t = useT();
  const f = useFmt();
  const { publicKey } = useWallet();
  const [, setView] = useView();
  const owner = publicKey?.toBase58() ?? null;

  const { data, loading, error, reload } = useAsyncData(async () => {
    if (!owner) return null;
    const [config, positions, stats, balances] = await Promise.all([
      zafra.getConfig(),
      zafra.getMyWarrants(owner),
      zafra.getPoolStats(),
      zafra.getWalletBalances(owner),
    ]);
    return {
      config,
      stats,
      balances,
      positions: positions.filter((p) => p.warrant.owner === owner),
    };
  }, owner);

  return (
    <div>
      <PageHeader title={t("borrow.title")} subtitle={t("borrow.subtitle")} />

      <div data-tour="borrow-main">
      {!owner ? (
        <EmptyState
          icon={<Wallet className="size-6" aria-hidden />}
          title={t("borrow.connect.title")}
          body={t("borrow.connect.body")}
          action={<WalletButton size="lg" />}
        />
      ) : loading && !data ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-64" />
        </div>
      ) : error && !data ? (
        <EmptyState
          title={t("err.rpc.title")}
          body={t("err.rpc.body")}
          action={<Button onClick={reload}>{t("common.retry")}</Button>}
        />
      ) : data && data.positions.length === 0 ? (
        <EmptyState
          icon={<FileCheck2 className="size-6" aria-hidden />}
          title={t("borrow.empty.title")}
          body={t("borrow.empty.body")}
          action={<Button onClick={() => setView("certifier")}>{t("borrow.empty.cta")}</Button>}
        />
      ) : data ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-mute">{t("borrow.balances")}</span>
            <Badge tone="neutral" icon={<Coins className="size-3.5" aria-hidden />}>
              {f.usdc(data.balances.usdc)}
            </Badge>
            <Badge tone={data.balances.sol < MIN_SOL_FOR_FEES ? "danger" : "neutral"}>
              {f.number(data.balances.sol, 3)} SOL
            </Badge>
          </div>
          {data.positions.map(({ warrant, loan }) => (
            <WarrantCard
              key={warrant.address}
              warrant={warrant}
              loan={loan}
              config={data.config}
              stats={data.stats}
              usdcBalance={data.balances.usdc}
              solBalance={data.balances.sol}
            />
          ))}
        </div>
      ) : null}
      </div>
    </div>
  );
}

function statusTone(status: WarrantStatus): Tone {
  switch (status) {
    case WarrantStatus.Issued:
      return "info";
    case WarrantStatus.InCustody:
      return "warn";
    case WarrantStatus.Released:
      return "brand";
    default:
      return "danger";
  }
}

function WarrantCard({
  warrant,
  loan,
  config,
  stats,
  usdcBalance,
  solBalance,
}: {
  warrant: Warrant;
  loan: Loan | null;
  config: Config;
  stats: PoolStats;
  usdcBalance: number;
  solBalance: number;
}) {
  const t = useT();
  const f = useFmt();
  const [borrowOpen, setBorrowOpen] = useState(false);
  const value = collateralValue(warrant, config);
  const max = maxBorrowAmount(warrant, config);
  const fee = originationFee(warrant, config);
  const openLoan = loan && loan.status === LoanStatus.Open ? loan : null;

  const statusKey = {
    [WarrantStatus.Issued]: "status.issued",
    [WarrantStatus.InCustody]: "status.inCustody",
    [WarrantStatus.Liquidated]: "status.liquidated",
    [WarrantStatus.Released]: "status.released",
  } as const;

  const closed =
    warrant.status === WarrantStatus.Released || warrant.status === WarrantStatus.Liquidated;
  const steps: Array<{ label: string; state: StepState }> = [
    { label: t("borrow.step.warrant"), state: "done" },
    {
      label: t("borrow.step.borrowed"),
      state: warrant.status === WarrantStatus.Issued ? "active" : "done",
    },
    {
      label: t("borrow.step.closed"),
      state: closed ? "done" : warrant.status === WarrantStatus.InCustody ? "active" : "todo",
    },
  ];

  return (
    <Card
      title={
        <span className="flex flex-wrap items-center gap-2">
          {warrant.siloId}
          <Badge tone={statusTone(warrant.status)}>{t(statusKey[warrant.status])}</Badge>
        </span>
      }
      subtitle={`${t("status.grain.soybean")} · ${f.tons(warrant.tons)}`}
    >
      <div className="mb-5">
        <Steps steps={steps} />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="grid grid-cols-2 gap-3 self-start">
          <Stat
            label={t("borrow.card.value")}
            value={f.usdc(value)}
            hint={t("borrow.card.valueHint", {
              tons: f.tons(warrant.tons),
              price: t("common.perTon", { price: f.usdc(config.pricePerTon) }),
            })}
          />
          <Stat
            label={t("borrow.card.maxLoan")}
            value={f.usdc(max)}
            hint={t("borrow.card.maxLoanHint", { ltv: f.bps(config.ltvBps) })}
          />
        </div>

        <div className="rounded-xl border border-line bg-sunken p-4">
          {warrant.status === WarrantStatus.Issued && (
            <div className="space-y-3">
              <Button size="lg" className="w-full" onClick={() => setBorrowOpen(true)}>
                {t("borrow.cta", { amount: f.usdc(max) })}
              </Button>
              <p className="text-xs leading-relaxed text-faint">{t("borrow.ctaHint")}</p>
              <TxDialog
                open={borrowOpen}
                onOpenChange={setBorrowOpen}
                title={t("borrow.dialog.title", { amount: f.usdc(max) })}
                description={t("borrow.dialog.desc")}
                rows={borrowRows(t, f, warrant, config, value, max, fee)}
                ack={t("borrow.ack", {
                  price: f.usdc(liqPriceAtOpen(warrant, config, max)),
                })}
                blockers={[
                  ...(config.pricePerTon <= 0 ? [t("borrow.block.price")] : []),
                  ...(stats.available < max
                    ? [
                        t("borrow.block.liquidity", {
                          available: f.usdc(stats.available),
                          amount: f.usdc(max),
                        }),
                      ]
                    : []),
                  ...(solBalance < MIN_SOL_FOR_FEES ? [t("borrow.block.sol")] : []),
                ]}
                confirmLabel={t("borrow.confirm", { amount: f.usdc(max) })}
                successText={t("borrow.success.borrow", { amount: f.usdc(max - fee, false) })}
                action={() => zafra.borrow(warrant.address)}
              />
            </div>
          )}

          {openLoan && (
            <OpenPosition
              warrant={warrant}
              loan={openLoan}
              config={config}
              usdcBalance={usdcBalance}
              solBalance={solBalance}
            />
          )}

          {warrant.status === WarrantStatus.Released && (
            <p className="text-sm text-mute">{t("borrow.closed.released")}</p>
          )}
          {warrant.status === WarrantStatus.Liquidated && (
            <p className="text-sm text-mute">{t("borrow.closed.liquidated")}</p>
          )}
        </div>
      </div>
    </Card>
  );
}

function liqPriceAtOpen(warrant: Warrant, config: Config, loanAmount: number): number {
  return (loanAmount * 10_000) / (warrant.tons * config.liqThresholdBps);
}

function borrowRows(
  t: ReturnType<typeof useT>,
  f: ReturnType<typeof useFmt>,
  warrant: Warrant,
  config: Config,
  value: number,
  max: number,
  fee: number,
) {
  const liq = liqPriceAtOpen(warrant, config, max);
  return [
    {
      label: t("borrow.row.collateral"),
      value: `${f.tons(warrant.tons)} · ${t("status.grain.soybean")}`,
    },
    {
      label: t("borrow.row.collateralValue"),
      value: f.usdc(value),
      hint: t("common.perTon", { price: f.usdc(config.pricePerTon) }),
    },
    { label: t("borrow.row.ltv"), value: f.bps(config.ltvBps) },
    { label: t("borrow.row.loan"), value: f.usdc(max) },
    {
      label: t("borrow.row.fee", { pct: f.bps(config.feeBps) }),
      value: `− ${f.usdc(fee)}`,
    },
    { label: t("borrow.row.receive"), value: f.usdc(max - fee), emphasis: true, tone: "brand" as const },
    { label: t("borrow.row.apr"), value: f.bps(config.annualInterestBps) },
    {
      label: t("borrow.row.repay30"),
      value: f.usdc(projectedDebt(max, config.annualInterestBps, 30)),
    },
    {
      label: t("borrow.row.liqPrice"),
      value: t("common.perTon", { price: f.usdc(liq) }),
      hint: `${t("risk.currentPrice")}: ${t("common.perTon", { price: f.usdc(config.pricePerTon) })}`,
      tone: "warn" as const,
    },
  ];
}

function OpenPosition({
  warrant,
  loan,
  config,
  usdcBalance,
  solBalance,
}: {
  warrant: Warrant;
  loan: Loan;
  config: Config;
  usdcBalance: number;
  solBalance: number;
}) {
  const t = useT();
  const f = useFmt();
  const [repayOpen, setRepayOpen] = useState(false);
  const now = useNowSec();
  const risk = positionRisk(warrant, loan, config, now);
  const interest = risk.debt - loan.principal;
  // Interest keeps accruing between review and signing: ask for ~30 s of margin.
  const need = accruedDebt(loan, config, now + 30);
  const short = Math.max(0, need - usdcBalance);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-mute">{t("borrow.position.debt")}</p>
        <p className="text-3xl font-bold tracking-tight text-ink">{f.usdcExact(risk.debt)}</p>
        <p className="text-xs text-faint">
          {t("borrow.position.debtHint")} · {t("borrow.position.apr", { apr: f.bps(config.annualInterestBps) })}
        </p>
      </div>

      <dl className="grid grid-cols-3 gap-2 text-sm">
        <Mini label={t("borrow.position.principal")} value={f.usdc(loan.principal)} />
        <Mini label={t("borrow.position.interest")} value={f.usdcExact(interest)} />
        <Mini label={t("borrow.position.opened")} value={f.date(loan.openedAt)} />
      </dl>

      <PositionGauge risk={risk} currentPrice={config.pricePerTon} />

      <RiskBanner
        tier={risk.tier}
        action={
          <Button size="sm" variant="danger" onClick={() => setRepayOpen(true)}>
            {t("borrow.repay", { amount: "" }).trim()}
          </Button>
        }
      />

      <Button variant="secondary" size="lg" className="w-full" onClick={() => setRepayOpen(true)}>
        {t("borrow.repay", { amount: f.usdc(risk.debt) })}
      </Button>

      <TxDialog
        open={repayOpen}
        onOpenChange={setRepayOpen}
        title={t("borrow.repay.dialog.title")}
        description={t("borrow.repay.dialog.desc")}
        rows={[
          { label: t("borrow.repay.row.principal"), value: f.usdc(loan.principal) },
          { label: t("borrow.repay.row.interest"), value: f.usdcExact(interest) },
          {
            label: t("borrow.repay.row.pay"),
            value: `≈ ${f.usdcExact(risk.debt)}`,
            emphasis: true,
            hint: t("borrow.repay.note"),
          },
          {
            label: t("borrow.repay.row.get"),
            value: `${f.tons(warrant.tons)} · ${warrant.siloId}`,
            tone: "brand",
          },
          {
            label: t("borrow.repay.row.balance"),
            value: f.usdcExact(usdcBalance),
            tone: short > 0 ? "danger" : undefined,
          },
        ]}
        blockers={[
          ...(short > 0
            ? [
                t("borrow.repay.block.balance", {
                  need: f.usdcExact(need),
                  have: f.usdcExact(usdcBalance),
                  short: f.usdcExact(short),
                }),
              ]
            : []),
          ...(solBalance < MIN_SOL_FOR_FEES ? [t("borrow.block.sol")] : []),
        ]}
        confirmLabel={t("borrow.repay.confirm", { amount: f.usdc(risk.debt) })}
        successText={t("borrow.success.repay")}
        action={() => zafra.repay(warrant.address)}
      />
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-mute">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  );
}
