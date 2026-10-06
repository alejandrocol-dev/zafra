"use client";

import type { ReactNode } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  ArrowRight,
  Banknote,
  CircleCheck,
  FileCheck2,
  Gavel,
  HandCoins,
  Landmark,
  Lock,
  Percent,
  TrendingDown,
  Undo2,
  Wheat,
  type LucideIcon,
} from "lucide-react";
import {
  zafra,
  DEFAULT_PRICE_PER_TON,
  LoanStatus,
  WarrantStatus,
  type Config,
  type PoolStats,
  type Warrant,
} from "@/lib/zafra";
import { useFmt, useT, type MessageKey } from "@/lib/i18n";
import { useView, type View } from "@/lib/nav";
import { useAsyncData } from "@/lib/use-async";
import { positionRisk } from "@/lib/risk";
import { ActivityFeed } from "@/components/activity-feed";
import { BarList, Donut, Legend } from "@/components/charts";
import { RiskSimulator } from "@/components/risk-simulator";
import { ZafraMark } from "@/components/logo";
import { Badge, Card, Notice, ProgressBar, Skeleton, cx } from "@/components/ui";

export function OverviewView() {
  const t = useT();
  const [, setView] = useView();
  const { data, error, loading } = useAsyncData(async () => {
    const [stats, config, warrants] = await Promise.all([
      zafra.getPoolStats(),
      zafra.getConfig(),
      zafra.getAllWarrants(),
    ]);
    return { stats, config, warrants };
  });

  return (
    <div className="space-y-6">
      <DemoHero onGo={setView} />

      {error && !data ? (
        <Notice tone="warn">{t("overview.kpi.error")}</Notice>
      ) : (
        <Kpis loading={loading && !data} stats={data?.stats} config={data?.config} warrants={data?.warrants} />
      )}

      <Card
        title={t("sim.title")}
        subtitle={t("sim.subtitle", { price: DEFAULT_PRICE_PER_TON })}
        actions={<Badge tone="warn">{t("sim.oracleBadge")}</Badge>}
      >
        <RiskSimulator config={data?.config} oraclePrice={data?.config.pricePerTon} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title={t("dash.pool.title")} subtitle={t("dash.pool.subtitle")}>
          {data ? <PoolDonut stats={data.stats} /> : <Skeleton className="h-56" />}
        </Card>
        <Card title={t("dash.warrants.title")} subtitle={t("dash.warrants.subtitle")}>
          {data ? <WarrantBars warrants={data.warrants} /> : <Skeleton className="h-48" />}
        </Card>
        <Card title={t("activity.title")} subtitle={t("activity.subtitle")}>
          <ActivityFeed limit={6} />
        </Card>
      </div>

      <section id="how" className="scroll-mt-24 pt-4">
        <HowItWorks />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={t("overview.why.title")}>
          <ul className="space-y-3 text-sm text-mute">
            {(["overview.why.1", "overview.why.2", "overview.why.3"] as const).map((k) => (
              <li key={k} className="flex gap-2.5">
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-brand-strong" aria-hidden />
                {t(k)}
              </li>
            ))}
          </ul>
        </Card>
        <Notice tone="warn" title={t("overview.honest.title")} className="self-start">
          {t("overview.honest.body")}
        </Notice>
      </div>
    </div>
  );
}

/* --------------------------------- Hero / demo ------------------------------- */

const STEP_STYLE: Array<{ tile: string; icon: LucideIcon; view: View }> = [
  { tile: "bg-tile-lime", icon: FileCheck2, view: "certifier" },
  { tile: "bg-tile-sky", icon: Banknote, view: "borrow" },
  { tile: "bg-tile-amber", icon: TrendingDown, view: "admin" },
  { tile: "bg-tile-lilac", icon: Gavel, view: "borrow" },
];

function DemoHero({ onGo }: { onGo: (v: View) => void }) {
  const t = useT();
  const { publicKey } = useWallet();
  const owner = publicKey?.toBase58() ?? null;

  const { data } = useAsyncData(async () => {
    if (!owner) return null;
    const [positions, config, openLoans] = await Promise.all([
      zafra.getMyWarrants(owner),
      zafra.getConfig(),
      zafra.getOpenLoans(),
    ]);
    const mine = positions.filter((p) => p.warrant.owner === owner);
    const underwater = openLoans.some(
      (o) => positionRisk(o.warrant, o.loan, config).tier === "liquidatable",
    );
    return {
      issued: mine.length > 0,
      borrowed: mine.some((p) => p.loan),
      priceDropped:
        config.pricePerTon < DEFAULT_PRICE_PER_TON ||
        underwater ||
        mine.some((p) => p.warrant.status === WarrantStatus.Liquidated),
      closed: mine.some((p) => p.loan && p.loan.status !== LoanStatus.Open),
    };
  }, owner);

  const done = [!!data?.issued, !!data?.borrowed, !!data?.priceDropped, !!data?.closed];
  const current = done.findIndex((d) => !d);
  const count = done.filter(Boolean).length;

  return (
    <section id="demo" className="relative overflow-hidden rounded-[24px] bg-navy p-6 text-white shadow-(--shadow-float) sm:p-8">
      <div aria-hidden className="av-grid pointer-events-none absolute inset-0 opacity-50" />
      <div aria-hidden className="pointer-events-none absolute -left-20 -top-24 size-72 rounded-full bg-brand/25 blur-3xl" />
      <ZafraMark white className="pointer-events-none absolute -bottom-10 left-[36%] hidden size-52 opacity-[0.06] lg:block" />
      <div className="relative grid gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.6fr)] lg:items-center">
        <div>
          <p className="text-sm font-medium text-white/60">{t("dash.hero.hello")}</p>
          <h1 className="mt-2 text-[28px] font-extrabold leading-[1.15] sm:text-[34px]">{t("dash.hero.title")}</h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-white/70">{t("dash.hero.body")}</p>
          <div className="mt-6 max-w-xs">
            <div className="mb-2 flex items-center justify-between text-xs font-semibold">
              <span className="text-white/70">{t("dash.hero.progress", { done: count })}</span>
              <span className="text-brand">{count * 25}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-brand transition-[width] duration-700" style={{ width: `${count * 25}%` }} />
            </div>
          </div>
          {!publicKey && <p className="mt-4 text-xs text-white/50">{t("demo.needWallet")}</p>}
        </div>

        <ol className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {STEP_STYLE.map((s, i) => {
            const Icon = s.icon;
            const isDone = done[i];
            const isCurrent = i === current;
            const n = (i + 1) as 1 | 2 | 3 | 4;
            return (
              <li
                key={i}
                className={cx(
                  "flex min-h-[188px] flex-col rounded-2xl p-4 text-navy transition-transform",
                  s.tile,
                  isCurrent && "ring-2 ring-brand ring-offset-2 ring-offset-navy xl:-translate-y-1",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-navy/50">0{n}</span>
                  {isDone ? (
                    <CircleCheck className="size-5 text-brand-strong" aria-label={t("demo.done")} />
                  ) : (
                    <Icon className="size-5 text-navy/70" aria-hidden />
                  )}
                </div>
                <p className="mt-4 font-display text-[15px] font-bold leading-snug">{t(`demo.step${n}.title` as MessageKey)}</p>
                <p className="mt-1 line-clamp-3 text-xs leading-snug text-navy/60">{t(`demo.step${n}.body` as MessageKey)}</p>
                <div className="mt-auto pt-3">
                  {isDone ? (
                    <span className="text-xs font-bold text-brand-strong">{t("demo.done")}</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onGo(s.view)}
                      className={cx(
                        "inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors",
                        isCurrent ? "bg-navy text-white hover:bg-navy-soft" : "bg-white/70 text-navy hover:bg-white",
                      )}
                    >
                      {t("demo.go")}
                      <ArrowRight className="size-3.5" aria-hidden />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

/* ------------------------------------ KPIs ----------------------------------- */

function Kpis({
  loading,
  stats,
  config,
  warrants,
}: {
  loading: boolean;
  stats?: PoolStats;
  config?: Config;
  warrants?: Warrant[];
}) {
  const t = useT();
  const f = useFmt();
  if (loading || !stats || !config || !warrants)
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[120px] rounded-2xl" />
        ))}
      </div>
    );
  const tons = warrants.reduce((s, w) => s + w.tons, 0);
  const items: Array<{ icon: LucideIcon; tile: string; label: string; value: string; hint: string }> = [
    { icon: Landmark, tile: "bg-tile-lime text-brand-strong", label: t("overview.kpi.liquidity"), value: f.usdcRound(stats.available), hint: t("overview.kpi.liquidityHint") },
    { icon: HandCoins, tile: "bg-tile-sky text-info", label: t("overview.kpi.debt"), value: f.usdcRound(stats.outstandingDebt), hint: t("overview.kpi.debtHint") },
    { icon: Wheat, tile: "bg-tile-amber text-warn", label: t("overview.kpi.tons"), value: f.tons(tons), hint: t("overview.kpi.tonsHint") },
    { icon: Percent, tile: "bg-tile-lilac text-navy", label: t("overview.kpi.ltv"), value: f.bps(config.ltvBps), hint: t("overview.kpi.ltvHint", { liq: f.bps(config.liqThresholdBps) }) },
  ];
  return (
    <section aria-label="Live metrics" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <div key={it.label} className="rounded-2xl border border-line bg-surface p-5 shadow-(--shadow-card)">
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs font-semibold text-mute">{it.label}</p>
              <span className={cx("grid size-9 shrink-0 place-items-center rounded-xl", it.tile)}>
                <Icon className="size-[18px]" aria-hidden />
              </span>
            </div>
            <p className="mt-2 font-display text-2xl font-extrabold tracking-tight text-ink sm:text-[26px]">{it.value}</p>
            <p className="mt-1 text-xs text-faint">{it.hint}</p>
          </div>
        );
      })}
    </section>
  );
}

/* ---------------------------------- Charts ----------------------------------- */

function PoolDonut({ stats }: { stats: PoolStats }) {
  const t = useT();
  const f = useFmt();
  const util = stats.utilizationBps / 10_000;
  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row lg:flex-col">
      <Donut
        segments={[
          { value: stats.available, color: "var(--color-brand)", label: t("dash.pool.available") },
          { value: stats.outstandingDebt, color: "var(--color-navy)", label: t("dash.pool.lent") },
        ]}
        center={
          <div>
            <p className="text-[11px] font-medium text-mute">{t("dash.pool.total")}</p>
            <p className="font-display text-lg font-extrabold text-ink">{f.number(stats.totalLiquidity, 0)}</p>
            <p className="text-[11px] font-semibold text-faint">USDC</p>
          </div>
        }
      />
      <div className="w-full min-w-0 flex-1 space-y-4">
        <Legend
          items={[
            { color: "var(--color-brand)", label: t("dash.pool.available"), value: f.usdcRound(stats.available) },
            { color: "var(--color-navy)", label: t("dash.pool.lent"), value: f.usdcRound(stats.outstandingDebt) },
          ]}
        />
        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="text-mute">{t("dash.pool.utilization")}</span>
            <span className="font-semibold text-ink">{f.pct(util, 1)}</span>
          </div>
          <ProgressBar value={util} tone="info" />
        </div>
      </div>
    </div>
  );
}

const STATUS: Record<WarrantStatus, { label: MessageKey; color: string; tone: "brand" | "info" | "danger" | "neutral" }> = {
  [WarrantStatus.Issued]: { label: "status.issued", color: "var(--color-info)", tone: "info" },
  [WarrantStatus.InCustody]: { label: "status.inCustody", color: "var(--color-navy)", tone: "neutral" },
  [WarrantStatus.Liquidated]: { label: "status.liquidated", color: "var(--color-danger)", tone: "danger" },
  [WarrantStatus.Released]: { label: "status.released", color: "var(--color-brand)", tone: "brand" },
};

function WarrantBars({ warrants }: { warrants: Warrant[] }) {
  const t = useT();
  const f = useFmt();
  if (!warrants.length) return <p className="text-sm text-mute">{t("dash.warrants.empty")}</p>;
  const sorted = [...warrants].sort((a, b) => a.siloId.localeCompare(b.siloId));
  const totals = Object.values(WarrantStatus)
    .filter((v): v is WarrantStatus => typeof v === "number")
    .map((s) => ({ s, tons: warrants.filter((w) => w.status === s).reduce((n, w) => n + w.tons, 0) }))
    .filter((x) => x.tons > 0);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {totals.map(({ s, tons }) => (
          <Badge key={s} tone={STATUS[s].tone}>
            {t(STATUS[s].label)} · {f.tons(tons)}
          </Badge>
        ))}
      </div>
      <BarList
        items={sorted.map((w) => ({
          label: w.siloId,
          value: w.tons,
          display: f.tons(w.tons),
          color: STATUS[w.status].color,
          tag: <span className="text-[11px] text-faint">{t("status.grain.soybean")}</span>,
        }))}
      />
    </div>
  );
}

/* ------------------------------- How it works -------------------------------- */

function HowItWorks() {
  const t = useT();
  const f = useFmt();
  const steps: Array<{ icon: ReactNode; title: string; body: string }> = [
    { icon: <FileCheck2 className="size-5" />, title: t("overview.how.1.title"), body: t("overview.how.1.body") },
    { icon: <Lock className="size-5" />, title: t("overview.how.2.title"), body: t("overview.how.2.body") },
    {
      icon: <Banknote className="size-5" />,
      title: t("overview.how.3.title"),
      body: t("overview.how.3.body", { ltv: f.bps(7000) }),
    },
    { icon: <Undo2 className="size-5" />, title: t("overview.how.4.title"), body: t("overview.how.4.body") },
  ];
  return (
    <div>
      <h2 className="mb-5 text-2xl font-extrabold tracking-tight text-ink">{t("overview.how.title")}</h2>
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <li
            key={i}
            className="relative rounded-(--radius-card) border border-line bg-surface p-5 shadow-(--shadow-card)"
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="grid size-10 place-items-center rounded-xl bg-navy text-brand">{s.icon}</span>
              <span className="font-display text-sm font-bold text-faint">0{i + 1}</span>
            </div>
            <h3 className="text-base font-bold text-ink">{s.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-mute">{s.body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
