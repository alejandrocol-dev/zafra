"use client";

import { useCallback, useState } from "react";
import type { TxResult } from "./zafra";

/**
 * Wraps a mock/real instruction call: tracks pending state, captures the
 * resulting signature for the explorer link, and surfaces thrown
 * ZafraError codes as readable messages.
 */
export function useTx() {
  const [pending, setPending] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async <R extends Partial<TxResult>>(
      fn: () => Promise<R>,
    ): Promise<R | null> => {
      setPending(true);
      setError(null);
      setSignature(null);
      try {
        const result = await fn();
        if (result && typeof result.signature === "string") {
          setSignature(result.signature);
        }
        return result;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return null;
      } finally {
        setPending(false);
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setSignature(null);
    setError(null);
  }, []);

  return { pending, signature, error, run, reset };
}
