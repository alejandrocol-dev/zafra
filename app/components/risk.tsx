"use client";

import { ShieldAlert, ShieldCheck, ShieldX, Eye } from "lucide-react";
import { useFmt, useT, type MessageKey } from "@/lib/i18n";
import type { PositionRisk, RiskTier } from "@/lib/risk";
import { Badge, InfoTip, Notice, ProgressBar, cx, toneText, type Tone } from "@/components/ui";

export const TIER_TONE: Record<RiskTier, Tone> = {
  safe: "brand",
  watch: "warn",
  risk: "danger",
  liquidatable: "danger",
};

const TIER_LABEL: Record<RiskTier, MessageKey> = {
  safe: "risk.safe",
  watch: "risk.watch",
  risk: "risk.risk",
  liquidatable: "risk.liquidatable",
};

const TIER_ICON = {
  safe: ShieldCheck,
  watch: Eye,
  risk: ShieldAlert,
  liquidatable: ShieldX,
} as const;

/** Color + icon + word: never color alone (accessibility). */
export function RiskBadge({ tier }: { tier: RiskTier }) {
  const t = useT();
  const Icon = TIER_ICON[tier];
  return (
    <Badge tone={TIER_TONE[tier]} icon={<Icon className="size-3.5" aria-hidden />}>
      {t(TIER_LABEL[tier])}
    </Badge>
  );
}

/**
 * Position health at a glance: tier, how far the price can fall, the exact
 * liquidation price. The raw health factor is secondary (tooltip row).
 */
export function PositionGauge({
  risk,
  currentPrice,
}: {
  risk: PositionRisk;
  currentPrice: number;
}) {
  const t = useT();
  const f = useFmt();
  const tone = TIER_TONE[risk.tier];
  const pct = f.pct(Math.abs(risk.buffer), 1);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <RiskBadge tier={risk.tier} />
        <span className={cx("text-xs font-medium", toneText[tone])}>
          {risk.buffer >= 0
            ? t("risk.buffer", { pct })
            : t("risk.bufferNegative", { pct })}
        </span>
      </div>
      {/* Bar fills with the remaining buffer (0–30% of price drop). */}
      <ProgressBar value={Math.max(risk.buffer, 0) / 0.3} tone={tone} />
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="flex items-center gap-1.5 text-xs text-mute">
            {t("risk.currentPrice")}
          </p>
          <p className="font-semibold text-ink">{t("common.perTon", { price: f.usdc(currentPrice) })}</p>
        </div>
        <div>
          <p className="flex items-center gap-1.5 text-xs text-mute">
            {t("risk.liqPrice")}
            <InfoTip text={t("risk.liqPriceHint")} />
          </p>
          <p className={cx("font-semibold", toneText[tone])}>
            {t("common.perTon", { price: f.usdc(risk.liqPrice) })}
          </p>
        </div>
      </div>
      <p className="flex items-center gap-1.5 text-xs text-faint">
        {t("risk.healthFactor")}: {Number.isFinite(risk.hf) ? f.number(risk.hf, 2, 2) : "—"}
        <InfoTip text={t("risk.healthFactorHint")} />
      </p>
    </div>
  );
}

/** Proactive banner for positions that need attention. */
export function RiskBanner({ tier, action }: { tier: RiskTier; action?: React.ReactNode }) {
  const t = useT();
  if (tier === "safe" || tier === "watch") return null;
  const liq = tier === "liquidatable";
  return (
    <Notice
      tone="danger"
      title={t(liq ? "risk.banner.liq.title" : "risk.banner.risk.title")}
      action={action}
    >
      {t(liq ? "risk.banner.liq.body" : "risk.banner.risk.body")}
    </Notice>
  );
}
