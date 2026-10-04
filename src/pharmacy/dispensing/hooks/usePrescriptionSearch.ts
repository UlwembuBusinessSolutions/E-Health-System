import { useQuery } from "@tanstack/react-query";
import { getPrescription, listStockArrivals, searchPrescriptions } from "@/shared/api/pharmacy";
import { dispensingKeys } from "./dispensingKeys";

// Two letters is the shortest query that is not just noise for a name search.
const MIN_QUERY_LENGTH = 2;

export function usePrescriptionSearch(facilityId: string, query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: dispensingKeys.search(facilityId, trimmed),
    queryFn: () => searchPrescriptions(trimmed, facilityId),
    enabled: facilityId !== "" && trimmed.length >= MIN_QUERY_LENGTH,
    staleTime: 10_000,
  });
}

// The full card for a prescription opened from search or from the arrivals
// banner. Kept fresh by the same invalidation as the queue.
export function useOpenedPrescription(prescriptionId: string | null) {
  return useQuery({
    queryKey: dispensingKeys.prescription(prescriptionId ?? ""),
    queryFn: () => getPrescription(prescriptionId ?? ""),
    enabled: prescriptionId !== null,
    staleTime: 5_000,
  });
}

export function useStockArrivals(facilityId: string) {
  return useQuery({
    queryKey: dispensingKeys.arrivals(facilityId),
    queryFn: () => listStockArrivals(facilityId),
    enabled: facilityId !== "",
    staleTime: 15_000,
  });
}
