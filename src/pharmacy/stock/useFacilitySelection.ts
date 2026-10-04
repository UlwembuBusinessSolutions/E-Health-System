import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { getFacilities } from "@/shared/api/facilities";

const FACILITY_PARAM = "facilityId";

// The facility lives in the URL, not in component state: Receive links back
// here with ?facilityId=, and a refresh or a shared link keeps the same
// facility selected. Falling back to the first facility is derived while
// rendering, so there is no effect that could overwrite a choice.
export function useFacilitySelection() {
  const [searchParams, setSearchParams] = useSearchParams();
  const facilitiesQuery = useQuery({ queryKey: ["facilities"], queryFn: getFacilities, staleTime: 5 * 60_000 });

  const facilities = facilitiesQuery.data ?? [];
  const facilityId = searchParams.get(FACILITY_PARAM) ?? facilities[0]?.id ?? "";

  const selectFacility = useCallback(
    (id: string) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          next.set(FACILITY_PARAM, id);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  return { facilities, facilityId, selectFacility, isLoading: facilitiesQuery.isLoading };
}
