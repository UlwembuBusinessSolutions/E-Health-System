import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { listMovements, type ListMovementsParams } from "@/shared/api/pharmacyLedger";
import { pharmacyKeys } from "@/pharmacy/lib/queryKeys";

export const LEDGER_PAGE_SIZE = 25;

export type MovementFilters = Omit<ListMovementsParams, "page" | "size">;

// Not usePagedQuery: the ledger response also carries per-type counts for the
// chips, which that generic helper would not type. Same behaviour otherwise
// (old rows stay while the next page loads, 30 s staleTime).
export function useLedgerMovements(filters: MovementFilters, page: number, size = LEDGER_PAGE_SIZE) {
  return useQuery({
    queryKey: pharmacyKeys.ledger.list(filters, { page, size }),
    queryFn: () => listMovements({ ...filters, page, size }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    enabled: filters.facilityId !== "",
  });
}
