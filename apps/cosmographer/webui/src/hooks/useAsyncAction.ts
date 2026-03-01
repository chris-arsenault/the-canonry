import { useState, useCallback } from "react";

export interface AsyncActionState {
  busy: string | null;
  error: string | null;
  run: (label: string, fn: () => Promise<unknown>) => Promise<void>;
  clearError: () => void;
  setError: (msg: string) => void;
}

/**
 * Wraps an async action with busy/error tracking.
 * See ADR-015.
 */
export function useAsyncAction(): AsyncActionState {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`${label}: ${msg}`);
    } finally {
      setBusy(null);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const setErrorMsg = useCallback((msg: string) => setError(msg), []);

  return { busy, error, run, clearError, setError: setErrorMsg };
}
