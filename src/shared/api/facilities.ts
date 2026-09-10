import type { Facility } from "./types";
import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";

// Real from here on — was still returning MOCK_FACILITIES with small
// integer-string ids ("60", "65", ...) even after createStaff() itself
// was wired to the real backend, which expects a real UUID for
// facilityId. Submitting one of those mock ids produced a 400
// ("Request body is invalid or malformed") from the real endpoint,
// silently blocking staff creation before the success screen (and its
// photo-upload control) was ever reached — found by testing, not by
// inspection.
export async function getFacilities(): Promise<Facility[]> {
  const response = await apiClient.get<{ items: Facility[] }>("/api/v1/facilities", {
    headers: tenantAuthHeaders(),
  });
  return response.items;
}
