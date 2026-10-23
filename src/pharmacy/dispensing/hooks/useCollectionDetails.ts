import { useQuery } from "@tanstack/react-query";
import { getCollectionDetails } from "@/shared/api/pharmacy";
import { pharmacyKeys } from "../../lib/queryKeys";

// Only fetched once the pharmacist asks: the server logs every read of a
// third-party collector's details. gcTime 0 so closing the panel forgets them
// and the next open is a fresh, logged read rather than a silent cache hit.
export function useCollectionDetails(prescriptionId: string, enabled: boolean) {
  return useQuery({
    queryKey: pharmacyKeys.dispensing.collection(prescriptionId),
    queryFn: () => getCollectionDetails(prescriptionId),
    enabled,
    gcTime: 0,
    staleTime: 0,
  });
}
