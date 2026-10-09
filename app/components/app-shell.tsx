"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Coins,
  Compass,
  ExternalLink,
  LayoutDashboard,
  SlidersHorizontal,
  Stamp,
  Vault,
  type LucideIcon,
} from "lucide-react";
import { useT, type MessageKey } from "@/lib/i18n";
import { useView, type View } from "@/lib/nav";
import { PROGRAM_ID } from "@/lib/constants";
import { explorerAddressUrl, shortenAddress } from "@/lib/format";
import { cx } from "@/components/ui";
import { GuidedTour, useTourAutoStart } from "./guided-tour";
import { LocaleSwitch } from "./locale-switch";
import { ZafraLockup, ZafraMark } from "./logo";
import { SiteFooter } from "./site-footer";
import { WalletButton } from "./wallet-button";

type Item = { id: View; label: MessageKey; icon: LucideIcon };
const MAIN: Item[] = [
  { id: "overview", label: "nav.overview", icon: LayoutDashboard },
  { id: "borrow", label: "nav.borrow", icon: Coins },
  { id: "earn", label: "nav.earn", icon: Vault },
];
const TOOLS: Item[] = [
  { id: "certifier", label: "nav.certifier", icon: Stamp },
  { id: "admin", label: "nav.admin", icon: SlidersHorizontal },
];

function SideLink({ item, active, demo }: { item: Item; active: boolean; demo?: boolean }) {
  const t = useT();
  const Icon = item.icon;
  return (
    <a
      href={item.id === "overview" ? "#" : `#${item.id}`}
      aria-current={active ? "page" : undefined}
      className={cx(
        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
        active
          ? demo
            ? "bg-warn/10 text-warn"
            : "bg-navy text-white shadow-[0_6px_16px_-8px_rgba(6,25,61,0.6)]"
          : "text-mute hover:bg-sunken hover:text-ink",
      )}
    >
      <Icon
        className={cx("size-[18px] shrink-0", active ? (demo ? "text-warn" : "text-brand") : "text-faint group-hover:text-ink")}
        aria-hidden
      />
      {t(item.label)}
    </a>
  );
}

function MobileLink({ item, active, demo }: { item: Item; active: boolean; demo?: boolean }) {
  const t = useT();
  return (
    <a
      href={item.id === "overview" ? "#" : `#${item.id}`}
      aria-current={active ? "page" : undefined}
      className={cx(
        "whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
        active ? (demo ? "bg-warn/10 text-warn" : "bg-navy text-white") : "text-mute hover:bg-sunken hover:text-ink",
      )}
    >
      {t(item.label)}
    </a>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const t = useT();
  const [view, setView] = useView();
  const current = [...MAIN, ...TOOLS].find((i) => i.id === view) ?? MAIN[0];
  const [tourOpen, setTourOpen] = useState(false);
  const openTour = () => setTourOpen(true);
  useTourAutoStart(view, setTourOpen);

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-[264px] shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <Link href="/" className="flex items-center px-6 pb-6 pt-6" aria-label={t("common.brand")}>
          <ZafraLockup />
        </Link>

        <nav className="flex-1 space-y-7 overflow-y-auto px-4" aria-label="Main">
          <div>
            <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.12em] text-faint">{t("shell.platform")}</p>
            <div className="space-y-1">
              {MAIN.map((i) => (
                <SideLink key={i.id} item={i} active={view === i.id} />
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 flex items-center justify-between px-3 text-[11px] font-bold uppercase tracking-[0.12em] text-faint">
              {t("nav.demoTools")}
              <span className="rounded-full bg-warn/10 px-2 py-0.5 text-[10px] tracking-normal text-warn normal-case">
                {t("common.simulated")}
              </span>
            </p>
            <div className="space-y-1">
              {TOOLS.map((i) => (
                <SideLink key={i.id} item={i} active={view === i.id} demo />
              ))}
            </div>
          </div>
        </nav>

        <div className="space-y-3 p-4">
          <div className="relative overflow-hidden rounded-2xl bg-navy p-4 text-white">
            <div aria-hidden className="av-grid pointer-events-none absolute inset-0 opacity-60" />
            <ZafraMark white className="pointer-events-none absolute -bottom-6 -right-6 size-24 opacity-10" />
            <div className="relative">
              <p className="flex items-center gap-2 text-xs font-semibold">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-70" />
                  <span className="relative inline-flex size-2 rounded-full bg-brand" />
                </span>
                Solana devnet
              </p>
              <p className="mt-2 text-[11px] leading-snug text-white/60">{t("shell.devnetNote")}</p>
              <a
                href={explorerAddressUrl(PROGRAM_ID)}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-brand hover:underline"
              >
                {shortenAddress(PROGRAM_ID, 5)}
                <ExternalLink className="size-3" aria-hidden />
              </a>
            </div>
          </div>
          <Link href="/" className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-mute hover:bg-sunken hover:text-ink">
            <ArrowLeft className="size-3.5" aria-hidden />
            {t("shell.backToSite")}
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md">
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <Link href="/" className="lg:hidden" aria-label={t("common.brand")}>
                <ZafraMark className="size-9" />
              </Link>
              <div className="hidden min-w-0 sm:block">
                <p className="truncate font-display text-base font-bold text-ink">{t(current.label)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={openTour}
                aria-label={t("tour.buttonAria")}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line-strong bg-surface px-3 text-sm font-semibold text-ink transition-colors hover:bg-sunken"
              >
                <Compass className="size-4 text-brand-strong" aria-hidden />
                <span className="hidden sm:inline">{t("tour.button")}</span>
              </button>
              <LocaleSwitch />
              <div data-tour="wallet">
                <WalletButton />
              </div>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto border-t border-line px-4 py-2 lg:hidden" aria-label="Main">
            {MAIN.map((i) => (
              <MobileLink key={i.id} item={i} active={view === i.id} />
            ))}
            <span className="mx-1 w-px shrink-0 bg-line-strong" aria-hidden />
            {TOOLS.map((i) => (
              <MobileLink key={i.id} item={i} active={view === i.id} demo />
            ))}
          </nav>
        </header>
        <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 py-8 sm:px-8 sm:py-10">{children}</main>
        <SiteFooter />
      </div>

      {tourOpen && (
        <GuidedTour
          key={view}
          view={view}
          onClose={() => setTourOpen(false)}
          onContinue={(next, keepOpen) => {
            setTourOpen(keepOpen);
            setView(next);
          }}
        />
      )}
    </div>
  );
}
