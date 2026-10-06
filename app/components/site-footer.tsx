"use client";

import { ExternalLink } from "lucide-react";
import { useT } from "@/lib/i18n";
import { explorerAddressUrl } from "@/lib/format";

const PROGRAM_ID = process.env.NEXT_PUBLIC_PROGRAM_ID ?? "AERC53ZiqizgjYdJK9hCeGtSk6PfzwnEn2z3wkMKiqiJ";

export function SiteFooter() {
  const t = useT();
  return (
    <footer className="border-t border-line">
      <div className="mx-auto max-w-[1180px] space-y-3 px-4 py-8 text-xs text-faint sm:px-8">
        <p className="max-w-3xl leading-relaxed">{t("footer.disclaimer")}</p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <a
            href={explorerAddressUrl(PROGRAM_ID)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-mute hover:text-ink"
          >
            {t("footer.program")} <ExternalLink className="size-3" aria-hidden />
          </a>
          <span>{t("footer.builtFor")}</span>
        </div>
      </div>
    </footer>
  );
}
