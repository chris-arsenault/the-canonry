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
  // eslint-disable-next-line local/no-manual-async-state -- this IS the canonical useAsyncAction implementation (ADR-015)
  const [busy, setBusy] = useState<string | null>(null);
  // eslint-disable-next-line local/no-manual-async-state -- this IS the canonical useAsyncAction implementation (ADR-015)
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
    } catch (err: unknown) {
      let msg: string;
      if (err instanceof Error) {
        msg = err.message;
      } else if (typeof err === 'string') {
        msg = err;
      } else {
        msg = 'Unknown error';
      }
      setError(`${label}: ${msg}`);
    } finally {
      setBusy(null);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const setErrorMsg = useCallback((msg: string) => setError(msg), []);

  return { busy, error, run, clearError, setError: setErrorMsg };
}
