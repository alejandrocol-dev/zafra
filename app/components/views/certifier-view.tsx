"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { CircleCheck, LoaderCircle } from "lucide-react";
import {
  zafra,
  Grain,
  isRealMode,
  suggestNextSiloId,
  type Warrant,
} from "@/lib/zafra";
import { useFmt, useT } from "@/lib/i18n";
import { useView } from "@/lib/nav";
import { useAsyncData } from "@/lib/use-async";
import { shortenAddress } from "@/lib/format";
import { TxDialog } from "@/components/tx-dialog";
import { WalletButton } from "@/components/wallet-button";
import { Button, Card, Field, Input, Notice, PageHeader, Select } from "@/components/ui";

type SiloStatus = "idle" | "checking" | "free" | "taken";

function isValidAddress(s: string): boolean {
  try {
    new PublicKey(s.trim());
    return true;
  } catch {
    return false;
  }
}

export function CertifierView() {
  const t = useT();
  const f = useFmt();
  const { publicKey } = useWallet();
  const [, setView] = useView();
  const owner = publicKey?.toBase58() ?? null;

  const [siloId, setSiloId] = useState("");
  const [tons, setTons] = useState("100");
  const [producer, setProducer] = useState("");
  const [silo, setSilo] = useState<SiloStatus>("idle");
  const [open, setOpen] = useState(false);
  const [issued, setIssued] = useState<Warrant | null>(null);

  const { data } = useAsyncData(async () => {
    const [config, warrants] = await Promise.all([zafra.getConfig(), zafra.getAllWarrants()]);
    return { config, taken: warrants.map((w) => w.siloId) };
  });
  const suggestion = data ? suggestNextSiloId(data.taken) : "";

  // Pre-fill once data is known; producer defaults to the connected wallet.
  useEffect(() => {
    if (suggestion) setSiloId((s) => s || suggestion);
  }, [suggestion]);
  useEffect(() => {
    if (owner) setProducer((p) => p || owner);
  }, [owner]);

  // Live duplicate check (debounced) against the chain.
  useEffect(() => {
    const id = siloId.trim();
    if (!id) {
      setSilo("idle");
      return;
    }
    setSilo("checking");
    let cancelled = false;
    const timer = window.setTimeout(() => {
      zafra
        .siloIdExists(id)
        .then((exists) => !cancelled && setSilo(exists ? "taken" : "free"))
        .catch(() => !cancelled && setSilo("idle"));
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [siloId, issued]);

  const tonsNum = Math.floor(Number(tons));
  const producerOk = isValidAddress(producer);
  const formOk = siloId.trim().length > 0 && tonsNum > 0 && producerOk && silo !== "taken";
  const notCertifier = isRealMode && !!data && !!owner && data.config.certifier !== owner;

  return (
    <div>
      <PageHeader title={t("cert.title")} subtitle={t("cert.subtitle")} />
      <Notice tone="warn" title={t("cert.banner.title")} className="mb-6">
        {t("cert.banner.body")}
      </Notice>

      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (formOk) setOpen(true);
            }}
          >
            <Field
              label={t("cert.silo")}
              hint={t("cert.silo.help")}
              error={
                silo === "taken"
                  ? t("cert.silo.taken", { suggestion })
                  : undefined
              }
              right={
                silo === "checking" ? (
                  <span className="flex items-center gap-1 text-xs text-mute">
                    <LoaderCircle className="size-3 animate-spin" aria-hidden />
                    {t("cert.silo.checking")}
                  </span>
                ) : silo === "free" ? (
                  <span className="flex items-center gap-1 text-xs text-brand-strong">
                    <CircleCheck className="size-3.5" aria-hidden />
                    {t("cert.silo.free")}
                  </span>
                ) : silo === "taken" && suggestion ? (
                  <button
                    type="button"
                    onClick={() => setSiloId(suggestion)}
                    className="text-xs font-medium text-brand-strong hover:underline"
                  >
                    {t("cert.silo.use", { suggestion })}
                  </button>
                ) : null
              }
            >
              <Input
                value={siloId}
                onChange={(e) => setSiloId(e.target.value)}
                aria-invalid={silo === "taken"}
                placeholder="SILO-TUC-005"
                spellCheck={false}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("cert.grain")}>
                <Select defaultValue={Grain.Soybean} disabled>
                  <option value={Grain.Soybean}>{t("status.grain.soybean")}</option>
                </Select>
              </Field>
              <Field label={t("cert.tons")} hint={t("cert.tons.help")}>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={tons}
                  onChange={(e) => setTons(e.target.value)}
                />
              </Field>
            </div>

            <Field
              label={t("cert.producer")}
              hint={t("cert.producer.help")}
              error={producer && !producerOk ? t("cert.producer.invalid") : undefined}
              right={
                owner && producer !== owner ? (
                  <button
                    type="button"
                    onClick={() => setProducer(owner)}
                    className="text-xs font-medium text-brand-strong hover:underline"
                  >
                    {t("cert.producer.useMine")}
                  </button>
                ) : null
              }
            >
              <Input
                value={producer}
                onChange={(e) => setProducer(e.target.value)}
                aria-invalid={!!producer && !producerOk}
                className="font-mono text-xs"
                spellCheck={false}
              />
            </Field>

            {owner ? (
              <Button type="submit" size="lg" className="w-full" disabled={!formOk}>
                {t("cert.cta")}
              </Button>
            ) : (
              <WalletButton size="lg" />
            )}
          </form>
        </Card>

        <div className="space-y-5 lg:col-span-2">
          {issued && (
            <Notice
              tone="brand"
              title={t("cert.issued.title")}
              action={
                <Button size="sm" onClick={() => setView("borrow")}>
                  {t("cert.issued.cta")}
                </Button>
              }
            >
              {t("cert.issued.body", { tons: f.tons(issued.tons), silo: issued.siloId })}
            </Notice>
          )}
          <Card title={t("cert.how.title")}>
            <ul className="space-y-3 text-sm text-mute">
              {(["cert.how.1", "cert.how.2", "cert.how.3"] as const).map((k) => (
                <li key={k} className="flex gap-2.5">
                  <CircleCheck className="mt-0.5 size-4 shrink-0 text-brand-strong" aria-hidden />
                  {t(k)}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <TxDialog
        open={open}
        onOpenChange={setOpen}
        title={t("cert.dialog.title", { silo: siloId.trim() })}
        description={t("cert.dialog.desc")}
        rows={[
          { label: t("cert.row.silo"), value: siloId.trim() },
          { label: t("cert.row.grain"), value: t("status.grain.soybean") },
          { label: t("cert.row.tons"), value: f.tons(tonsNum) },
          { label: t("cert.row.tokens"), value: f.number(tonsNum, 0), tone: "brand", emphasis: true },
          { label: t("cert.row.producer"), value: shortenAddress(producer.trim(), 6) },
        ]}
        blockers={[
          ...(notCertifier ? [t("cert.block.notCertifier")] : []),
          ...(silo === "taken" ? [t("cert.block.silo")] : []),
        ]}
        confirmLabel={t("cert.confirm")}
        successText={t("cert.issued.body", { tons: f.tons(tonsNum), silo: siloId.trim() })}
        nextAction={{ label: t("cert.issued.cta"), onClick: () => setView("borrow") }}
        action={async () => {
          const res = await zafra.registerWarrant({
            siloId: siloId.trim(),
            grain: Grain.Soybean,
            tons: tonsNum,
            producer: producer.trim(),
          });
          setIssued(res.warrant);
          return res;
        }}
      />
    </div>
  );
}
