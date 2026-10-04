import { useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/shared/api/client";
import { adjustStock, type AdjustStockPayload } from "@/shared/api/pharmacyStock";
import { useToast } from "@/shared/components/toast/ToastProvider";
import { describeError } from "../lib/problem";
import { invalidateAfterStockChange } from "./stockQueries";

interface IdempotencyAttempt {
  fingerprint: string;
  key: string;
}

interface UseAdjustStockSubmitOptions {
  facilityId: string;
  productId: string;
  /** Said in the success toast, e.g. "Removed 12 tablets from lot AX2388." */
  successMessage: string;
  onDone: () => void;
}

// One idempotency key per submit ATTEMPT. A retry of the very same request
// (the first answer was lost to a dropped connection) reuses its key, so the
// server can recognise it and never writes a second ledger entry. Changing
// anything in the request starts a new attempt with a new key.
export function useAdjustStockSubmit({ facilityId, productId, successMessage, onDone }: UseAdjustStockSubmitOptions) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const attempt = useRef<IdempotencyAttempt | null>(null);

  function keyFor(payload: AdjustStockPayload): string {
    const fingerprint = JSON.stringify(payload);
    if (attempt.current?.fingerprint !== fingerprint) {
      attempt.current = { fingerprint, key: crypto.randomUUID() };
    }
    return attempt.current.key;
  }

  const mutation = useMutation({
    mutationFn: (payload: AdjustStockPayload) => adjustStock(payload, keyFor(payload)),
    onSuccess: () => {
      attempt.current = null;
      showToast(successMessage, "success");
      void invalidateAfterStockChange(queryClient, facilityId, productId);
      onDone();
    },
    // A rejected request (validation, conflict) was understood and refused, so
    // the corrected request deserves a fresh key. Only a lost answer (network
    // error, 5xx) keeps the key, because that request may have been applied.
    onError: (error) => {
      if (error instanceof ApiError && error.status < 500) attempt.current = null;
    },
  });

  return {
    submit: mutation.mutate,
    isSubmitting: mutation.isPending,
    errorMessage: mutation.isError ? describeError(mutation.error) : null,
  };
}
