"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { CircleCheck, TriangleAlert } from "lucide-react";
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
  Notice,
  PageHeader,
  ProgressBar,
  Skeleton,
  Stat,
  StatGrid,
} from "@/components/ui";

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

          <div className="grid gap-5 sm:grid-cols-2">
            <Card title={t("earn.how.title")}>
              <ul className="space-y-3 text-sm text-mute">
                {(["earn.how.1", "earn.how.2", "earn.how.3"] as const).map((k) => (
                  <li key={k} className="flex gap-2.5">
                    <CircleCheck className="mt-0.5 size-4 shrink-0 text-brand-strong" aria-hidden />
                    {t(k)}
                  </li>
                ))}
              </ul>
            </Card>
            <Card tour="earn-risk" title={t("earn.risk.title")} tone="warn">
              <div className="flex gap-2.5 text-sm text-mute">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
                <p>{t("earn.risk.body")}</p>
              </div>
            </Card>
          </div>
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
  return (
    <div className="space-y-5">
      <StatGrid>
        <Stat label={t("earn.stat.total")} value={f.usdcRound(stats.totalLiquidity)} />
        <Stat label={t("earn.stat.debt")} value={f.usdcRound(stats.outstandingDebt)} />
        <Stat label={t("earn.stat.available")} value={f.usdcRound(stats.available)} />
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
        <ProgressBar value={stats.utilizationBps / 10_000} />
      </div>
    </div>
  );
}
