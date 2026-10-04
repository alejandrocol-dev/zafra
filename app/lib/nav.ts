"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

export type View = "overview" | "borrow" | "earn" | "certifier" | "admin";
export const VIEWS: View[] = ["overview", "borrow", "earn", "certifier", "admin"];

function parse(hash: string): View {
  const v = hash.replace(/^#/, "") as View;
  return VIEWS.includes(v) ? v : "overview";
}

function subscribe(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}

/** Hash-based screen routing (#borrow): linkable, back-button friendly, no Suspense needed. */
export function useView(): [View, (v: View) => void] {
  const view = useSyncExternalStore(
    subscribe,
    () => parse(window.location.hash),
    () => "overview" as View,
  );
  const setView = useCallback((v: View) => {
    window.location.hash = v === "overview" ? "" : v;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);
  return [view, setView];
}

/** Scroll to top whenever the screen changes. */
export function useScrollTopOnChange(view: View) {
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view]);
}
