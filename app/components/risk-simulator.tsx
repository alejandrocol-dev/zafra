"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { DEFAULT_PRICE_PER_TON, type Config } from "@/lib/zafra";
import { useFmt, useT } from "@/lib/i18n";
import { useInView, useReducedMotion } from "@/lib/use-motion";
import { priceBuffer, riskTier } from "@/lib/risk";
import { RiskBadge, TIER_TONE } from "@/components/risk";
import { cx, toneText } from "@/components/ui";

const TONS = 100;
const MAX = 480;
const W = 600;
const H = 230;
const PAD_X = 8;

const TIER_COLOR = {
  safe: "var(--color-brand-strong)",
  watch: "var(--color-warn)",
  risk: "var(--color-danger)",
  liquidatable: "var(--color-danger)",
} as const;

/**
 * "What if the grain price moves?" for a loan of 100 t of soy opened at the
 * current oracle price (or the 380 reference before config loads). Pure math
 * with the contract's own parameters: collateral value vs. the liquidation
 * threshold (debt ÷ liq %).
 */
export function RiskSimulator({
  config,
  oraclePrice,
}: {
  config?: Config | null;
  oraclePrice?: number | null;
}) {
  const t = useT();
  const f = useFmt();
  const gid = useId();
  const ltv = config?.ltvBps ?? 7000;
  const liq = config?.liqThresholdBps ?? 8000;
  const base = oraclePrice ?? DEFAULT_PRICE_PER_TON;
  const principal = (TONS * base * ltv) / 10_000;
  const threshold = (principal * 10_000) / liq;
  const liqPrice = threshold / TONS;
  // Axis always reaches below the liquidation price so the zone is reachable.
  const min = Math.max(40, Math.min(200, Math.floor((liqPrice - 25) / 10) * 10, Math.floor((base - 80) / 10) * 10));
  const clamp = (p: number) => Math.min(MAX, Math.max(min, Math.round(p)));
  const [picked, setPicked] = useState<number | null>(null);
  const [auto, setAuto] = useState(true);
  const [wrapRef, inView] = useInView<HTMLDivElement>("200px");
  const reduced = useReducedMotion();
  const price = picked ?? clamp(oraclePrice ?? base);
  const priceRef = useRef(price);
  const resumeRef = useRef<number | null>(null);
  const cycleRef = useRef(0);
  const lineRef = useRef<SVGGElement>(null);
  const dotRef = useRef<SVGGElement>(null);
  useEffect(() => {
    priceRef.current = price;
  }, [price]);

  // Keep the marker aligned when the autoplay doesn't own it (paused, manual
  // drag, reduced motion, first mount before the section scrolls into view).
  useEffect(() => {
    if (auto && inView && !reduced) return;
    lineRef.current?.setAttribute("transform", `translate(${x(price)} 0)`);
    dotRef.current?.setAttribute("transform", `translate(${x(price)} ${y(TONS * price)})`);
  });

  // Self-running demo: swings the price up (safe) then crashes it past the
  // liquidation line, on a loop. Grabbing the slider pauses it; the demo
  // resumes by itself a few seconds later, easing back from wherever it was.
  useEffect(() => () => {
    if (resumeRef.current) window.clearTimeout(resumeRef.current);
  }, []);

  useEffect(() => {
    if (!auto || !inView || reduced) return;
    const base_ = clamp(base);
    const hi = Math.min(MAX - 10, Math.max(430, base_ + 90));
    const lo = Math.max(min + 4, Math.round(liqPrice - 25));
    const KEYS: Array<[number, number]> = [
      [0, base_], [600, base_], [3400, hi], [4700, hi],
      [8300, lo], [10100, lo], [12500, base_], [15000, base_],
    ];
    const TOTAL = KEYS[KEYS.length - 1][0];
    const ease = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
    // The cycle position lives in a ref that survives effect restarts (dep
    // changes, StrictMode remounts), so a restart continues mid-cycle instead
    // of rewinding to the start — no visible jump back to the base price.
    let phase = cycleRef.current % TOTAL;
    const blendStart = performance.now();
    let lastNow = blendStart;
    const blendFrom = priceRef.current;
    let lastSet = 0;
    const step = () => {
      const now = performance.now();
      // Delta-time advance: immune to timer jitter, pauses while the tab is
      // hidden, resumes exactly where it left off.
      if (!document.hidden) phase += now - lastNow;
      lastNow = now;
      const time = phase % TOTAL;
      cycleRef.current = time;
      // Last keyframe whose start is <= time → the segment that contains it.
      let i = KEYS.length - 2;
      while (i > 0 && time < KEYS[i][0]) i--;
      const [t0, p0] = KEYS[i];
      const [t1, p1] = KEYS[i + 1];
      const p = t1 === t0 ? 0 : Math.min(1, (time - t0) / (t1 - t0));
      const target = p0 + (p1 - p0) * ease(p);
      // Short blend from the current on-screen value (after a drag, a restart,
      // or a resume) into the cycle position — the marker never teleports.
      const b = ease(Math.min(1, (now - blendStart) / 700));
      const anim = blendFrom + (target - blendFrom) * b;
      const xv = x(anim);
      lineRef.current?.setAttribute("transform", `translate(${xv} 0)`);
      dotRef.current?.setAttribute("transform", `translate(${xv} ${y(TONS * anim)})`);
      if (now - lastSet > 80) {
        lastSet = now;
        setPicked(Math.round(anim));
      }
    };
    const id = window.setInterval(step, 33);
    step();
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, inView, reduced, base, liqPrice, min]);

  const value = TONS * price;
  const hf = (value * liq) / 10_000 / principal;
  const tier = riskTier(hf);
  const buffer = priceBuffer(hf);
  const change = price / base - 1;

  const vmax = TONS * MAX * 1.08;
  const x = (p: number) => PAD_X + ((p - min) / (MAX - min)) * (W - PAD_X * 2);
  const y = (v: number) => H - (v / vmax) * H;
  const line = `M ${x(min)} ${y(TONS * min)} L ${x(MAX)} ${y(TONS * MAX)}`;
  const area = `${line} L ${x(MAX)} ${H} L ${x(min)} ${H} Z`;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / 60) * 60; v <= MAX; v += 60) ticks.push(v);

  return (
    <div ref={wrapRef} className="grid gap-6 lg:grid-cols-[1fr_260px]">
      <div>
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H + 24}`} className="h-auto w-full overflow-visible" role="img" aria-label={t("sim.title")}>
            <defs>
              <linearGradient id={`${gid}a`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--color-brand)" stopOpacity="0.35" />
                <stop offset="100%" stopColor="var(--color-brand)" stopOpacity="0.02" />
              </linearGradient>
              <pattern id={`${gid}p`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="8" stroke="var(--color-danger)" strokeOpacity="0.14" strokeWidth="3" />
              </pattern>
            </defs>
            {liqPrice > min && (
              <>
                <rect x={x(min)} y={0} width={x(Math.min(liqPrice, MAX)) - x(min)} height={H} fill={`url(#${gid}p)`} />
                {x(liqPrice) - x(min) > 120 && (
                  <text x={x(liqPrice) - 8} y={H - 10} textAnchor="end" className="fill-danger text-[11px] font-semibold">
                    {t("sim.zone")}
                  </text>
                )}
              </>
            )}
            {[0.25, 0.5, 0.75].map((g) => (
              <line key={g} x1={0} x2={W} y1={H * g} y2={H * g} stroke="var(--color-line)" />
            ))}
            <path d={area} fill={`url(#${gid}a)`} />
            <path d={line} fill="none" stroke="var(--color-brand-strong)" strokeWidth="2.5" />
            <line x1={0} x2={W} y1={y(threshold)} y2={y(threshold)} stroke="var(--color-danger)" strokeWidth="1.5" strokeDasharray="6 5" />
            <text x={W - 4} y={y(threshold) - 6} textAnchor="end" className="fill-danger text-[11px] font-semibold">
              {t("sim.legend.threshold")} · {f.usdcRound(threshold)}
            </text>
            <line x1={0} x2={W} y1={y(principal)} y2={y(principal)} stroke="var(--color-navy)" strokeOpacity="0.35" strokeWidth="1.5" strokeDasharray="2 4" />
            <text x={W - 4} y={y(principal) + 15} textAnchor="end" className="fill-mute text-[11px] font-medium">
              {t("sim.debt")} · {f.usdcRound(principal)}
            </text>
            <line x1={x(base)} x2={x(base)} y1={H - 6} y2={H} stroke="var(--color-navy)" strokeWidth="2" />
            <g ref={lineRef}>
              <line x1={0} x2={0} y1={0} y2={H} stroke={TIER_COLOR[tier]} strokeOpacity="0.5" strokeWidth="1.5" />
            </g>
            <g ref={dotRef}>
              <circle r="9" fill={TIER_COLOR[tier]} fillOpacity="0.18" />
              <circle r="5" fill="#fff" stroke={TIER_COLOR[tier]} strokeWidth="2.5" />
            </g>
            <line x1={0} x2={W} y1={H} y2={H} stroke="var(--color-line-strong)" />
            {ticks.map((p) => (
              <text key={p} x={x(p)} y={H + 18} textAnchor="middle" className={cx("text-[11px]", p === Math.round(base) ? "fill-ink font-semibold" : "fill-faint")}>
                {p}
              </text>
            ))}
          </svg>
        </div>
        <label className="mt-4 block">
          <span className="sr-only">{t("sim.price")}</span>
          <input
            type="range"
            min={min}
            max={MAX}
            step={1}
            value={price}
            onChange={(e) => {
              setAuto(false);
              setPicked(Number(e.target.value));
              if (resumeRef.current) window.clearTimeout(resumeRef.current);
              resumeRef.current = window.setTimeout(() => setAuto(true), 4000);
            }}
            className="w-full cursor-pointer"
          />
        </label>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-faint">
          <span>{t("sim.axis")}</span>
          <span className="flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                setAuto((a) => {
                  if (resumeRef.current) window.clearTimeout(resumeRef.current);
                  return !a;
                })
              }
              aria-pressed={auto}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 font-medium text-mute transition-colors hover:border-line-strong hover:text-ink"
            >
              {auto ? <Pause className="size-3" aria-hidden /> : <Play className="size-3" aria-hidden />}
              {auto ? t("sim.pause") : t("sim.play")}
            </button>
            {oraclePrice != null && (
              <button
                type="button"
                onClick={() => {
                  setPicked(null);
                  setAuto(true);
                }}
                className="inline-flex items-center gap-1 font-medium text-mute hover:text-ink"
              >
                <RotateCcw className="size-3" aria-hidden />
                {t("sim.reset", { price: f.number(oraclePrice, 0) })}
              </button>
            )}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <div className={cx("rounded-2xl p-4 text-white transition-colors duration-500", tier === "liquidatable" ? "bg-[#3d0d1a]" : "bg-navy")}>
          <p className="text-xs font-medium text-white/60">{t("sim.price")}</p>
          <p className="mt-1 font-display text-3xl font-extrabold tracking-tight">
            {f.number(price, 0)} <span className="text-base font-semibold text-white/60">USDC/t</span>
          </p>
          <p className={cx("mt-1 text-xs font-semibold", change < 0 ? "text-[#ff8fa3]" : "text-brand")}>
            {change >= 0 ? "+" : ""}
            {f.pct(change, 1)} {t("sim.vsBase")}
          </p>
        </div>
        <dl className="divide-y divide-line rounded-2xl border border-line bg-surface">
          <Row label={t("sim.collateral")} value={f.usdcRound(value)} />
          <Row label={t("sim.debt")} value={f.usdcRound(principal)} />
          <Row label={t("risk.liqPrice")} value={`${f.number(liqPrice, 2, 2)} USDC/t`} />
        </dl>
        <div className={cx("flex flex-col gap-2 rounded-2xl border p-4 transition-colors duration-500", tier === "liquidatable" ? "border-danger/60 bg-danger/[0.05]" : "border-line bg-surface")}>
          <RiskBadge tier={tier} />
          <p className={cx("text-xs font-medium", toneText[TIER_TONE[tier]])}>
            {buffer >= 0
              ? t("risk.buffer", { pct: f.pct(buffer, 1) })
              : t("risk.bufferNegative", { pct: f.pct(Math.abs(buffer), 1) })}
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
      <dt className="text-xs text-mute">{label}</dt>
      <dd className="text-sm font-semibold text-ink tabular-nums">{value}</dd>
    </div>
  );
}
