"use client";

import { FlaskConical } from "lucide-react";
import { useT } from "@/lib/i18n";

export function Banner() {
  const t = useT();
  return (
    <div className="border-b border-warn/20 bg-warn/10 text-warn">
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-4 py-1.5 text-center text-xs font-medium">
        <FlaskConical className="size-3.5 shrink-0" aria-hidden />
        <span>{t("banner.text")}</span>
        <span className="hidden text-warn/70 sm:inline">· {t("banner.detail")}</span>
      </div>
    </div>
  );
}
