"use client";

import { useId, useState } from "react";
import { RotateCcw } from "lucide-react";
import { DEFAULT_PRICE_PER_TON, type Config } from "@/lib/zafra";
import { useFmt, useT } from "@/lib/i18n";
import { priceBuffer, riskTier } from "@/lib/risk";
import { RiskBadge, TIER_TONE } from "@/components/risk";
import { cx, toneText } from "@/components/ui";

const TONS = 100;
const MIN = 200;
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
 * "What if the grain price moves?" for the canonical demo loan (100 t of soy
 * taken at the 380 reference price). Pure math with the contract's own
 * parameters: collateral value vs. the liquidation threshold (debt ÷ liq %).
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
  const base = DEFAULT_PRICE_PER_TON;
  const clamp = (p: number) => Math.min(MAX, Math.max(MIN, Math.round(p)));
  const [picked, setPicked] = useState<number | null>(null);
  const price = picked ?? clamp(oraclePrice ?? base);

  const principal = (TONS * base * ltv) / 10_000;
  const threshold = (principal * 10_000) / liq;
  const liqPrice = threshold / TONS;
  const value = TONS * price;
  const hf = (value * liq) / 10_000 / principal;
  const tier = riskTier(hf);
  const buffer = priceBuffer(hf);
  const change = price / base - 1;

  const vmax = TONS * MAX * 1.08;
  const x = (p: number) => PAD_X + ((p - MIN) / (MAX - MIN)) * (W - PAD_X * 2);
  const y = (v: number) => H - (v / vmax) * H;
  const line = `M ${x(MIN)} ${y(TONS * MIN)} L ${x(MAX)} ${y(TONS * MAX)}`;
  const area = `${line} L ${x(MAX)} ${H} L ${x(MIN)} ${H} Z`;
  const ticks = [200, 260, 320, 380, 440, 480];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
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
            <rect x={x(MIN)} y={0} width={x(liqPrice) - x(MIN)} height={H} fill={`url(#${gid}p)`} />
            <text x={x(liqPrice) - 8} y={H - 10} textAnchor="end" className="fill-danger text-[11px] font-semibold">
              {t("sim.zone")}
            </text>
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
            <line x1={x(price)} x2={x(price)} y1={0} y2={H} stroke={TIER_COLOR[tier]} strokeOpacity="0.5" strokeWidth="1.5" />
            <circle cx={x(price)} cy={y(value)} r="9" fill={TIER_COLOR[tier]} fillOpacity="0.18" />
            <circle cx={x(price)} cy={y(value)} r="5" fill="#fff" stroke={TIER_COLOR[tier]} strokeWidth="2.5" />
            <line x1={0} x2={W} y1={H} y2={H} stroke="var(--color-line-strong)" />
            {ticks.map((p) => (
              <text key={p} x={x(p)} y={H + 18} textAnchor="middle" className={cx("text-[11px]", p === base ? "fill-ink font-semibold" : "fill-faint")}>
                {p}
              </text>
            ))}
          </svg>
        </div>
        <label className="mt-4 block">
          <span className="sr-only">{t("sim.price")}</span>
          <input
            type="range"
            min={MIN}
            max={MAX}
            step={1}
            value={price}
            onChange={(e) => setPicked(Number(e.target.value))}
            className="w-full cursor-pointer"
          />
        </label>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-faint">
          <span>{t("sim.axis")}</span>
          {oraclePrice != null && (
            <button
              type="button"
              onClick={() => setPicked(null)}
              className="inline-flex items-center gap-1 font-medium text-mute hover:text-ink"
            >
              <RotateCcw className="size-3" aria-hidden />
              {t("sim.reset", { price: f.number(oraclePrice, 0) })}
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="rounded-2xl bg-navy p-4 text-white">
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
        <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4">
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
