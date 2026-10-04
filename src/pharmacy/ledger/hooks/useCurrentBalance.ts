import { useQuery } from "@tanstack/react-query";
import { getCurrentBalance } from "@/shared/api/pharmacyLedger";

export function useCurrentBalance(facilityId: string, productId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["pharmacy", "ledger", "balance", facilityId, productId],
    queryFn: () => getCurrentBalance(facilityId, productId),
    enabled,
    staleTime: 10_000,
  });
}
