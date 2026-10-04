import { useQueryClient } from "@tanstack/react-query";

// One place for every cache key this feature owns, so invalidation below can
// be precise instead of "refetch everything".
export const dispensingKeys = {
  queue: (facilityId: string) => ["pharmacy", "queue", facilityId] as const,
  prescription: (prescriptionId: string) => ["pharmacy", "prescription", prescriptionId] as const,
  search: (facilityId: string, query: string) => ["pharmacy", "prescription-search", facilityId, query] as const,
  arrivals: (facilityId: string) => ["pharmacy", "stock-arrivals", facilityId] as const,
  collection: (prescriptionId: string) => ["pharmacy", "collection", prescriptionId] as const,
};

// Anything that changes a prescription also changes what the queue, the search
// results and the stock-arrival banner say about it. Dispensing and returns
// additionally move stock, so the stock and ledger screens are marked stale
// too (they refetch the next time they are shown, not now).
export function useRefreshAfterChange() {
  const queryClient = useQueryClient();

  return (prescriptionId: string) => {
    void queryClient.invalidateQueries({ queryKey: ["pharmacy", "queue"] });
    void queryClient.invalidateQueries({ queryKey: dispensingKeys.prescription(prescriptionId) });
    void queryClient.invalidateQueries({ queryKey: ["pharmacy", "prescription-search"] });
    void queryClient.invalidateQueries({ queryKey: ["pharmacy", "stock-arrivals"] });
    void queryClient.invalidateQueries({ queryKey: ["pharmacy", "stock"], refetchType: "none" });
    void queryClient.invalidateQueries({ queryKey: ["pharmacy", "ledger"], refetchType: "none" });
  };
}
