"use client";

import type { ReactNode } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  ArrowRight,
  Banknote,
  CircleCheck,
  FileCheck2,
  Lock,
  Undo2,
  Wheat,
} from "lucide-react";
import {
  zafra,
  DEFAULT_PRICE_PER_TON,
  LoanStatus,
  WarrantStatus,
} from "@/lib/zafra";
import { useFmt, useT } from "@/lib/i18n";
import { useView, type View } from "@/lib/nav";
import { useAsyncData } from "@/lib/use-async";
import { positionRisk } from "@/lib/risk";
import { Badge, Button, Card, Notice, Skeleton, Stat, StatGrid, cx } from "@/components/ui";

export function OverviewView() {
  const t = useT();
  const [, setView] = useView();

  return (
    <div className="space-y-12">
      <section className="relative overflow-hidden rounded-3xl border border-line bg-surface px-6 py-12 sm:px-12 sm:py-16">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-brand/15 blur-3xl"
        />
        <Wheat
          aria-hidden
          className="pointer-events-none absolute -bottom-6 right-8 size-56 text-brand/10 sm:size-72"
        />
        <div className="relative max-w-2xl">
          <Badge tone="brand">{t("overview.eyebrow")}</Badge>
          <h1 className="mt-5 text-4xl font-bold leading-[1.1] tracking-tight text-ink sm:text-5xl">
            {t("overview.title")}
          </h1>
          <p className="mt-5 text-base leading-relaxed text-mute sm:text-lg">
            {t("overview.subtitle")}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" onClick={() => document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" })}>
              {t("overview.ctaTry")}
              <ArrowRight className="size-4" aria-hidden />
            </Button>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => document.getElementById("how")?.scrollIntoView({ behavior: "smooth" })}
            >
              {t("overview.ctaHow")}
            </Button>
          </div>
        </div>
      </section>

      <Kpis />

      <section id="how" className="scroll-mt-24">
        <HowItWorks />
      </section>

      <section id="demo" className="scroll-mt-24 grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <GuidedDemo onGo={setView} />
        </div>
        <div className="space-y-4 lg:col-span-2">
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
          <Notice tone="warn" title={t("overview.honest.title")}>
            {t("overview.honest.body")}
          </Notice>
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------ KPIs ----------------------------------- */

function Kpis() {
  const t = useT();
  const f = useFmt();
  const { data, error, loading } = useAsyncData(async () => {
    const [stats, config, warrants] = await Promise.all([
      zafra.getPoolStats(),
      zafra.getConfig(),
      zafra.getAllWarrants(),
    ]);
    return { stats, config, tons: warrants.reduce((s, w) => s + w.tons, 0) };
  });

  return (
    <section aria-label="Live metrics" className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="relative flex size-2.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-60" />
          <span className="relative inline-flex size-2.5 rounded-full bg-brand" />
        </span>
        <span className="text-xs font-semibold uppercase tracking-wider text-mute">
          {t("common.liveOnDevnet")}
        </span>
      </div>
      {error && !data ? (
        <Notice tone="warn">{t("overview.kpi.error")}</Notice>
      ) : (
        <StatGrid>
          {loading && !data ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)
          ) : data ? (
            <>
              <Stat
                label={t("overview.kpi.liquidity")}
                value={f.usdcRound(data.stats.available)}
                hint={t("overview.kpi.liquidityHint")}
              />
              <Stat
                label={t("overview.kpi.debt")}
                value={f.usdcRound(data.stats.outstandingDebt)}
                hint={t("overview.kpi.debtHint")}
              />
              <Stat
                label={t("overview.kpi.tons")}
                value={f.tons(data.tons)}
                hint={t("overview.kpi.tonsHint")}
              />
              <Stat
                label={t("overview.kpi.ltv")}
                value={f.bps(data.config.ltvBps)}
                hint={t("overview.kpi.ltvHint", { liq: f.bps(data.config.liqThresholdBps) })}
              />
            </>
          ) : null}
        </StatGrid>
      )}
    </section>
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
      <h2 className="mb-5 text-2xl font-bold tracking-tight text-ink">{t("overview.how.title")}</h2>
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <li
            key={i}
            className="relative rounded-(--radius-card) border border-line bg-surface p-5 shadow-(--shadow-card)"
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="grid size-10 place-items-center rounded-xl bg-brand/10 text-brand-strong">
                {s.icon}
              </span>
              <span className="text-sm font-semibold text-faint">0{i + 1}</span>
            </div>
            <h3 className="text-base font-semibold text-ink">{s.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-mute">{s.body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ------------------------------- Guided demo --------------------------------- */

function GuidedDemo({ onGo }: { onGo: (v: View) => void }) {
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

  const steps: Array<{ done: boolean; title: string; body: string; view: View }> = [
    { done: !!data?.issued, title: t("demo.step1.title"), body: t("demo.step1.body"), view: "certifier" },
    { done: !!data?.borrowed, title: t("demo.step2.title"), body: t("demo.step2.body"), view: "borrow" },
    { done: !!data?.priceDropped, title: t("demo.step3.title"), body: t("demo.step3.body"), view: "admin" },
    { done: !!data?.closed, title: t("demo.step4.title"), body: t("demo.step4.body"), view: "borrow" },
  ];
  const current = steps.findIndex((s) => !s.done);

  return (
    <Card title={t("demo.title")} subtitle={t("demo.subtitle")}>
      <ol className="space-y-3">
        {steps.map((s, i) => (
          <li
            key={i}
            className={cx(
              "flex items-center gap-4 rounded-xl border p-4 transition-colors",
              s.done
                ? "border-brand/30 bg-brand/5"
                : i === current
                  ? "border-brand/50 bg-sunken"
                  : "border-line bg-sunken/60",
            )}
          >
            <span
              className={cx(
                "grid size-9 shrink-0 place-items-center rounded-full border text-sm font-bold",
                s.done
                  ? "border-brand bg-brand text-brand-ink"
                  : i === current
                    ? "border-brand text-brand-strong"
                    : "border-line-strong text-faint",
              )}
            >
              {s.done ? <CircleCheck className="size-5" aria-hidden /> : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-ink">{s.title}</p>
              <p className="text-sm text-mute">{s.body}</p>
            </div>
            {s.done ? (
              <Badge tone="brand">{t("demo.done")}</Badge>
            ) : (
              <Button
                size="sm"
                variant={i === current ? "primary" : "secondary"}
                onClick={() => onGo(s.view)}
              >
                {t("demo.go")}
                <ArrowRight className="size-3.5" aria-hidden />
              </Button>
            )}
          </li>
        ))}
      </ol>
      {!publicKey && <p className="mt-4 text-sm text-faint">{t("demo.needWallet")}</p>}
    </Card>
  );
}
