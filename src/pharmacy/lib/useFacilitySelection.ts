import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { getFacilities } from "@/shared/api/facilities";

const FACILITY_PARAM = "facilityId";

// Every pharmacy screen is scoped to one facility. The choice lives in the
// URL, not in component state: another screen can link here with ?facilityId=,
// and a refresh or a shared link keeps the same facility selected. Until
// someone picks another, the first facility the server returns is used, so
// single-site tenants never see a facility control at all. That fallback is
// derived while rendering, so there is no effect that could overwrite a choice.
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

  return {
    facilities,
    facilityId,
    selectFacility,
    isLoading: facilitiesQuery.isLoading,
    isFetching: facilitiesQuery.isFetching,
    error: facilitiesQuery.error,
    refetch: facilitiesQuery.refetch,
  };
}
