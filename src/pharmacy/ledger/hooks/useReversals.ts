import { useMutation, useQueryClient } from "@tanstack/react-query";
import { reverseReceipt, reverseTransaction, type ReversePayload } from "@/shared/api/pharmacyLedger";

export interface ReverseVariables {
  id: string;
  payload: ReversePayload;
  /** One key per dialog opening, so a retry of the same attempt cannot reverse twice. */
  idempotencyKey: string;
}

// A reversal changes the ledger, the receipts' status, product balances and
// the dashboard counters - and nothing else. Naming those prefixes avoids a
// blanket refetch of every pharmacy query.
function useInvalidateAfterReversal() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["pharmacy", "ledger"] }),
      queryClient.invalidateQueries({ queryKey: ["pharmacy", "receipts"] }),
      queryClient.invalidateQueries({ queryKey: ["pharmacy", "stock"] }),
      queryClient.invalidateQueries({ queryKey: ["pharmacy", "dashboard"] }),
    ]);
}

export function useReverseTransaction() {
  const invalidate = useInvalidateAfterReversal();
  return useMutation({
    mutationFn: ({ id, payload, idempotencyKey }: ReverseVariables) =>
      reverseTransaction(id, payload, idempotencyKey),
    onSuccess: invalidate,
  });
}

export function useReverseReceipt() {
  const invalidate = useInvalidateAfterReversal();
  return useMutation({
    mutationFn: ({ id, payload, idempotencyKey }: ReverseVariables) => reverseReceipt(id, payload, idempotencyKey),
    onSuccess: invalidate,
  });
}
