// Lihle | 2026-09-09 | Discover clinics without a stale clinic header and normalize supported response shapes so clinic selection can initialize and report malformed responses.
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
  // Clinic discovery must work before a clinic is selected and must not
  // inherit a stale or unrelated active clinic. Tenant authentication stays.
  const headers: Record<string, string> = {};
  new Headers(tenantAuthHeaders()).forEach((value, name) => {
    if (name !== "x-clinic-id") headers[name] = value;
  });
  const response = await apiClient.get<Facility[] | { items?: Facility[]; content?: Facility[] }>("/api/v1/facilities", {
    headers,
  });
  const facilities = Array.isArray(response) ? response : response?.items ?? response?.content;
  if (!Array.isArray(facilities)) {
    throw new Error("The server returned an invalid clinic list. Please reload clinics.");
  }
  return facilities;
}

export interface Station {
  id: string;
  name: string;
  code: string;
  facilityId: string;
  careService: CareService;
}

export type CareService = "MEDICAL" | "SURGICAL" | "DIAGNOSTIC" | "LONG_TERM_CARE";

export async function getStations(facilityId: string): Promise<Station[]> {
  const response = await apiClient.get<{ items: Station[] }>(
    `/api/v1/facilities/${encodeURIComponent(facilityId)}/stations`,
    { headers: tenantAuthHeaders() },
  );
  return response.items;
}
