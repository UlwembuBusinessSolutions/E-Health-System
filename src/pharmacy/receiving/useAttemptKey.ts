import { useCallback, useRef } from "react";

/**
 * Idempotency key per submit ATTEMPT. Retrying the identical request (double
 * click, network retry) reuses the key so the server posts once; changing
 * anything on the form starts a new attempt with a new key, because a key
 * replayed with a different body would be rejected or return the old result.
 */
export function useAttemptKey() {
  const last = useRef<{ fingerprint: string; key: string } | null>(null);

  return useCallback((payload: unknown): string => {
    const fingerprint = JSON.stringify(payload);
    if (last.current?.fingerprint !== fingerprint) {
      last.current = { fingerprint, key: crypto.randomUUID() };
    }
    return last.current.key;
  }, []);
}
