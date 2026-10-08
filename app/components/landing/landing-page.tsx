"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
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
  ChevronDown,
  Gavel,
  Hourglass,
  Landmark,
  Rocket,
  Timer,
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
import { useInView } from "@/lib/use-motion";
import { ActivityTicker } from "@/components/activity-feed";
import { Waterfall } from "@/components/charts";
import { CountUp, Marquee, Reveal, RotatingWord, ScrollProgress } from "@/components/motion";
import { LocaleSwitch } from "@/components/locale-switch";
import { ZafraLockup, ZafraMark } from "@/components/logo";
import { RiskSimulator } from "@/components/risk-simulator";
import { Button, Skeleton, cx } from "@/components/ui";

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
      <ScrollProgress />
      <LandingNav />
      <main className="flex-1">
        <Hero ex={ex} />
        <LiveStrip />
        <Sides ex={ex} />
        <Problem ex={ex} />
        <Market />
        <How />
        <AppPreview />
        <Numbers ex={ex} config={config} />
        <PriceRisk config={config} />
        <Speed />
        <Legal />
        <Positioning />
        <WhyOnChain />
        <Transparency />
        <Faq />
        <Roadmap />
        <BuiltOn />
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
    ["#legal", "landing.nav.legal"],
    ["#transparency", "landing.nav.trust"],
    ["#faq", "landing.nav.faq"],
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
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Landing">
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
  const f = useFmt();
  const chips = [
    t("landing.hero.chip.ltv", { ltv: f.bps(ex.ltvBps) }),
    t("landing.hero.chip.speed"),
    t("landing.hero.chip.fee", { fee: f.bps(ex.feeBps) }),
    t("landing.hero.chip.rules"),
  ];
  const rotating = [t("landing.hero.title2"), t("landing.hero.rotate.2"), t("landing.hero.rotate.3"), t("landing.hero.rotate.4")];
  const heroRef = useRef<HTMLElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const hero = heroRef.current;
    const bg = bgRef.current;
    if (!hero || !bg || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        if (y <= hero.offsetHeight) bg.style.transform = `translate3d(0, ${y * 0.35}px, 0) scale(1.08)`;
      });
    };
    const onMove = (e: PointerEvent) => {
      const r = hero.getBoundingClientRect();
      hero.style.setProperty("--mx", `${e.clientX - r.left}px`);
      hero.style.setProperty("--my", `${e.clientY - r.top}px`);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    hero.addEventListener("pointermove", onMove);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      hero.removeEventListener("pointermove", onMove);
    };
  }, []);
  return (
    <section ref={heroRef} className="group/hero relative isolate overflow-hidden bg-navy-deep text-white">
      <div ref={bgRef} aria-hidden className="absolute inset-0 -z-20 scale-[1.08] will-change-transform">
        <Image src="/landing/hero-wheat.jpg" alt="" fill priority sizes="100vw" className="object-cover object-[50%_70%] opacity-70" />
      </div>
      <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(100deg,var(--color-navy-deep)_18%,rgba(3,15,38,0.82)_48%,rgba(3,15,38,0.25)_100%)]" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-500 group-hover/hero:opacity-100"
        style={{ background: "radial-gradient(560px circle at var(--mx, 70%) var(--my, 40%), rgba(133,218,7,0.16), transparent 60%)" }}
      />
      <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-navy-deep to-transparent" />

      <div className="mx-auto grid max-w-[1200px] items-center gap-12 px-5 pb-24 pt-16 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:pb-32 lg:pt-24">
        <div className="av-rise">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80 backdrop-blur">
            <Sprout className="size-3.5 text-brand" aria-hidden />
            {t("landing.hero.eyebrow")}
          </span>
          <h1 className="mt-6 text-[40px] font-extrabold leading-[1.04] tracking-[-0.03em] sm:text-6xl lg:text-[64px]">
            {t("landing.hero.title1")}
            <br />
            <span className="text-brand">
              <span className="sr-only">{t("landing.hero.title2")}</span>
              <span aria-hidden>
                <RotatingWord words={rotating} />
              </span>
            </span>
          </h1>
          <p className="mt-5 font-display text-xl font-bold text-white/85 sm:text-2xl">{t("landing.hero.title3")}</p>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-white/70 sm:text-lg">{t("landing.hero.subtitle")}</p>
          <ul className="mt-6 flex flex-wrap gap-2">
            {chips.map((c) => (
              <li key={c} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.07] px-3 py-1.5 text-xs font-semibold text-white/85 backdrop-blur">
                <CircleCheck className="size-3.5 text-brand" aria-hidden />
                {c}
              </li>
            ))}
          </ul>
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
        <div className="relative mt-5 overflow-hidden rounded-2xl bg-navy p-4 text-white">
          <span aria-hidden className="av-glint pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
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
  const { data, error, reload } = useAsyncData(async () => {
    const [stats, config, warrants] = await Promise.all([
      zafra.getPoolStats(),
      zafra.getConfig(),
      zafra.getAllWarrants(),
    ]);
    return { stats, config, tons: warrants.reduce((s, w) => s + w.tons, 0), count: warrants.length };
  });
  const items: Array<{ label: string; value?: number; format: (n: number) => string }> = [
    { label: t("overview.kpi.liquidity"), value: data?.stats.available, format: (n) => f.usdcRound(n) },
    { label: t("overview.kpi.tons"), value: data?.tons, format: (n) => f.tons(Math.round(n)) },
    { label: t("landing.live.warrants"), value: data?.count, format: (n) => f.number(Math.round(n), 0) },
    { label: t("overview.kpi.ltv"), value: data ? data.config.ltvBps / 100 : undefined, format: (n) => `${f.number(Math.round(n), 0)}%` },
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-mute">{t("overview.kpi.error")}</p>
            <Button size="sm" variant="secondary" onClick={reload}>
              {t("common.retry")}
            </Button>
          </div>
        ) : (
          <dl className="grid grid-cols-2 gap-y-6 lg:grid-cols-4 lg:divide-x lg:divide-line">
            {items.map((it) => (
              <div key={it.label} className="lg:px-6 lg:first:pl-0">
                <dt className="text-xs font-semibold text-mute">{it.label}</dt>
                <dd className="mt-1.5 font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
                  {it.value !== undefined ? <CountUp value={it.value} format={it.format} /> : <Skeleton className="h-8 w-32" />}
                </dd>
              </div>
            ))}
          </dl>
        )}
        <div className="mt-6 border-t border-line pt-5 empty:hidden">
          <ActivityTicker label={t("landing.live.activity")} />
        </div>
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
    <Reveal className={cx("max-w-2xl", center && "mx-auto text-center")}>
      <p className={cx("text-xs font-bold uppercase tracking-[0.16em]", dark ? "text-brand" : "text-brand-strong")}>{eyebrow}</p>
      <h2 className={cx("mt-3 text-3xl font-extrabold leading-[1.1] sm:text-[44px]", dark ? "text-white" : "text-ink")}>{title}</h2>
      {body && <p className={cx("mt-4 text-base leading-relaxed sm:text-lg", dark ? "text-white/70" : "text-mute")}>{body}</p>}
    </Reveal>
  );
}

function Problem({ ex }: { ex: ExampleLoan }) {
  const t = useT();
  const f = useFmt();
  const points: Array<{ icon: LucideIcon; title: MessageKey; body: MessageKey }> = [
    { icon: Clock3, title: "landing.problem.p1.title", body: "landing.problem.p1.body" },
    { icon: Wheat, title: "landing.problem.p2.title", body: "landing.problem.p2.body" },
    { icon: Scale, title: "landing.problem.p3.title", body: "landing.problem.p3.body" },
  ];
  return (
    <section className="bg-bg px-5 py-24 sm:px-8 lg:py-32">
      <div className="mx-auto grid max-w-[1200px] items-center gap-14 lg:grid-cols-2">
        <Reveal className="relative">
          <div className="relative aspect-[4/5] overflow-hidden rounded-[28px] shadow-(--shadow-float) sm:aspect-[5/5]">
            <Image src="/landing/producer-hand.jpg" alt={t("landing.problem.photoAlt")} fill sizes="(min-width: 1024px) 560px, 100vw" className="object-cover" />
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-navy-deep/70 via-transparent to-transparent" />
            <p className="absolute bottom-5 left-5 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-navy backdrop-blur">
              Laprida, Argentina
            </p>
          </div>
          <div className="absolute -bottom-8 -right-3 hidden w-60 rounded-2xl border border-line bg-surface p-4 shadow-(--shadow-float) sm:block lg:-right-8">
            <p className="text-xs font-semibold text-mute">{t("landing.problem.badge.label")}</p>
            <p className="mt-1 font-display text-lg font-extrabold leading-tight text-ink">{t("landing.problem.badge.value", { value: f.number(ex.value, 0) })}</p>
            <p className="mt-1 text-[11px] text-faint">{t("landing.problem.badge.hint", { price: f.number(ex.price, 0) })}</p>
          </div>
        </Reveal>
        <div>
          <SectionHead eyebrow={t("landing.problem.eyebrow")} title={t("landing.problem.title")} body={t("landing.problem.body")} />
          <ul className="mt-10 space-y-6">
            {points.map((p, i) => {
              const Icon = p.icon;
              return (
                <Reveal as="li" delay={i * 120} key={p.title} className="flex gap-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-tile-lime text-brand-strong">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <div>
                    <h3 className="text-lg font-bold text-ink">{t(p.title)}</h3>
                    <p className="mt-1 text-[15px] leading-relaxed text-mute">{t(p.body)}</p>
                  </div>
                </Reveal>
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
    <section id="how" className="scroll-mt-20 px-5 py-24 sm:px-8 lg:py-32">
      <div className="mx-auto max-w-[1200px]">
        <SectionHead center eyebrow={t("landing.how.eyebrow")} title={t("landing.how.title")} body={t("landing.how.body")} />
        <ol className="relative mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <span aria-hidden className="absolute left-[12%] right-[12%] top-[52px] hidden h-px bg-[repeating-linear-gradient(90deg,var(--color-line-strong)_0_6px,transparent_6px_12px)] lg:block" />
          <span aria-hidden className="av-travel absolute top-[46px] z-10 hidden size-3 -translate-x-1/2 rounded-full bg-brand shadow-[0_0_18px_6px_rgba(133,218,7,0.65)] lg:block" />
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <Reveal
                as="li"
                delay={i * 140}
                key={s.title}
                className="relative rounded-[22px] border border-line bg-surface p-6 shadow-(--shadow-card) hover:-translate-y-1 hover:shadow-(--shadow-float)"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cx("av-ping-ring grid size-14 place-items-center rounded-2xl text-navy", s.tile)}
                    style={{ animationDelay: `${i * 1.15}s` }}
                  >
                    <Icon className="size-6" aria-hidden />
                  </span>
                  <span className="font-display text-4xl font-extrabold text-ink/[0.07]">0{i + 1}</span>
                </div>
                <h3 className="mt-6 text-lg font-bold text-ink">{t(s.title)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-mute">{t(s.body, { ltv: "70%" })}</p>
              </Reveal>
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
  const [chartRef, chartIn] = useInView<HTMLDivElement>("0px 0px -20% 0px");
  return (
    <section id="numbers" className="scroll-mt-20 px-5 py-24 sm:px-8 lg:py-32">
      <div className="mx-auto grid max-w-[1200px] items-center gap-14 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <SectionHead eyebrow={t("landing.numbers.eyebrow")} title={t("landing.numbers.title", { net: f.number(ex.net, 0) })} body={t("landing.numbers.body")} />
          <dl className="mt-10 grid grid-cols-2 gap-4">
            {facts.map((fct, i) => {
              const Icon = fct.icon;
              return (
                <Reveal delay={i * 90} key={fct.label} className="rounded-2xl border border-line bg-surface p-4 hover:-translate-y-1 hover:shadow-(--shadow-card)">
                  <Icon className="size-5 text-brand-strong" aria-hidden />
                  <dd className="mt-3 font-display text-2xl font-extrabold text-ink">{fct.value}</dd>
                  <dt className="mt-0.5 text-xs text-mute">{t(fct.label)}</dt>
                </Reveal>
              );
            })}
          </dl>
          <ul className="mt-6 space-y-2.5">
            {(["landing.numbers.r1", "landing.numbers.r2", "landing.numbers.r3"] as const).map((k) => (
              <li key={k} className="flex gap-2.5 text-sm text-ink">
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-brand-strong" aria-hidden />
                {t(k)}
              </li>
            ))}
          </ul>
          <a
            href={explorerAddressUrl(PROGRAM_ID)}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-navy hover:underline"
          >
            {t("landing.numbers.contract")}
            <ArrowUpRight className="size-4" aria-hidden />
          </a>
        </div>
        <div ref={chartRef} className="rounded-[28px] border border-line bg-surface p-6 shadow-(--shadow-float) sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-display text-lg font-extrabold text-ink">{t("landing.numbers.chart")}</p>
            <span className="rounded-full bg-sunken px-3 py-1 text-xs font-semibold text-mute">
              {f.tons(EX_TONS)} · {t("status.grain.soybean")} · {f.number(ex.price, 0)} USDC/t
            </span>
          </div>
          <Waterfall
            className="mt-2"
            height={240}
            active={chartIn}
            steps={[
              { label: t("landing.numbers.w.value"), value: ex.value, display: f.number(ex.value, 0), kind: "total" },
              { label: t("landing.numbers.w.haircut"), value: -(ex.value - ex.loan), display: `−${f.number(ex.value - ex.loan, 0)}`, kind: "delta" },
              { label: t("landing.numbers.w.fee"), value: -ex.fee, display: `−${f.number(ex.fee, 0)}`, kind: "delta" },
              { label: t("landing.numbers.w.net"), value: ex.net, display: `≈${f.number(ex.net, 0)}`, kind: "result" },
            ]}
          />
          <p className="mt-6 text-xs leading-relaxed text-faint">{t("landing.numbers.note", { price: f.number(ex.price, 0) })}</p>
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
                <p className="font-display text-3xl font-extrabold text-brand">
                  ≈ <CountUp value={ex.net} format={(n) => f.number(Math.round(n), 0)} /> USDC
                </p>
                <p className="mt-1 text-sm text-white/70">{t("landing.sides.prod.stat", { price: f.number(ex.price, 0) })}</p>
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
                <p className="font-display text-3xl font-extrabold text-navy">
                  <CountUp value={74.3} format={(n) => `${f.number(n, 1, 1)}%`} />
                </p>
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
    <Reveal
      delay={dark ? 0 : 150}
      className={cx(
        "relative flex flex-col overflow-hidden rounded-[28px] p-8 hover:-translate-y-1 hover:shadow-(--shadow-float) sm:p-10",
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
    </Reveal>
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
          {items.map((it, i) => {
            const Icon = it.icon;
            return (
              <Reveal delay={i * 110} key={it.title} className="rounded-[22px] border border-white/10 bg-white/[0.04] p-6 hover:-translate-y-1 hover:bg-white/[0.07]">
                <span className="grid size-12 place-items-center rounded-2xl bg-brand/15 text-brand">
                  <Icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-6 text-lg font-bold text-white">{t(it.title)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/60">{t(it.body)}</p>
              </Reveal>
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
      <Reveal className="mx-auto max-w-[960px] text-center">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">{t("landing.pos.eyebrow")}</p>
        <blockquote className="mt-6 font-display text-3xl font-extrabold leading-[1.15] sm:text-5xl">
          {t("landing.pos.quote")}
        </blockquote>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-white/75 sm:text-lg">{t("landing.pos.body")}</p>
        <p className="mt-6 text-xs text-white/50">{t("landing.pos.source")}</p>
      </Reveal>
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

function Market() {
  const t = useT();
  const f = useFmt();
  const stats = [
    { n: 1, value: 1960, decimals: 0 },
    { n: 2, value: 10.6, decimals: 1 },
    { n: 3, value: 63.5, decimals: 1 },
    { n: 4, value: 19.8, decimals: 1 },
  ] as const;
  return (
    <section className="relative isolate overflow-hidden bg-navy-deep px-5 py-24 text-white sm:px-8 lg:py-28">
      <div aria-hidden className="av-grid pointer-events-none absolute inset-0 -z-10 opacity-40" />
      <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 -z-10 size-[520px] rounded-full bg-brand/10 blur-3xl" />
      <div className="mx-auto max-w-[1200px]">
        <SectionHead dark eyebrow={t("landing.market.eyebrow")} title={t("landing.market.title")} body={t("landing.market.body")} />
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s, i) => (
            <Reveal
              key={s.n}
              delay={i * 120}
              className="flex flex-col rounded-[22px] border border-white/10 bg-white/[0.04] p-6 hover:-translate-y-1 hover:border-brand/40 hover:bg-white/[0.07]"
            >
              <p className="font-display text-4xl font-extrabold tracking-tight text-brand">
                <CountUp value={s.value} format={(v) => t(`landing.market.s${s.n}.value`, { n: f.number(v, s.decimals, s.decimals) })} />
              </p>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-white/75">{t(`landing.market.s${s.n}.label`)}</p>
              <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-white/40">{t(`landing.market.s${s.n}.source`)}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function AppPreview() {
  const t = useT();
  return (
    <section className="overflow-hidden bg-bg px-5 py-24 sm:px-8 lg:py-32">
      <div className="mx-auto grid max-w-[1200px] items-center gap-14 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <SectionHead eyebrow={t("landing.preview.eyebrow")} title={t("landing.preview.title")} body={t("landing.preview.body")} />
          <ul className="mt-8 space-y-3">
            {(["landing.preview.b1", "landing.preview.b2", "landing.preview.b3"] as const).map((k) => (
              <li key={k} className="flex items-center gap-3 text-[15px] font-semibold text-ink">
                <CircleCheck className="size-5 shrink-0 text-brand-strong" aria-hidden />
                {t(k)}
              </li>
            ))}
          </ul>
          <Link href="/app" className="mt-9 inline-flex h-12 items-center gap-2 rounded-xl bg-navy px-6 text-base font-bold text-white transition hover:bg-navy-soft">
            {t("landing.hero.ctaApp")}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        <Reveal delay={150} className="relative [perspective:1600px]">
          <div aria-hidden className="absolute -inset-8 rounded-[40px] bg-brand/15 blur-3xl" />
          <div className="relative overflow-hidden rounded-[22px] border border-line bg-surface shadow-(--shadow-float) transition-transform duration-700 ease-out [transform:rotateY(-8deg)_rotateX(4deg)] hover:[transform:rotateY(0deg)_rotateX(0deg)]">
            <div className="flex items-center gap-1.5 border-b border-line bg-sunken px-4 py-2.5">
              <span className="size-2.5 rounded-full bg-danger/50" />
              <span className="size-2.5 rounded-full bg-warn/50" />
              <span className="size-2.5 rounded-full bg-brand/60" />
              <span className="ml-3 truncate font-mono text-[11px] text-faint">zafra-gilt.vercel.app/app</span>
            </div>
            <Image src="/landing/app-dashboard.jpg" alt={t("landing.preview.alt")} width={1400} height={1118} sizes="(min-width: 1024px) 700px, 100vw" className="h-auto w-full" />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Speed() {
  const t = useT();
  const old = ["landing.speed.old.1", "landing.speed.old.2", "landing.speed.old.3", "landing.speed.old.4"] as const;
  const neu = ["landing.speed.new.1", "landing.speed.new.2", "landing.speed.new.3", "landing.speed.new.4"] as const;
  return (
    <section className="px-5 py-24 sm:px-8 lg:py-32">
      <div className="mx-auto max-w-[1200px]">
        <SectionHead center eyebrow={t("landing.speed.eyebrow")} title={t("landing.speed.title")} body={t("landing.speed.body")} />
        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          <Reveal className="rounded-[28px] border border-line bg-bg p-8 sm:p-10">
            <span className="grid size-12 place-items-center rounded-2xl bg-sunken text-mute">
              <Hourglass className="size-5" aria-hidden />
            </span>
            <h3 className="mt-6 text-2xl font-extrabold text-ink">{t("landing.speed.old.title")}</h3>
            <ul className="mt-6 space-y-3">
              {old.map((k) => (
                <li key={k} className="flex items-center gap-3 text-[15px] text-mute">
                  <CircleDot className="size-4 shrink-0 text-faint" aria-hidden />
                  {t(k)}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={180} className="relative overflow-hidden rounded-[28px] bg-navy p-8 text-white shadow-[0_30px_80px_-30px_rgba(133,218,7,0.45)] sm:p-10">
            <div aria-hidden className="av-grid pointer-events-none absolute inset-0 opacity-50" />
            <div className="relative">
              <span className="grid size-12 place-items-center rounded-2xl bg-brand text-navy">
                <Timer className="size-5" aria-hidden />
              </span>
              <h3 className="mt-6 text-2xl font-extrabold">{t("landing.speed.new.title")}</h3>
              <ul className="mt-6 space-y-3">
                {neu.map((k) => (
                  <li key={k} className="flex items-center gap-3 text-[15px] font-semibold">
                    <CircleCheck className="size-4 shrink-0 text-brand" aria-hidden />
                    {t(k)}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function Legal() {
  const t = useT();
  const laws: Array<{ year: string; title: MessageKey; body: MessageKey }> = [
    { year: "1914", title: "landing.legal.l1.title", body: "landing.legal.l1.body" },
    { year: "2023", title: "landing.legal.l2.title", body: "landing.legal.l2.body" },
    { year: "2024", title: "landing.legal.l3.title", body: "landing.legal.l3.body" },
  ];
  return (
    <section id="legal" className="scroll-mt-20 bg-bg px-5 py-24 sm:px-8 lg:py-32">
      <div className="mx-auto max-w-[1200px]">
        <SectionHead eyebrow={t("landing.legal.eyebrow")} title={t("landing.legal.title")} body={t("landing.legal.body")} />
        <ol className="mt-14 grid gap-5 lg:grid-cols-3">
          {laws.map((l, i) => (
            <Reveal as="li" delay={i * 140} key={l.year} className="rounded-[22px] border border-line bg-surface p-6 shadow-(--shadow-card) hover:-translate-y-1 hover:shadow-(--shadow-float)">
              <div className="flex items-center justify-between">
                <span className="grid size-12 place-items-center rounded-2xl bg-tile-lime text-brand-strong">
                  <Gavel className="size-5" aria-hidden />
                </span>
                <span className="font-display text-3xl font-extrabold text-ink/10">{l.year}</span>
              </div>
              <h3 className="mt-6 text-xl font-bold text-ink">{t(l.title)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-mute">{t(l.body)}</p>
            </Reveal>
          ))}
        </ol>
        <p className="mt-8 max-w-3xl text-xs leading-relaxed text-faint">{t("landing.legal.note")}</p>
      </div>
    </section>
  );
}

function Faq() {
  const t = useT();
  const items = [1, 2, 3, 4, 5] as const;
  return (
    <section id="faq" className="scroll-mt-20 bg-bg px-5 py-24 sm:px-8 lg:py-32">
      <div className="mx-auto grid max-w-[1200px] gap-14 lg:grid-cols-[0.8fr_1.2fr]">
        <SectionHead eyebrow={t("landing.faq.eyebrow")} title={t("landing.faq.title")} />
        <div className="divide-y divide-line overflow-hidden rounded-[24px] border border-line bg-surface shadow-(--shadow-card)">
          {items.map((n) => (
            <details key={n} className="group px-5 sm:px-6" open={n === 1}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-[15px] font-bold text-ink [&::-webkit-details-marker]:hidden">
                {t(`landing.faq.q${n}`)}
                <ChevronDown className="size-4 shrink-0 text-mute transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <p className="-mt-1 pb-5 text-sm leading-relaxed text-mute">{t(`landing.faq.a${n}`)}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function Roadmap() {
  const t = useT();
  const steps = [1, 2, 3, 4] as const;
  return (
    <section className="px-5 py-24 sm:px-8 lg:py-32">
      <div className="mx-auto max-w-[1200px]">
        <SectionHead center eyebrow={t("landing.roadmap.eyebrow")} title={t("landing.roadmap.title")} />
        <ol className="relative mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <span aria-hidden className="absolute left-[12%] right-[12%] top-[34px] hidden h-px bg-[repeating-linear-gradient(90deg,var(--color-line-strong)_0_6px,transparent_6px_12px)] lg:block" />
          {steps.map((n, i) => (
            <Reveal as="li" delay={i * 140} key={n} className="relative rounded-[22px] border border-line bg-surface p-6 shadow-(--shadow-card) hover:-translate-y-1 hover:shadow-(--shadow-float)">
              <span className={cx("grid size-11 place-items-center rounded-full font-display text-sm font-extrabold", n === 4 ? "bg-navy text-brand" : "bg-tile-lime text-brand-strong")}>
                {n === 4 ? <Rocket className="size-4" aria-hidden /> : `0${n}`}
              </span>
              <h3 className="mt-5 text-lg font-bold text-ink">{t(`landing.roadmap.${n}.title`)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-mute">{t(`landing.roadmap.${n}.body`)}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

function BuiltOn() {
  const t = useT();
  const stack = ["Solana", "Anchor", "SPL Token", "USDC", "Phantom", "Next.js"];
  return (
    <section className="px-5 pb-16 sm:px-8">
      <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-5 border-y border-line py-8 lg:flex-row lg:gap-8">
        <span className="shrink-0 text-xs font-bold uppercase tracking-[0.16em] text-faint">{t("landing.built.label")}</span>
        <Marquee className="w-full min-w-0 flex-1" speed={28}>
          {() =>
            [...stack, ...stack].map((s, i) => (
              <span key={i} className="mr-12 inline-flex shrink-0 items-center gap-3 font-display text-xl font-extrabold text-ink/55">
                <span className="size-1.5 rounded-full bg-brand" aria-hidden />
                {s}
              </span>
            ))
          }
        </Marquee>
        <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1.5 text-sm font-bold text-navy hover:underline">
          <Code2 className="size-4" aria-hidden />
          {t("landing.built.code")}
        </a>
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
