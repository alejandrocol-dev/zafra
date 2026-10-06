"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { ChevronDown, TrendingDown, Undo2 } from "lucide-react";
import {
  zafra,
  DEFAULT_PRICE_PER_TON,
  isRealMode,
  type Config,
  type OpenLoan,
} from "@/lib/zafra";
import { shortenAddress } from "@/lib/format";
import { useFmt, useT } from "@/lib/i18n";
import { positionRisk } from "@/lib/risk";
import { useAsyncData } from "@/lib/use-async";
import { RiskBadge } from "@/components/risk";
import { TxDialog } from "@/components/tx-dialog";
import {
  AmountInput,
  Button,
  Card,
  ExplorerLink,
  Field,
  Notice,
  PageHeader,
  Rows,
  Skeleton,
} from "@/components/ui";

const round2 = (n: number) => Math.round(n * 100) / 100;

export function AdminView() {
  const t = useT();
  const f = useFmt();
  const { publicKey } = useWallet();
  const owner = publicKey?.toBase58() ?? null;
  const [newPrice, setNewPrice] = useState<number | null>(null);
  const [custom, setCustom] = useState("");
  const [liquidating, setLiquidating] = useState<OpenLoan | null>(null);

  const { data, loading, error, reload } = useAsyncData(async () => {
    const [config, loans] = await Promise.all([zafra.getConfig(), zafra.getOpenLoans()]);
    return { config, loans };
  });

  const loadError = error && !data ? (
    <Notice
      tone="warn"
      action={
        <Button size="sm" variant="secondary" onClick={reload}>
          {t("common.retry")}
        </Button>
      }
    >
      {t("common.loadError")}
    </Notice>
  ) : null;

  const notAdmin = isRealMode && !!data && !!owner && data.config.admin !== owner;
  const customNum = Number(custom.replace(",", "."));
  const customValid = Number.isFinite(customNum) && customNum > 0;

  return (
    <div>
      <PageHeader title={t("admin.title")} />
      <Notice tour="admin-oracle" tone="warn" title={t("admin.banner.title")} className="mb-6">
        {t("admin.banner.body")}
      </Notice>

      <div className="grid gap-5 lg:grid-cols-5">
        <Card tour="admin-price" title={t("admin.price.title")} className="lg:col-span-2">
          {loading && !data ? (
            <Skeleton className="h-48" />
          ) : loadError ? (
            loadError
          ) : data ? (
            <div className="space-y-5">
              <div>
                <p className="text-xs text-mute">{t("admin.price.current")}</p>
                <p className="text-4xl font-bold tracking-tight text-ink">
                  {f.usdc(data.config.pricePerTon)}
                  <span className="ml-1 text-base font-medium text-mute">/ t</span>
                </p>
              </div>
              <div className="space-y-2">
                <Button
                  variant="danger"
                  className="w-full"
                  onClick={() => setNewPrice(round2(data.config.pricePerTon * 0.7))}
                >
                  <TrendingDown className="size-4" aria-hidden />
                  {t("admin.price.drop")}
                </Button>
                <Button
                  variant="secondary"
                  className="w-full"
                  disabled={data.config.pricePerTon === DEFAULT_PRICE_PER_TON}
                  onClick={() => setNewPrice(DEFAULT_PRICE_PER_TON)}
                >
                  <Undo2 className="size-4" aria-hidden />
                  {t("admin.price.reset", { price: f.usdc(DEFAULT_PRICE_PER_TON) })}
                </Button>
              </div>
              <form
                className="space-y-3 border-t border-line pt-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (customValid) setNewPrice(customNum);
                }}
              >
                <Field label={t("admin.price.custom")}>
                  <AmountInput
                    value={custom}
                    onChange={(e) => setCustom(e.target.value)}
                    placeholder={String(data.config.pricePerTon)}
                    suffix="USDC / t"
                    aria-label={t("admin.price.input")}
                  />
                </Field>
                <Button type="submit" variant="secondary" className="w-full" disabled={!customValid}>
                  {t("admin.price.set")}
                </Button>
              </form>
            </div>
          ) : null}
        </Card>

        <Card
          tour="admin-loans"
          title={t("admin.loans.title")}
          subtitle={t("admin.loans.subtitle")}
          className="lg:col-span-3"
        >
          {loading && !data ? (
            <Skeleton className="h-48" />
          ) : loadError ? (
            loadError
          ) : data && data.loans.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line-strong px-4 py-8 text-center text-sm text-mute">
              {t("admin.loans.empty")}
            </p>
          ) : data ? (
            <ul className="space-y-3">
              {data.loans.map((ol) => (
                <LoanRow key={ol.loan.address} openLoan={ol} config={data.config} onLiquidate={setLiquidating} />
              ))}
            </ul>
          ) : null}
        </Card>
      </div>

      {data && (
        <details className="group mt-5 rounded-(--radius-card) border border-line bg-surface">
          <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm font-semibold text-ink">
            {t("admin.config.title")}
            <ChevronDown className="size-4 text-mute transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="px-5 pb-5">
            <Rows
              rows={[
                { label: t("admin.config.admin"), value: <ExplorerLink kind="address" value={data.config.admin} /> },
                { label: t("admin.config.certifier"), value: <ExplorerLink kind="address" value={data.config.certifier} /> },
                { label: t("admin.config.usdcMint"), value: <ExplorerLink kind="address" value={data.config.usdcMint} /> },
                { label: t("admin.config.ltv"), value: f.bps(data.config.ltvBps) },
                { label: t("admin.config.liq"), value: f.bps(data.config.liqThresholdBps) },
                { label: t("admin.config.fee"), value: f.bps(data.config.feeBps) },
                { label: t("admin.config.apr"), value: f.bps(data.config.annualInterestBps) },
              ]}
            />
          </div>
        </details>
      )}

      {data && newPrice !== null && (
        <TxDialog
          open
          onOpenChange={(o) => !o && setNewPrice(null)}
          title={t("admin.price.dialog.title")}
          description={t("admin.price.dialog.desc")}
          rows={[
            { label: t("admin.price.row.from"), value: f.usdc(data.config.pricePerTon) },
            { label: t("admin.price.row.to"), value: f.usdc(newPrice), emphasis: true },
            {
              label: t("admin.price.row.change"),
              value: f.pct(newPrice / data.config.pricePerTon - 1),
              tone: newPrice < data.config.pricePerTon ? "danger" : "brand",
            },
          ]}
          warnings={
            newPrice < data.config.pricePerTon
              ? [{ tone: "warn", text: t("admin.price.warn.drop") }]
              : []
          }
          blockers={notAdmin ? [t("admin.block.notAdmin")] : []}
          confirmLabel={t("admin.price.confirm", { price: f.usdc(newPrice) })}
          successText={t("admin.price.success", { price: f.usdc(newPrice) })}
          action={() => zafra.setPrice(newPrice)}
          onSuccess={() => setCustom("")}
        />
      )}

      {data && liquidating && (
        <LiquidateDialog
          openLoan={liquidating}
          config={data.config}
          onClose={() => setLiquidating(null)}
        />
      )}
    </div>
  );
}

function LoanRow({
  openLoan,
  config,
  onLiquidate,
}: {
  openLoan: OpenLoan;
  config: Config;
  onLiquidate: (o: OpenLoan) => void;
}) {
  const t = useT();
  const f = useFmt();
  const { warrant, loan } = openLoan;
  const risk = positionRisk(warrant, loan, config);
  const liquidatable = risk.tier === "liquidatable";

  return (
    <li className="rounded-xl border border-line bg-sunken p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-ink">
            {warrant.siloId}{" "}
            <span className="font-normal text-mute">· {f.tons(warrant.tons)}</span>
          </p>
          <p className="mt-0.5 text-xs text-faint">
            {t("admin.loans.borrower")}: <span className="font-mono">{shortenAddress(loan.borrower)}</span>
          </p>
        </div>
        <RiskBadge tier={risk.tier} />
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-xs text-mute">{t("admin.loans.collateral")}</dt>
          <dd className="font-medium text-ink">{f.usdc(risk.value)}</dd>
        </div>
        <div>
          <dt className="text-xs text-mute">{t("admin.loans.debt")}</dt>
          <dd className="font-medium text-ink">{f.usdc(risk.debt)}</dd>
        </div>
        <div>
          <dt className="text-xs text-mute">{t("risk.liqPrice")}</dt>
          <dd className="font-medium text-ink">{t("common.perTon", { price: f.usdc(risk.liqPrice) })}</dd>
        </div>
      </dl>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-faint">
          {liquidatable ? "" : t("admin.loans.healthy")}
        </p>
        <Button
          size="sm"
          variant={liquidatable ? "danger" : "secondary"}
          disabled={!liquidatable}
          onClick={() => onLiquidate(openLoan)}
        >
          {t("admin.loans.liquidate")}
        </Button>
      </div>
    </li>
  );
}

function LiquidateDialog({
  openLoan,
  config,
  onClose,
}: {
  openLoan: OpenLoan;
  config: Config;
  onClose: () => void;
}) {
  const t = useT();
  const f = useFmt();
  const { warrant, loan } = openLoan;
  const risk = positionRisk(warrant, loan, config);
  return (
    <TxDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={t("admin.liq.dialog.title", { silo: warrant.siloId })}
      description={t("admin.liq.dialog.desc")}
      rows={[
        { label: t("admin.liq.row.collateral"), value: `${f.tons(warrant.tons)} · ${warrant.siloId}` },
        { label: t("admin.liq.row.value"), value: f.usdc(risk.value) },
        { label: t("admin.liq.row.debt"), value: f.usdc(risk.debt) },
        {
          label: t("admin.liq.row.health"),
          value: Number.isFinite(risk.hf) ? f.number(risk.hf, 2, 2) : "—",
          tone: "danger",
        },
      ]}
      warnings={[{ tone: "warn", text: t("admin.liq.warn") }]}
      confirmLabel={t("admin.liq.confirm", { silo: warrant.siloId })}
      successText={t("admin.liq.success", { silo: warrant.siloId })}
      action={() => zafra.liquidate(warrant.address)}
    />
  );
}
