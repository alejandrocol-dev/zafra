"use client";

import { useI18n } from "@/lib/i18n";
import { cx } from "@/components/ui";

export function LocaleSwitch({ dark = false }: { dark?: boolean }) {
  const { locale, setLocale } = useI18n();
  return (
    <div
      role="group"
      aria-label="Language"
      className={cx(
        "flex rounded-lg border p-0.5 text-xs font-semibold",
        dark ? "border-white/20 bg-white/5" : "border-line-strong bg-surface",
      )}
    >
      {(["en", "es"] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLocale(l)}
          aria-pressed={locale === l}
          className={cx(
            "rounded-md px-2 py-1 uppercase transition-colors",
            locale === l
              ? dark
                ? "bg-white text-navy"
                : "bg-navy text-white"
              : dark
                ? "text-white/70 hover:text-white"
                : "text-mute hover:text-ink",
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
