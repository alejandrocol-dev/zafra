"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { en, es, type MessageKey } from "./messages";

export type Locale = "en" | "es";
export type { MessageKey };
export type TranslateFn = (key: MessageKey, params?: Record<string, string | number>) => string;

const STORAGE_KEY = "zafra.locale";
const DICTS: Record<Locale, Record<MessageKey, string>> = { en, es };

type Params = Record<string, string | number>;
type TFn = (key: MessageKey, params?: Params) => string;

interface I18nValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: TFn;
}

const I18nContext = createContext<I18nValue | null>(null);

function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) =>
    k in params ? String(params[k]) : `{${k}}`,
  );
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  // Start with "en" on both server and first client render (no hydration
  // mismatch); the stored/browser preference is applied right after mount.
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "es") {
      setLocaleState(stored);
      return;
    }
    if (navigator.language.toLowerCase().startsWith("es")) setLocaleState("es");
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    window.localStorage.setItem(STORAGE_KEY, l);
  }, []);

  const t = useCallback<TFn>(
    (key, params) => interpolate(DICTS[locale][key] ?? en[key] ?? key, params),
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <LocaleProvider>");
  return ctx;
}

export function useT(): TFn {
  return useI18n().t;
}

/** Locale-aware formatters (es-AR / en-US). Amounts keep "USDC" as the unit. */
export function useFmt() {
  const { locale } = useI18n();
  return useMemo(() => {
    const tag = locale === "es" ? "es-AR" : "en-US";
    const num = (n: number, max = 2, min = 0) =>
      n.toLocaleString(tag, { maximumFractionDigits: max, minimumFractionDigits: min });
    return {
      locale,
      /** 26,400.50 USDC — always two decimals, financial style. */
      usdc: (n: number, withUnit = true) =>
        `${num(n, 2, 2)}${withUnit ? " USDC" : ""}`,
      /** 500,599 USDC — rounded, for headline stats where cents are noise. */
      usdcRound: (n: number) => `${num(n, 0)} USDC`,
      /** Exact two decimals, e.g. for debts that tick every second. */
      usdcExact: (n: number) => `${num(n, 2, 2)} USDC`,
      tons: (n: number) => `${num(n, 0)} t`,
      pct: (fraction: number, digits = 1) => `${num(fraction * 100, digits)}%`,
      bps: (bps: number) => {
        const pct = bps / 100;
        return `${num(pct, Number.isInteger(pct) ? 0 : 2)}%`;
      },
      /** "3 minutes ago" / "hace 3 minutos". */
      ago: (unixSec: number) => {
        const rtf = new Intl.RelativeTimeFormat(tag, { numeric: "auto" });
        const diff = unixSec - Date.now() / 1000;
        const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
          ["day", 86_400],
          ["hour", 3_600],
          ["minute", 60],
        ];
        for (const [unit, sec] of units) {
          if (Math.abs(diff) >= sec) return rtf.format(Math.round(diff / sec), unit);
        }
        return rtf.format(Math.round(diff), "second");
      },
      date: (unixSec: number) =>
        new Date(unixSec * 1000).toLocaleDateString(tag, {
          year: "numeric",
          month: "short",
          day: "numeric",
        }),
      number: num,
    };
  }, [locale]);
}
