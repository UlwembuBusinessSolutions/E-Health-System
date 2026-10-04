import { useQuery } from "@tanstack/react-query";
import { getCurrentBalance } from "@/shared/api/pharmacyLedger";
import { pharmacyKeys } from "@/pharmacy/lib/queryKeys";

export function useCurrentBalance(facilityId: string, productId: string, enabled: boolean) {
  return useQuery({
    queryKey: pharmacyKeys.ledger.balance(facilityId, productId),
    queryFn: () => getCurrentBalance(facilityId, productId),
    enabled,
    staleTime: 10_000,
  });
}
