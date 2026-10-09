"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Coins, TrendingUp, Wheat } from "lucide-react";
import { zafra, type Config, type PoolStats } from "@/lib/zafra";
import { MIN_SOL_FOR_FEES } from "@/lib/constants";
import { useFmt, useT } from "@/lib/i18n";
import { useAsyncData } from "@/lib/use-async";
import { TxDialog } from "@/components/tx-dialog";
import { WalletButton } from "@/components/wallet-button";
import {
  AmountInput,
  Button,
  Card,
  Field,
  IconTile,
  Notice,
  PageHeader,
  Skeleton,
  Stat,
  StatGrid,
} from "@/components/ui";

const HOW: Array<{ key: "earn.how.1" | "earn.how.2" | "earn.how.3"; icon: typeof Coins; tone: "lime" | "sky" | "amber" }> = [
  { key: "earn.how.1", icon: Coins, tone: "lime" },
  { key: "earn.how.2", icon: TrendingUp, tone: "sky" },
  { key: "earn.how.3", icon: Wheat, tone: "amber" },
];

export function InvestorView() {
  const t = useT();
  const f = useFmt();
  const { publicKey } = useWallet();
  const owner = publicKey?.toBase58() ?? null;
  const [amount, setAmount] = useState("");
  const [open, setOpen] = useState(false);

  const { data, loading, error, reload } = useAsyncData(async () => {
    const [stats, config, balances] = await Promise.all([
      zafra.getPoolStats(),
      zafra.getConfig(),
      owner ? zafra.getWalletBalances(owner) : Promise.resolve(null),
    ]);
    return { stats, config, balances };
  }, owner);

  const amountNum = Number(amount.replace(",", "."));
  const valid = Number.isFinite(amountNum) && amountNum > 0;
  const balance = data?.balances?.usdc ?? 0;

  return (
    <div>
      <PageHeader title={t("earn.title")} subtitle={t("earn.subtitle")} />

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-3">
          <Card tour="earn-pool" title={t("earn.pool.title")}>
            {loading && !data ? (
              <Skeleton className="h-40" />
            ) : error ? (
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
            ) : data ? (
              <PoolOverview stats={data.stats} config={data.config} />
            ) : null}
          </Card>

          <Card title={t("earn.how.title")}>
            <div className="grid gap-4 sm:grid-cols-3">
              {HOW.map((s) => (
                <div key={s.key} className="flex items-start gap-3 sm:flex-col sm:gap-2.5">
                  <IconTile icon={s.icon} tone={s.tone} />
                  <p className="text-sm leading-snug text-mute">{t(s.key)}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card tour="earn-deposit" title={t("earn.deposit.title")} className="lg:sticky lg:top-24">
            {!owner ? (
              <div className="space-y-4">
                <Notice tone="info">{t("earn.connect.body")}</Notice>
                <WalletButton size="lg" />
              </div>
            ) : (
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (valid) setOpen(true);
                }}
              >
                <Field
                  label={t("earn.deposit.amount")}
                  hint={t("earn.deposit.help")}
                  right={
                    <span className="text-xs text-mute">
                      {t("earn.deposit.balance", { balance: f.usdc(balance) })}
                    </span>
                  }
                >
                  <AmountInput
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    suffix="USDC"
                    onMax={() => setAmount(String(Math.floor(balance * 100) / 100))}
                  />
                </Field>
                <Button type="submit" size="lg" className="w-full" disabled={!valid}>
                  {t("earn.deposit.cta")}
                </Button>
              </form>
            )}
          </Card>
        </div>
      </div>

      {data && (
        <TxDialog
          open={open}
          onOpenChange={setOpen}
          title={t("earn.dialog.title", { amount: f.usdc(amountNum) })}
          description={t("earn.dialog.desc")}
          rows={[
            { label: t("earn.row.deposit"), value: f.usdc(amountNum), emphasis: true, tone: "brand" },
            {
              label: t("earn.row.poolAfter"),
              value: f.usdc(data.stats.totalLiquidity + amountNum),
            },
            {
              label: t("earn.row.yield"),
              value: f.bps((data.config.annualInterestBps * data.stats.utilizationBps) / 10_000),
            },
          ]}
          warnings={[{ tone: "warn", text: t("earn.risk.body") }]}
          ack={t("earn.ack")}
          blockers={[
            ...(amountNum > balance ? [t("earn.block.balance", { have: f.usdc(balance) })] : []),
            ...(data.balances && data.balances.sol < MIN_SOL_FOR_FEES ? [t("borrow.block.sol")] : []),
          ]}
          confirmLabel={t("earn.confirm", { amount: f.usdc(amountNum) })}
          successText={t("earn.success", { amount: f.usdc(amountNum, false) })}
          action={() => zafra.depositLiquidity(amountNum)}
          onSuccess={() => setAmount("")}
        />
      )}
    </div>
  );
}

function PoolOverview({ stats, config }: { stats: PoolStats; config: Config }) {
  const t = useT();
  const f = useFmt();
  const apy = (config.annualInterestBps * stats.utilizationBps) / 10_000;
  const total = Math.max(stats.totalLiquidity, 1);
  const debtPct = Math.min(100, (stats.outstandingDebt / total) * 100);
  return (
    <div className="space-y-5">
      <StatGrid cols={2}>
        <Stat label={t("earn.stat.total")} value={f.usdcRound(stats.totalLiquidity)} />
        <Stat
          label={t("earn.stat.apy")}
          value={f.bps(apy)}
          hint={t("earn.stat.apyHint")}
        />
      </StatGrid>
      <div>
        <div className="mb-1.5 flex items-baseline justify-between text-sm">
          <span className="text-mute">{t("earn.utilization")}</span>
          <span className="font-semibold text-ink">{f.bps(stats.utilizationBps)}</span>
        </div>
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-sunken">
          <div className="h-full bg-navy transition-all duration-500" style={{ width: `${debtPct}%` }} />
          <div className="h-full flex-1 bg-brand/70" />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-mute">
          <span className="inline-flex items-center gap-1.5">
            <i className="size-2 rounded-sm bg-navy" aria-hidden />
            {t("earn.stat.debt")} · {f.usdcRound(stats.outstandingDebt)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="size-2 rounded-sm bg-brand/70" aria-hidden />
            {t("earn.stat.available")} · {f.usdcRound(stats.available)}
          </span>
        </div>
      </div>
    </div>
  );
}
