"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  CircleCheck,
  CircleDashed,
  CircleDot,
  Clock3,
  Code2,
  Eye,
  FileCheck2,
  Gauge,
  Banknote,
  Landmark,
  Lock,
  Scale,
  ShieldCheck,
  Sprout,
  Undo2,
  Wheat,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { zafra, DEFAULT_PRICE_PER_TON, type Config } from "@/lib/zafra";
import { PROGRAM_ID } from "@/lib/constants";
import { explorerAddressUrl } from "@/lib/format";
import { useFmt, useT, type MessageKey } from "@/lib/i18n";
import { useAsyncData } from "@/lib/use-async";
import { Waterfall } from "@/components/charts";
import { LocaleSwitch } from "@/components/locale-switch";
import { ZafraLockup, ZafraMark } from "@/components/logo";
import { RiskSimulator } from "@/components/risk-simulator";
import { Skeleton, cx } from "@/components/ui";

const GITHUB_URL = "https://github.com/alejandrocol-dev/zafra";

/* Canonical demo example: 100 t of soy. USD figures come from the on-chain
   Config when it loads (fallback: the 380 USDC/t reference parameters). */
const EX_TONS = 100;

interface ExampleLoan {
  price: number;
  ltvBps: number;
  liqBps: number;
  feeBps: number;
  value: number;
  loan: number;
  fee: number;
  net: number;
  liqPrice: number;
}

function exampleLoan(config: Config | null | undefined): ExampleLoan {
  const price = config?.pricePerTon ?? DEFAULT_PRICE_PER_TON;
  const ltvBps = config?.ltvBps ?? 7000;
  const liqBps = config?.liqThresholdBps ?? 8000;
  const feeBps = config?.feeBps ?? 75;
  const value = EX_TONS * price;
  const loan = (value * ltvBps) / 10_000;
  const fee = (loan * feeBps) / 10_000;
  return {
    price,
    ltvBps,
    liqBps,
    feeBps,
    value,
    loan,
    fee,
    net: Math.floor(loan - fee),
    liqPrice: loan / (liqBps / 10_000) / EX_TONS,
  };
}

export function LandingPage() {
  const { data: config } = useAsyncData(() => zafra.getConfig());
  const ex = exampleLoan(config);
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <LandingNav />
      <main className="flex-1">
        <Hero ex={ex} />
        <LiveStrip />
        <Problem />
        <How />
        <Numbers ex={ex} config={config} />
        <PriceRisk config={config} />
        <Sides ex={ex} />
        <WhyOnChain />
        <Positioning />
        <Transparency />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}

/* ------------------------------------ Nav ------------------------------------ */

function LandingNav() {
  const t = useT();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const links: Array<[string, MessageKey]> = [
    ["#how", "landing.nav.how"],
    ["#numbers", "landing.nav.numbers"],
    ["#why", "landing.nav.why"],
    ["#transparency", "landing.nav.trust"],
  ];
  return (
    <header
      className={cx(
        "sticky top-0 z-40 transition-colors duration-300",
        scrolled ? "border-b border-line bg-surface/90 backdrop-blur-md" : "bg-navy-deep",
      )}
    >
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-2 px-4 py-4 sm:gap-4 sm:px-8">
        <Link href="/" aria-label="Zafra">
          <ZafraLockup white={!scrolled} />
        </Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Landing">
          {links.map(([href, key]) => (
            <a
              key={href}
              href={href}
              className={cx(
                "rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                scrolled ? "text-mute hover:text-ink" : "text-white/70 hover:text-white",
              )}
            >
              {t(key)}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <LocaleSwitch dark={!scrolled} />
          <Link
            href="/app"
            className={cx(
              "inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-bold transition-colors sm:px-4",
              scrolled ? "bg-navy text-white hover:bg-navy-soft" : "bg-brand text-navy hover:brightness-95",
            )}
          >
            {t("landing.nav.open")}
            <ArrowUpRight className="hidden size-4 sm:block" aria-hidden />
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------ Hero ----------------------------------- */

function Hero({ ex }: { ex: ExampleLoan }) {
  const t = useT();
  return (
    <section className="relative isolate overflow-hidden bg-navy-deep text-white">
      <Image
        src="/landing/hero-wheat.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="-z-20 object-cover object-[50%_70%] opacity-70"
      />
      <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(100deg,var(--color-navy-deep)_18%,rgba(3,15,38,0.82)_48%,rgba(3,15,38,0.25)_100%)]" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-navy-deep to-transparent" />

      <div className="mx-auto grid max-w-[1200px] items-center gap-12 px-5 pb-24 pt-16 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:pb-32 lg:pt-24">
        <div className="av-rise">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80 backdrop-blur">
            <Sprout className="size-3.5 text-brand" aria-hidden />
            {t("landing.hero.eyebrow")}
          </span>
          <h1 className="mt-6 text-[42px] font-extrabold leading-[1.04] tracking-[-0.03em] sm:text-6xl lg:text-[68px]">
            {t("landing.hero.title1")}
            <br />
            <span className="text-white/55">{t("landing.hero.title2")}</span>
          </h1>
          <p className="mt-4 font-display text-2xl font-bold text-brand sm:text-3xl">{t("landing.hero.title3")}</p>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-white/75 sm:text-lg">{t("landing.hero.subtitle")}</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href="/app"
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-brand px-6 text-base font-bold text-navy shadow-[0_10px_30px_-10px_rgba(133,218,7,0.7)] transition hover:brightness-95"
            >
              {t("landing.hero.ctaApp")}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <a
              href="#how"
              className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-6 text-base font-semibold text-white backdrop-blur transition hover:bg-white/10"
            >
              {t("landing.hero.ctaHow")}
            </a>
          </div>
          <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/65">
            {(["landing.hero.trust1", "landing.hero.trust2", "landing.hero.trust3"] as const).map((k) => (
              <li key={k} className="flex items-center gap-2">
                <CircleCheck className="size-4 text-brand" aria-hidden />
                {t(k)}
              </li>
            ))}
          </ul>
        </div>

        <div className="av-rise relative mx-auto w-full max-w-md [animation-delay:150ms] lg:mr-0">
          <LoanCard ex={ex} />
        </div>
      </div>
    </section>
  );
}

function LoanCard({ ex }: { ex: ExampleLoan }) {
  const t = useT();
  const f = useFmt();
  return (
    <div className="relative">
      <div aria-hidden className="absolute -inset-6 rounded-[36px] bg-brand/20 blur-3xl" />
      <div className="av-float relative rounded-[26px] border border-white/15 bg-white p-6 text-ink shadow-(--shadow-float)">
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-sunken px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-mute">
            {t("landing.card.label")}
          </span>
          <span className="flex items-center gap-1.5 text-xs font-semibold text-brand-strong">
            <span className="size-2 rounded-full bg-brand" aria-hidden />
            Solana devnet
          </span>
        </div>
        <div className="mt-5 flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-tile-amber text-warn">
            <Wheat className="size-6" aria-hidden />
          </span>
          <div>
            <p className="font-display text-lg font-extrabold">{t("landing.card.warrant")}</p>
            <p className="font-mono text-xs text-faint">SILO-TUC-005 · {f.tons(EX_TONS)}</p>
          </div>
        </div>
        <dl className="mt-5 space-y-3 text-sm">
          <CardRow label={t("landing.card.collateral")} value={f.usdcRound(ex.value)} />
          <CardRow label={t("landing.card.loan")} value={f.usdcRound(ex.loan)} />
          <CardRow label={t("landing.card.fee")} value={`− ${f.usdc(ex.fee)}`} muted />
        </dl>
        <div className="mt-5 rounded-2xl bg-navy p-4 text-white">
          <p className="text-xs font-medium text-white/60">{t("landing.card.net")}</p>
          <p className="mt-1 font-display text-3xl font-extrabold tracking-tight">
            ≈ {f.number(ex.net, 0)} <span className="text-base font-semibold text-brand">USDC</span>
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-white/60">
            <Zap className="size-3.5 text-brand" aria-hidden />
            {t("landing.card.time")}
          </p>
        </div>
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-semibold text-mute">{t("landing.card.health")}</span>
            <span className="inline-flex items-center gap-1 font-bold text-brand-strong">
              <ShieldCheck className="size-3.5" aria-hidden />
              {t("risk.safe")}
            </span>
          </div>
          <div className="flex h-2 gap-1">
            <span className="flex-[4] rounded-full bg-brand" />
            <span className="flex-[1.2] rounded-full bg-warn/30" />
            <span className="flex-1 rounded-full bg-danger/25" />
          </div>
          <p className="mt-2 text-xs text-faint">
            {t("landing.card.liq", { price: f.number(ex.liqPrice, 2, 2) })}
          </p>
        </div>
      </div>
    </div>
  );
}

function CardRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-mute">{label}</dt>
      <dd className={cx("font-semibold tabular-nums", muted ? "text-faint" : "text-ink")}>{value}</dd>
    </div>
  );
}

/* --------------------------------- Live strip -------------------------------- */

function LiveStrip() {
  const t = useT();
  const f = useFmt();
  const { data, error } = useAsyncData(async () => {
    const [stats, config, warrants] = await Promise.all([
      zafra.getPoolStats(),
      zafra.getConfig(),
      zafra.getAllWarrants(),
    ]);
    return { stats, config, tons: warrants.reduce((s, w) => s + w.tons, 0), count: warrants.length };
  });
  const items: Array<{ label: string; value?: string }> = [
    { label: t("overview.kpi.liquidity"), value: data ? f.usdcRound(data.stats.available) : undefined },
    { label: t("overview.kpi.tons"), value: data ? f.tons(data.tons) : undefined },
    { label: t("landing.live.warrants"), value: data ? f.number(data.count, 0) : undefined },
    { label: t("overview.kpi.ltv"), value: data ? f.bps(data.config.ltvBps) : undefined },
  ];
  return (
    <section className="relative z-10 -mt-14 px-5 sm:px-8">
      <div className="mx-auto max-w-[1200px] rounded-[24px] border border-line bg-surface p-5 shadow-(--shadow-float) sm:p-7">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-mute">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-70" />
              <span className="relative inline-flex size-2.5 rounded-full bg-brand" />
            </span>
            {t("landing.live.title")}
          </p>
          <a
            href={explorerAddressUrl(PROGRAM_ID)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-navy hover:underline"
          >
            {t("landing.live.explorer")}
            <ArrowUpRight className="size-3.5" aria-hidden />
          </a>
        </div>
        {error && !data ? (
          <p className="text-sm text-mute">{t("overview.kpi.error")}</p>
        ) : (
          <dl className="grid grid-cols-2 gap-y-6 lg:grid-cols-4 lg:divide-x lg:divide-line">
            {items.map((it) => (
              <div key={it.label} className="lg:px-6 lg:first:pl-0">
                <dt className="text-xs font-semibold text-mute">{it.label}</dt>
                <dd className="mt-1.5 font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
                  {it.value ?? <Skeleton className="h-8 w-32" />}
                </dd>
              </div>
            ))}
          </dl>
        )}
        <p className="mt-5 text-[11px] text-faint">{t("landing.live.note")}</p>
      </div>
    </section>
  );
}

/* ---------------------------------- Sections --------------------------------- */

function SectionHead({
  eyebrow,
  title,
  body,
  center,
  dark,
}: {
  eyebrow: string;
  title: ReactNode;
  body?: ReactNode;
  center?: boolean;
  dark?: boolean;
}) {
  return (
    <div className={cx("max-w-2xl", center && "mx-auto text-center")}>
      <p className={cx("text-xs font-bold uppercase tracking-[0.16em]", dark ? "text-brand" : "text-brand-strong")}>{eyebrow}</p>
      <h2 className={cx("mt-3 text-3xl font-extrabold leading-[1.1] sm:text-[44px]", dark ? "text-white" : "text-ink")}>{title}</h2>
      {body && <p className={cx("mt-4 text-base leading-relaxed sm:text-lg", dark ? "text-white/70" : "text-mute")}>{body}</p>}
    </div>
  );
}

function Problem() {
  const t = useT();
  const points: Array<{ icon: LucideIcon; title: MessageKey; body: MessageKey }> = [
    { icon: Clock3, title: "landing.problem.p1.title", body: "landing.problem.p1.body" },
    { icon: Wheat, title: "landing.problem.p2.title", body: "landing.problem.p2.body" },
    { icon: Scale, title: "landing.problem.p3.title", body: "landing.problem.p3.body" },
  ];
  return (
    <section className="px-5 py-24 sm:px-8 lg:py-32">
      <div className="mx-auto grid max-w-[1200px] items-center gap-14 lg:grid-cols-2">
        <div className="relative">
          <div className="relative aspect-[4/5] overflow-hidden rounded-[28px] shadow-(--shadow-float) sm:aspect-[5/5]">
            <Image src="/landing/producer-hand.jpg" alt={t("landing.problem.photoAlt")} fill sizes="(min-width: 1024px) 560px, 100vw" className="object-cover" />
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-navy-deep/70 via-transparent to-transparent" />
            <p className="absolute bottom-5 left-5 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-navy backdrop-blur">
              Laprida, Argentina
            </p>
          </div>
          <div className="absolute -bottom-8 -right-3 hidden w-60 rounded-2xl border border-line bg-surface p-4 shadow-(--shadow-float) sm:block lg:-right-8">
            <p className="text-xs font-semibold text-mute">{t("landing.problem.badge.label")}</p>
            <p className="mt-1 font-display text-lg font-extrabold leading-tight text-ink">{t("landing.problem.badge.value")}</p>
            <p className="mt-1 text-[11px] text-faint">{t("landing.problem.badge.hint")}</p>
          </div>
        </div>
        <div>
          <SectionHead eyebrow={t("landing.problem.eyebrow")} title={t("landing.problem.title")} body={t("landing.problem.body")} />
          <ul className="mt-10 space-y-6">
            {points.map((p) => {
              const Icon = p.icon;
              return (
                <li key={p.title} className="flex gap-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-tile-lime text-brand-strong">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <div>
                    <h3 className="text-lg font-bold text-ink">{t(p.title)}</h3>
                    <p className="mt-1 text-[15px] leading-relaxed text-mute">{t(p.body)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}

function How() {
  const t = useT();
  const steps: Array<{ icon: LucideIcon; title: MessageKey; body: MessageKey; tile: string }> = [
    { icon: FileCheck2, title: "overview.how.1.title", body: "overview.how.1.body", tile: "bg-tile-lime" },
    { icon: Lock, title: "overview.how.2.title", body: "overview.how.2.body", tile: "bg-tile-sky" },
    { icon: Banknote, title: "overview.how.3.title", body: "overview.how.3.body", tile: "bg-tile-amber" },
    { icon: Undo2, title: "overview.how.4.title", body: "overview.how.4.body", tile: "bg-tile-lilac" },
  ];
  return (
    <section id="how" className="scroll-mt-20 bg-bg px-5 py-24 sm:px-8 lg:py-32">
      <div className="mx-auto max-w-[1200px]">
        <SectionHead center eyebrow={t("landing.how.eyebrow")} title={t("landing.how.title")} body={t("landing.how.body")} />
        <ol className="relative mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <span aria-hidden className="absolute left-[12%] right-[12%] top-[52px] hidden h-px bg-[repeating-linear-gradient(90deg,var(--color-line-strong)_0_6px,transparent_6px_12px)] lg:block" />
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <li key={s.title} className="relative rounded-[22px] border border-line bg-surface p-6 shadow-(--shadow-card)">
                <div className="flex items-center justify-between">
                  <span className={cx("grid size-14 place-items-center rounded-2xl text-navy", s.tile)}>
                    <Icon className="size-6" aria-hidden />
                  </span>
                  <span className="font-display text-4xl font-extrabold text-ink/[0.07]">0{i + 1}</span>
                </div>
                <h3 className="mt-6 text-lg font-bold text-ink">{t(s.title)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-mute">{t(s.body, { ltv: "70%" })}</p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

function Numbers({ ex, config }: { ex: ExampleLoan; config: Config | null | undefined }) {
  const t = useT();
  const f = useFmt();
  const facts: Array<{ icon: LucideIcon; label: MessageKey; value: string }> = [
    { icon: Gauge, label: "landing.numbers.f.ltv", value: f.bps(ex.ltvBps) },
    { icon: ShieldCheck, label: "landing.numbers.f.liq", value: f.bps(ex.liqBps) },
    { icon: BadgeCheck, label: "landing.numbers.f.fee", value: f.bps(ex.feeBps) },
    { icon: Landmark, label: "landing.numbers.f.apr", value: f.bps(config?.annualInterestBps ?? 1200) },
  ];
  return (
    <section id="numbers" className="scroll-mt-20 px-5 py-24 sm:px-8 lg:py-32">
      <div className="mx-auto grid max-w-[1200px] items-center gap-14 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <SectionHead eyebrow={t("landing.numbers.eyebrow")} title={t("landing.numbers.title")} body={t("landing.numbers.body")} />
          <dl className="mt-10 grid grid-cols-2 gap-4">
            {facts.map((fct) => {
              const Icon = fct.icon;
              return (
                <div key={fct.label} className="rounded-2xl border border-line bg-surface p-4">
                  <Icon className="size-5 text-brand-strong" aria-hidden />
                  <dd className="mt-3 font-display text-2xl font-extrabold text-ink">{fct.value}</dd>
                  <dt className="mt-0.5 text-xs text-mute">{t(fct.label)}</dt>
                </div>
              );
            })}
          </dl>
        </div>
        <div className="rounded-[28px] border border-line bg-surface p-6 shadow-(--shadow-float) sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-display text-lg font-extrabold text-ink">{t("landing.numbers.chart")}</p>
            <span className="rounded-full bg-sunken px-3 py-1 text-xs font-semibold text-mute">
              {f.tons(EX_TONS)} · {t("status.grain.soybean")} · {f.number(ex.price, 0)} USDC/t
            </span>
          </div>
          <Waterfall
            className="mt-2"
            height={240}
            steps={[
              { label: t("landing.numbers.w.value"), value: ex.value, display: f.number(ex.value, 0), kind: "total" },
              { label: t("landing.numbers.w.haircut"), value: -(ex.value - ex.loan), display: `−${f.number(ex.value - ex.loan, 0)}`, kind: "delta" },
              { label: t("landing.numbers.w.fee"), value: -ex.fee, display: `−${f.number(ex.fee, 0)}`, kind: "delta" },
              { label: t("landing.numbers.w.net"), value: ex.net, display: `≈${f.number(ex.net, 0)}`, kind: "result" },
            ]}
          />
          <p className="mt-6 text-xs leading-relaxed text-faint">{t("landing.numbers.note")}</p>
        </div>
      </div>
    </section>
  );
}

function PriceRisk({ config }: { config: Config | null | undefined }) {
  const t = useT();
  return (
    <section className="bg-bg px-5 py-24 sm:px-8 lg:py-32">
      <div className="mx-auto max-w-[1200px]">
        <SectionHead center eyebrow={t("landing.risk.eyebrow")} title={t("landing.risk.title")} body={t("landing.risk.body")} />
        <div className="mt-14 rounded-[28px] border border-line bg-surface p-5 shadow-(--shadow-float) sm:p-8">
          <RiskSimulator config={config} oraclePrice={config?.pricePerTon} />
        </div>
      </div>
    </section>
  );
}

function Sides({ ex }: { ex: ExampleLoan }) {
  const t = useT();
  const f = useFmt();
  return (
    <section className="px-5 py-24 sm:px-8 lg:py-32">
      <div className="mx-auto max-w-[1200px]">
        <SectionHead center eyebrow={t("landing.sides.eyebrow")} title={t("landing.sides.title")} />
        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          <SideCard
            dark
            icon={Wheat}
            title={t("landing.sides.prod.title")}
            body={t("landing.sides.prod.body")}
            bullets={[t("landing.sides.prod.b1"), t("landing.sides.prod.b2"), t("landing.sides.prod.b3")]}
            cta={t("landing.sides.prod.cta")}
            href="/app#borrow"
            stat={
              <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                <p className="font-display text-3xl font-extrabold text-brand">≈ {f.number(ex.net, 0)} USDC</p>
                <p className="mt-1 text-sm text-white/70">{t("landing.sides.prod.stat")}</p>
              </div>
            }
          />
          <SideCard
            icon={Landmark}
            title={t("landing.sides.inv.title")}
            body={t("landing.sides.inv.body")}
            bullets={[t("landing.sides.inv.b1"), t("landing.sides.inv.b2"), t("landing.sides.inv.b3")]}
            cta={t("landing.sides.inv.cta")}
            href="/app#earn"
            stat={
              <div className="mt-8 rounded-2xl bg-white/70 p-4">
                <p className="font-display text-3xl font-extrabold text-navy">{f.number(74.3, 1, 1)}%</p>
                <p className="mt-1 text-sm text-navy/70">{t("landing.sides.inv.stat")}</p>
                <p className="mt-1 text-[11px] text-navy/50">{t("landing.sides.inv.source")}</p>
              </div>
            }
          />
        </div>
      </div>
    </section>
  );
}

function SideCard({
  dark,
  icon: Icon,
  title,
  body,
  bullets,
  cta,
  href,
  stat,
}: {
  dark?: boolean;
  icon: LucideIcon;
  title: string;
  body: string;
  bullets: string[];
  cta: string;
  href: string;
  stat?: ReactNode;
}) {
  return (
    <div
      className={cx(
        "relative flex flex-col overflow-hidden rounded-[28px] p-8 sm:p-10",
        dark ? "bg-navy text-white" : "bg-tile-lime text-navy",
      )}
    >
      {dark && <div aria-hidden className="av-grid pointer-events-none absolute inset-0 opacity-50" />}
      <div className="relative flex flex-1 flex-col">
        <span className={cx("grid size-14 place-items-center rounded-2xl", dark ? "bg-brand text-navy" : "bg-navy text-brand")}>
          <Icon className="size-6" aria-hidden />
        </span>
        <h3 className={cx("mt-6 text-2xl font-extrabold sm:text-3xl", dark ? "text-white" : "text-navy")}>{title}</h3>
        <p className={cx("mt-3 text-base leading-relaxed", dark ? "text-white/70" : "text-navy/70")}>{body}</p>
        <ul className="mt-6 space-y-3">
          {bullets.map((b) => (
            <li key={b} className="flex items-center gap-3 text-[15px] font-semibold">
              <CircleCheck className={cx("size-5 shrink-0", dark ? "text-brand" : "text-brand-strong")} aria-hidden />
              {b}
            </li>
          ))}
        </ul>
        {stat}
        <div className="mt-auto pt-8">
          <Link
            href={href}
            className={cx(
              "inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-bold transition",
              dark ? "bg-brand text-navy hover:brightness-95" : "bg-navy text-white hover:bg-navy-soft",
            )}
          >
            {cta}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}

function WhyOnChain() {
  const t = useT();
  const items: Array<{ icon: LucideIcon; title: MessageKey; body: MessageKey }> = [
    { icon: Lock, title: "landing.why.1.title", body: "landing.why.1.body" },
    { icon: Eye, title: "landing.why.2.title", body: "landing.why.2.body" },
    { icon: ShieldCheck, title: "landing.why.3.title", body: "landing.why.3.body" },
    { icon: Zap, title: "landing.why.4.title", body: "landing.why.4.body" },
  ];
  return (
    <section id="why" className="scroll-mt-20 bg-navy-deep px-5 py-24 text-white sm:px-8 lg:py-32">
      <div className="relative mx-auto max-w-[1200px]">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <SectionHead dark eyebrow={t("landing.why.eyebrow")} title={t("landing.why.title")} />
          <p className="text-base leading-relaxed text-white/65 lg:pb-2">{t("landing.why.body")}</p>
        </div>
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((it) => {
            const Icon = it.icon;
            return (
              <div key={it.title} className="rounded-[22px] border border-white/10 bg-white/[0.04] p-6 transition-colors hover:bg-white/[0.07]">
                <span className="grid size-12 place-items-center rounded-2xl bg-brand/15 text-brand">
                  <Icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-6 text-lg font-bold text-white">{t(it.title)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/60">{t(it.body)}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Positioning() {
  const t = useT();
  return (
    <section className="relative isolate overflow-hidden px-5 py-28 text-white sm:px-8 lg:py-36">
      <Image src="/landing/silos.jpg" alt="" fill sizes="100vw" className="-z-20 object-cover" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-navy/80" />
      <div className="mx-auto max-w-[960px] text-center">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">{t("landing.pos.eyebrow")}</p>
        <blockquote className="mt-6 font-display text-3xl font-extrabold leading-[1.15] sm:text-5xl">
          {t("landing.pos.quote")}
        </blockquote>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-white/75 sm:text-lg">{t("landing.pos.body")}</p>
      </div>
    </section>
  );
}

function Transparency() {
  const t = useT();
  type Status = "real" | "sim" | "out" | "pending";
  const rows: Array<[MessageKey, Status]> = [
    ["landing.trust.r1", "real"],
    ["landing.trust.r2", "real"],
    ["landing.trust.r3", "sim"],
    ["landing.trust.r4", "sim"],
    ["landing.trust.r5", "out"],
    ["landing.trust.r6", "pending"],
  ];
  const badge: Record<Status, { label: MessageKey; cls: string; icon: LucideIcon }> = {
    real: { label: "landing.trust.s.real", cls: "bg-tile-lime text-brand-strong", icon: CircleCheck },
    sim: { label: "landing.trust.s.sim", cls: "bg-tile-amber text-warn", icon: CircleDashed },
    out: { label: "landing.trust.s.out", cls: "bg-sunken text-mute", icon: CircleDot },
    pending: { label: "landing.trust.s.pending", cls: "bg-danger/10 text-danger", icon: CircleDot },
  };
  return (
    <section id="transparency" className="scroll-mt-20 px-5 py-24 sm:px-8 lg:py-32">
      <div className="mx-auto grid max-w-[1200px] gap-14 lg:grid-cols-[0.8fr_1.2fr]">
        <SectionHead eyebrow={t("landing.trust.eyebrow")} title={t("landing.trust.title")} body={t("landing.trust.body")} />
        <ul className="divide-y divide-line overflow-hidden rounded-[24px] border border-line bg-surface shadow-(--shadow-card)">
          {rows.map(([key, status]) => {
            const b = badge[status];
            const Icon = b.icon;
            return (
              <li key={key} className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
                <span className="text-[15px] font-semibold text-ink">{t(key)}</span>
                <span className={cx("inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold", b.cls)}>
                  <Icon className="size-3.5" aria-hidden />
                  {t(b.label)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function FinalCta() {
  const t = useT();
  return (
    <section className="px-5 pb-24 sm:px-8">
      <div className="relative mx-auto max-w-[1200px] overflow-hidden rounded-[32px] bg-navy px-6 py-16 text-center text-white sm:px-12 sm:py-20">
        <div aria-hidden className="av-grid pointer-events-none absolute inset-0 opacity-60" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 left-1/2 size-[420px] -translate-x-1/2 rounded-full bg-brand/25 blur-3xl" />
        <div className="relative">
          <ZafraMark white className="mx-auto size-16" />
          <h2 className="mx-auto mt-6 max-w-2xl text-3xl font-extrabold leading-[1.1] sm:text-5xl">{t("landing.cta.title")}</h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-white/70 sm:text-lg">{t("landing.cta.body")}</p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link href="/app" className="inline-flex h-12 items-center gap-2 rounded-xl bg-brand px-6 text-base font-bold text-navy transition hover:brightness-95">
              {t("landing.hero.ctaApp")}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/20 px-6 text-base font-semibold text-white transition hover:bg-white/10"
            >
              <Code2 className="size-4" aria-hidden />
              {t("landing.cta.github")}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function LandingFooter() {
  const t = useT();
  return (
    <footer className="bg-navy-deep px-5 py-14 text-white/60 sm:px-8">
      <div className="mx-auto grid max-w-[1200px] gap-10 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <ZafraLockup white />
          <p className="mt-4 font-display text-lg font-bold text-white">{t("landing.footer.tagline")}</p>
        </div>
        <div className="space-y-4 text-xs leading-relaxed">
          <p>{t("footer.disclaimer")}</p>
          <div className="flex flex-wrap gap-x-6 gap-y-2 font-semibold">
            <a href={explorerAddressUrl(PROGRAM_ID)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-white/80 hover:text-white">
              {t("footer.program")} <ArrowUpRight className="size-3.5" aria-hidden />
            </a>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-white/80 hover:text-white">
              GitHub <ArrowUpRight className="size-3.5" aria-hidden />
            </a>
            <span>{t("footer.builtFor")}</span>
          </div>
          <p className="text-white/40">{t("landing.footer.photos")}</p>
        </div>
      </div>
    </footer>
  );
}
