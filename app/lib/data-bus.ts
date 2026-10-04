"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

/**
 * Tiny "something changed on-chain" signal. Call `notifyDataChanged()` after a
 * confirmed transaction; any component that reads `useDataVersion()` re-fetches.
 */
let version = 0;
const listeners = new Set<() => void>();

export function notifyDataChanged() {
  version += 1;
  listeners.forEach((l) => l());
}

export function useDataVersion(): number {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => version,
    () => 0,
  );
}

/** Current unix time in seconds, refreshed every `ms` (default 1s). */
export function useNowSec(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now() / 1000), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return now;
}
