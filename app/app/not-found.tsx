"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n";
import { ZafraLockup } from "@/components/logo";

export default function NotFound() {
  const t = useT();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <ZafraLockup />
      <h1 className="font-display text-2xl font-extrabold text-ink">{t("nf.title")}</h1>
      <p className="max-w-sm text-sm text-mute">{t("nf.body")}</p>
      <Link
        href="/"
        className="inline-flex h-10 items-center rounded-xl bg-navy px-4 text-sm font-semibold text-white hover:bg-navy-soft"
      >
        {t("nf.cta")}
      </Link>
    </div>
  );
}
