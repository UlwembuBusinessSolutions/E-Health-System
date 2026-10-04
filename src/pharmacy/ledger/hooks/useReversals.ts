import { useMutation, useQueryClient } from "@tanstack/react-query";
import { reverseReceipt, reverseTransaction, type ReversePayload } from "@/shared/api/pharmacyLedger";
import { invalidateAfterStockMovement } from "@/pharmacy/lib/queryKeys";
import { describeReversal } from "../lib/movementEvents";

// A reversal puts stock back where it was, so it makes everything a stock
// movement touches stale: the ledger, receipts, stock list and dashboard,
// reorder suggestions, counts and the scheduled-medicines register.
export function useReverseTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ transactionId, payload }: { transactionId: string; payload: ReversePayload }) =>
      reverseTransaction(transactionId, payload),
    onSuccess: () => invalidateAfterStockMovement(queryClient),
  });
}

export function useReverseReceipt() {
  const queryClient = useQueryClient();
  return useMutation({
    // The receipt endpoint takes one free-text reason, so the picked reason and note are joined.
    mutationFn: ({ receiptId, payload }: { receiptId: string; payload: ReversePayload }) =>
      reverseReceipt(receiptId, describeReversal(payload)),
    onSuccess: () => invalidateAfterStockMovement(queryClient),
  });
}
