"use client";

import { ZafraMark } from "./logo";
import { useI18n, useT, type MessageKey } from "@/lib/i18n";
import { useView, type View } from "@/lib/nav";
import { cx } from "@/components/ui";
import { WalletButton } from "./wallet-button";

const MAIN: Array<{ id: View; label: MessageKey }> = [
  { id: "overview", label: "nav.overview" },
  { id: "borrow", label: "nav.borrow" },
  { id: "earn", label: "nav.earn" },
];
const TOOLS: Array<{ id: View; label: MessageKey }> = [
  { id: "certifier", label: "nav.certifier" },
  { id: "admin", label: "nav.admin" },
];

function NavLink({ id, label, active, demo }: { id: View; label: string; active: boolean; demo?: boolean }) {
  return (
    <a
      href={id === "overview" ? "#" : `#${id}`}
      aria-current={active ? "page" : undefined}
      className={cx(
        "whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? demo
            ? "bg-warn/15 text-warn"
            : "bg-white/10 text-ink"
          : "text-mute hover:bg-white/5 hover:text-ink",
      )}
    >
      {label}
    </a>
  );
}

function LocaleSwitch() {
  const { locale, setLocale } = useI18n();
  return (
    <div role="group" aria-label="Language" className="flex rounded-lg border border-line-strong p-0.5 text-xs font-semibold">
      {(["en", "es"] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLocale(l)}
          aria-pressed={locale === l}
          className={cx(
            "rounded-md px-2 py-1 uppercase transition-colors",
            locale === l ? "bg-white/15 text-ink" : "text-mute hover:text-ink",
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

export function SiteHeader() {
  const t = useT();
  const [view] = useView();

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-6">
          <a href="#" className="flex items-center gap-2.5" aria-label={t("common.brand")}>
            <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-[#3ee0a5] via-brand to-[#047857] text-brand-ink shadow-sm shadow-brand/30">
              <ZafraMark className="size-6" />
            </span>
            <span className="text-lg font-bold tracking-tight text-ink">Zafra</span>
          </a>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {MAIN.map((n) => (
              <NavLink key={n.id} id={n.id} label={t(n.label)} active={view === n.id} />
            ))}
            <span className="mx-2 h-5 w-px bg-line-strong" aria-hidden />
            <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-warn/80">
              {t("nav.demoTools")}
            </span>
            {TOOLS.map((n) => (
              <NavLink key={n.id} id={n.id} label={t(n.label)} active={view === n.id} demo />
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <LocaleSwitch />
          <WalletButton />
        </div>
      </div>
      {/* Mobile nav */}
      <nav
        className="flex gap-1 overflow-x-auto border-t border-line px-4 py-2 md:hidden"
        aria-label="Main"
      >
        {MAIN.map((n) => (
          <NavLink key={n.id} id={n.id} label={t(n.label)} active={view === n.id} />
        ))}
        {TOOLS.map((n) => (
          <NavLink key={n.id} id={n.id} label={t(n.label)} active={view === n.id} demo />
        ))}
      </nav>
    </header>
  );
}
