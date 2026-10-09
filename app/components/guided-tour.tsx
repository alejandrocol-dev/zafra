"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Compass, X } from "lucide-react";
import { useT, type MessageKey } from "@/lib/i18n";
import type { View } from "@/lib/nav";
import { Button, cx } from "@/components/ui";

/**
 * Per-screen guided tour for reviewers. Each step spotlights an element marked
 * with `data-tour="<target>"`; steps without a target (or whose target is not
 * on screen, e.g. the sidebar on mobile) show as a centered card.
 */
type Step = { target?: string };
const TOURS: Record<View, { steps: Step[]; next?: View }> = {
  overview: {
    steps: [{}, { target: "demo" }, { target: "kpis" }, { target: "activity" }, { target: "wallet" }],
    next: "certifier",
  },
  certifier: { steps: [{ target: "cert-role" }, { target: "cert-form" }, { target: "cert-how" }], next: "borrow" },
  borrow: { steps: [{ target: "page-header" }, { target: "borrow-main" }], next: "admin" },
  admin: { steps: [{ target: "admin-oracle" }, { target: "admin-price" }, { target: "admin-loans" }], next: "earn" },
  earn: { steps: [{ target: "earn-pool" }, { target: "earn-deposit" }] },
};

/* ------------------------------ persistence ------------------------------- */

const STORAGE_KEY = "zafra.tour.v1";
type Stored = { seen: View[]; off: boolean };

function readStored(): Stored {
  try {
    const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<Stored>;
    return { seen: Array.isArray(raw.seen) ? raw.seen : [], off: raw.off === true };
  } catch {
    return { seen: [], off: false };
  }
}

function writeStored(patch: Partial<Stored>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readStored(), ...patch }));
  } catch {
    // Storage unavailable (private mode): the tour just shows again next time.
  }
}

/** Opens the tour the first time a screen is visited (unless the user skipped it). */
export function useTourAutoStart(view: View, setOpen: (open: boolean) => void) {
  useEffect(() => {
    const s = readStored();
    if (s.off || s.seen.includes(view)) return;
    const id = window.setTimeout(() => setOpen(true), 700);
    return () => window.clearTimeout(id);
  }, [view, setOpen]);
}

/* -------------------------------- overlay --------------------------------- */

type Rect = { top: number; left: number; width: number; height: number };
const PAD = 8;
const GAP = 14;
const CARD_W = 360;

function sameRect(a: Rect | null, b: Rect | null) {
  return a === b || (!!a && !!b && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height);
}

export function GuidedTour({
  view,
  onClose,
  onContinue,
}: {
  view: View;
  onClose: () => void;
  /** Switch screen; `openTour` continues the guide on the new screen. */
  onContinue: (next: View, openTour: boolean) => void;
}) {
  const t = useT();
  const tour = TOURS[view];
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [cardH, setCardH] = useState(220);
  const [vp, setVp] = useState({ w: 1280, h: 800 });
  const cardRef = useRef<HTMLDivElement>(null);
  const step = tour.steps[i];
  const last = i === tour.steps.length - 1;
  const n = i + 1;
  const k = (part: "title" | "body") => `tour.${view}.${n}.${part}` as MessageKey;
  const screen = (v: View) => t(`nav.${v}` as MessageKey);

  useEffect(() => writeStored({ seen: [...new Set([...readStored().seen, view])] }), [view]);

  // Bring the target into view whenever the step changes.
  useEffect(() => {
    if (!step.target) return;
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    if (el && el.offsetParent !== null) el.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [step.target]);

  // Track the target every frame: it may load late, move while scrolling or resize.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setVp((p) => (p.w === window.innerWidth && p.h === window.innerHeight ? p : { w: window.innerWidth, h: window.innerHeight }));
      const el = step.target ? document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`) : null;
      const r = el?.getBoundingClientRect();
      const next = r && r.width > 0 && r.height > 0 ? { top: r.top, left: r.left, width: r.width, height: r.height } : null;
      setRect((prev) => (sameRect(prev, next) ? prev : next));
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [step.target]);

  useLayoutEffect(() => {
    if (cardRef.current) setCardH(cardRef.current.offsetHeight);
  }, [i, view, t]);

  useEffect(() => cardRef.current?.focus(), [i]);

  const next = () => (last ? onClose() : setI(i + 1));
  const back = () => setI(Math.max(0, i - 1));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") {
        if (last) onClose();
        else setI(i + 1);
      } else if (e.key === "ArrowLeft") setI(Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [i, last, onClose]);

  const mobile = vp.w < 640;
  let cardStyle: CSSProperties;
  if (mobile) {
    cardStyle = { left: 12, right: 12, bottom: 12 };
  } else if (!rect) {
    cardStyle = { left: (vp.w - CARD_W) / 2, top: Math.max(16, (vp.h - cardH) / 2), width: CARD_W };
  } else {
    const below = rect.top + rect.height + PAD + GAP;
    const above = rect.top - PAD - GAP - cardH;
    const top =
      below + cardH <= vp.h - 16 ? below : above >= 16 ? above : Math.max(16, vp.h - cardH - 24);
    const left = Math.min(Math.max(16, rect.left), vp.w - CARD_W - 16);
    cardStyle = { top, left, width: CARD_W };
  }

  return createPortal(
    <div className="fixed inset-0 z-[60]">
      {/* Blocks clicks on the page while the guide is open. */}
      <div className={cx("absolute inset-0", !rect && "bg-navy/55 backdrop-blur-[1px]")} />
      {rect && (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-2xl ring-2 ring-brand transition-all duration-300 ease-out"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: "0 0 0 9999px rgba(6, 25, 61, 0.55)",
          }}
        />
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        tabIndex={-1}
        className="absolute z-10 rounded-2xl border border-line bg-surface p-5 text-ink shadow-(--shadow-float) outline-none transition-[top,left] duration-300 ease-out"
        style={cardStyle}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/15 px-2.5 py-1 text-[11px] font-bold text-brand-strong">
            <Compass className="size-3.5" aria-hidden />
            {t("tour.label", { screen: screen(view) })}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="grid size-7 place-items-center rounded-lg text-faint hover:bg-sunken hover:text-ink"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <h2 id="tour-title" className="mt-3 font-display text-lg font-extrabold leading-snug">
          {t(k("title"))}
        </h2>
        <p id="tour-body" className="mt-1.5 text-sm leading-relaxed text-mute">
          {t(k("body"))}
        </p>

        <div className="mt-4 flex items-center gap-1.5" aria-label={t("tour.progress", { n, total: tour.steps.length })}>
          {tour.steps.map((_, j) => (
            <span
              key={j}
              className={cx("h-1.5 rounded-full transition-all", j === i ? "w-5 bg-navy" : j < i ? "w-1.5 bg-brand" : "w-1.5 bg-line-strong")}
            />
          ))}
          <span className="ml-auto text-xs font-medium text-faint">{t("tour.progress", { n, total: tour.steps.length })}</span>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
          {i === 0 ? (
            <button
              type="button"
              onClick={() => {
                writeStored({ off: true });
                onClose();
              }}
              className="text-xs font-semibold text-faint hover:text-ink"
            >
              {t("tour.skip")}
            </button>
          ) : (
            <Button variant="ghost" size="sm" onClick={back}>
              <ArrowLeft className="size-3.5" aria-hidden />
              {t("tour.back")}
            </Button>
          )}
          <div className="flex items-center gap-2">
            {last && tour.next ? (
              <>
                <Button variant="secondary" size="sm" onClick={onClose}>
                  {t("tour.done")}
                </Button>
                <Button size="sm" onClick={() => onContinue(tour.next!, true)}>
                  {t("tour.nextTab", { screen: screen(tour.next) })}
                  <ArrowRight className="size-3.5" aria-hidden />
                </Button>
              </>
            ) : last ? (
              <>
                <Button variant="secondary" size="sm" onClick={() => onContinue("overview", false)}>
                  {t("tour.finish")}
                </Button>
                <Button size="sm" onClick={onClose}>
                  {t("tour.done")}
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={next}>
                {t("tour.next")}
                <ArrowRight className="size-3.5" aria-hidden />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
