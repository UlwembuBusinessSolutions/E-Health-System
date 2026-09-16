import type { Facility } from "./types";
import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";

export type FacilityType = "CLINIC" | "HOSPITAL" | "STORE" | "PHARMACY";
export interface FacilityDetails {
  id: string;
  name: string;
  code: string;
  type: FacilityType;
  address: string | null;
  phone: string | null;
  operatingHours: string | null;
  active: boolean;
}
export type FacilityPayload = Omit<FacilityDetails, "id" | "active">;
export async function getManagedFacilities(): Promise<FacilityDetails[]> {
  const response = await apiClient.get<{ items: FacilityDetails[] }>("/api/v1/admin/facilities", { headers: tenantAuthHeaders() });
  return response.items;
}
export function createFacility(payload: FacilityPayload): Promise<FacilityDetails> {
  return apiClient.post("/api/v1/admin/facilities", payload, { headers: tenantAuthHeaders() });
}
export function updateFacility(id: string, payload: FacilityPayload): Promise<FacilityDetails> {
  return apiClient.patch(`/api/v1/admin/facilities/${id}`, payload, { headers: tenantAuthHeaders() });
}

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
