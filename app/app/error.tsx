"use client";

import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  const t = useT();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-display text-2xl font-extrabold text-ink">{t("fatal.title")}</h1>
      <p className="max-w-sm text-sm text-mute">{t("fatal.body")}</p>
      <Button onClick={reset}>{t("fatal.retry")}</Button>
    </div>
  );
}
