import { useCallback, useRef } from "react";
import { ApiError } from "@/shared/api/client";

/**
 * One idempotency key per submit ATTEMPT. Retrying the identical request
 * (double click, a lost answer) reuses the key so the server writes once;
 * changing anything in the request starts a new attempt with a new key,
 * because a key replayed with a different body would be rejected or answer
 * with the old result.
 *
 * Call `settle()` when a request succeeds and `settle(error)` when it fails: a
 * request the server understood and refused (4xx) deserves a fresh key once it
 * is corrected, and only a lost answer (network error, 5xx) keeps the key,
 * because that request may have been applied.
 */
export function useAttemptKey() {
  const last = useRef<{ fingerprint: string; key: string } | null>(null);

  const keyFor = useCallback((payload: unknown): string => {
    const fingerprint = JSON.stringify(payload);
    if (last.current?.fingerprint !== fingerprint) {
      last.current = { fingerprint, key: crypto.randomUUID() };
    }
    return last.current.key;
  }, []);

  const settle = useCallback((error?: unknown) => {
    if (error === undefined || (error instanceof ApiError && error.status < 500)) last.current = null;
  }, []);

  return { keyFor, settle };
}
