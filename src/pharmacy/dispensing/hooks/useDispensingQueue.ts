import { useQuery } from "@tanstack/react-query";
import { listDispensingQueue } from "@/shared/api/pharmacy";
import { pharmacyKeys } from "../../lib/queryKeys";
import { useDocumentVisible } from "./useDocumentVisible";

const POLL_INTERVAL_MS = 10_000;

// New scripts arrive while the pharmacist works, so the queue refreshes itself
// — but only while the tab is visible; a forgotten background tab should not
// keep hitting the API all day.
export function useDispensingQueue(facilityId: string) {
  const visible = useDocumentVisible();
  return useQuery({
    queryKey: pharmacyKeys.dispensing.queue(facilityId),
    queryFn: () => listDispensingQueue(facilityId),
    enabled: facilityId !== "",
    refetchInterval: visible ? POLL_INTERVAL_MS : false,
    staleTime: 5_000,
  });
}
