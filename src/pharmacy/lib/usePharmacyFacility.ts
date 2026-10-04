import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getFacilities } from "@/shared/api/facilities";

// Every pharmacy screen is scoped to one facility. Until the person picks
// another, the first facility the server returns is used, so single-site
// tenants never see a facility control at all.
export function usePharmacyFacility() {
  const [chosenId, setChosenId] = useState("");
  const query = useQuery({ queryKey: ["facilities"], queryFn: getFacilities, staleTime: 5 * 60_000 });
  const facilities = query.data ?? [];

  useEffect(() => {
    if (!chosenId && facilities.length > 0) setChosenId(facilities[0].id);
  }, [chosenId, facilities]);

  return {
    facilityId: chosenId,
    facilities,
    setFacilityId: setChosenId,
    isLoading: query.isLoading,
    error: query.error,
  };
}
