import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adjustStock, type AdjustStockPayload } from "@/shared/api/pharmacyStock";
import { useToast } from "@/shared/components/toast/ToastProvider";
import { describeError } from "../lib/problem";
import { invalidateAfterStockMovement } from "../lib/queryKeys";
import { useAttemptKey } from "../lib/useAttemptKey";

interface UseAdjustStockSubmitOptions {
  /** Said in the success toast, e.g. "Removed 12 tablets from lot AX2388." */
  successMessage: string;
  onDone: () => void;
}

export function useAdjustStockSubmit({ successMessage, onDone }: UseAdjustStockSubmitOptions) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { keyFor, settle } = useAttemptKey();

  const mutation = useMutation({
    mutationFn: (payload: AdjustStockPayload) => adjustStock(payload, keyFor(payload)),
    onSuccess: () => {
      settle();
      showToast(successMessage, "success");
      void invalidateAfterStockMovement(queryClient);
      onDone();
    },
    onError: settle,
  });

  return {
    submit: mutation.mutate,
    isSubmitting: mutation.isPending,
    errorMessage: mutation.isError ? describeError(mutation.error) : null,
  };
}
