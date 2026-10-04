"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDataVersion } from "./data-bus";

interface AsyncState<T> {
  data: T | null;
  error: unknown;
  loading: boolean;
}

/**
 * Loads data and reloads it whenever `key` changes or a transaction confirmed
 * anywhere in the app (see data-bus). Keeps stale data visible while reloading.
 */
export function useAsyncData<T>(loader: () => Promise<T>, key: string | number | null = "") {
  const version = useDataVersion();
  const loaderRef = useRef(loader);
  useEffect(() => {
    loaderRef.current = loader;
  });
  const [state, setState] = useState<AsyncState<T>>({ data: null, error: null, loading: true });
  const [manual, setManual] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    loaderRef
      .current()
      .then((data) => !cancelled && setState({ data, error: null, loading: false }))
      .catch((error) => !cancelled && setState((s) => ({ ...s, error, loading: false })));
    return () => {
      cancelled = true;
    };
  }, [version, key, manual]);

  const reload = useCallback(() => setManual((n) => n + 1), []);
  return { ...state, reload };
}
