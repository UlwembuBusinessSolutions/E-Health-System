import { useQueryClient } from "@tanstack/react-query";
import { invalidateAfterStockMovement } from "../../lib/queryKeys";

// Anything that changes a prescription changes what the queue, the search
// results and the stock-arrival banner say about it, and dispensing or a
// return also moves stock: the stock list, ledger, reorder suggestions,
// counts and scheduled register all go stale with it.
export function useRefreshAfterChange() {
  const queryClient = useQueryClient();
  return () => {
    void invalidateAfterStockMovement(queryClient);
  };
}
