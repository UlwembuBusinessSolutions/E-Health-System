// Lihle | 2026-09-09 | Add clinic context and staff assignment API helpers with explicit clinic headers so selection and access changes reach the backend.
import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";
import { getFacilities } from "./facilities";

export interface ClinicContextResponse { activeClinicId: string | null; clinicIds: string[] }
export interface ClinicAssignments { primaryClinicId: string | null; clinicIds: string[]; tenantWide: boolean }

function headers(clinicId?: string): Record<string, string> {
  const result: Record<string, string> = {};
  new Headers(tenantAuthHeaders()).forEach((value, name) => { result[name] = value; });
  delete result["x-clinic-id"];
  if (clinicId) result["X-Clinic-ID"] = clinicId;
  return result;
}

export function getClinicContext(clinicId?: string) {
  return apiClient.get<ClinicContextResponse>("/api/v1/auth/clinic-context", { headers: headers(clinicId) });
}
export const getAvailableClinics = getFacilities;
export function selectClinic(clinicId: string) {
  return apiClient.put<ClinicContextResponse>("/api/v1/auth/clinic-context", undefined, { headers: headers(clinicId) });
}
export function getStaffClinics(userId: string) {
  return apiClient.get<ClinicAssignments>(`/api/v1/admin/staff/${userId}/clinics`, { headers: tenantAuthHeaders() });
}
export function updateStaffClinics(userId: string, clinicIds: string[], primaryClinicId: string) {
  return apiClient.put<ClinicContextResponse>(`/api/v1/admin/staff/${userId}/clinics`,
    { clinicIds, primaryClinicId }, { headers: tenantAuthHeaders() });
}
