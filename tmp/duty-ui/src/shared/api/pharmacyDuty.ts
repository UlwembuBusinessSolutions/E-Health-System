import { apiClient, apiOrigin, ApiError } from "./client";
import { tenantAuthHeaders } from "./auth";

export interface DutyEntry {
  id: string; staffName: string; dutyType: "ON_DUTY" | "NO_DISPENSER";
  startedAt: string; expiresAt: string; endedAt: string | null; reason: string; mine: boolean;
}
export interface DutyStatus {
  status: "UNKNOWN" | "ON_DUTY" | "NO_DISPENSER";
  absenceId: string | null; absenceExpiresAt: string | null; activeShifts: DutyEntry[]; history: DutyEntry[];
}
export const getDuty = (facilityId: string) => apiClient.get<DutyStatus>(
  `/api/v1/pharmacy/duty?facilityId=${encodeURIComponent(facilityId)}`, { headers: tenantAuthHeaders() });
export const recordDuty = (body: {facilityId: string; dutyType: string; hours: number; reason: string}) =>
  apiClient.post<{id: string}>("/api/v1/pharmacy/duty", body, { headers: tenantAuthHeaders() });
export const endDuty = (facilityId: string, id: string) => apiClient.post<void>(
  `/api/v1/pharmacy/duty/${encodeURIComponent(id)}/end?facilityId=${encodeURIComponent(facilityId)}`, undefined, { headers: tenantAuthHeaders() });
export interface DispensingReportRow {
  id: string; serialNumber: string; mpi: string; patientName: string; facilityName: string; medicine: string;
  quantity: number; dispensedBy: string; dispensedAt: string; dutyEntryId: string | null; dutyReason: string | null;
}
export interface DispensingReport { items: DispensingReportRow[]; totalItems: number; page: number; size: number }
const reportParams = (facilityId: string, from: string, to: string) => new URLSearchParams({ facilityId, from, to });
export const getDispensingReport = (facilityId: string, from: string, to: string, page: number) =>
  apiClient.get<DispensingReport>(`/api/v1/pharmacy/prescriber-dispensed?${reportParams(facilityId, from, to)}&page=${page}`,
    { headers: tenantAuthHeaders() });
export async function exportDispensingReport(facilityId: string, from: string, to: string) {
  const response = await fetch(`${apiOrigin()}/api/v1/pharmacy/prescriber-dispensed.csv?${reportParams(facilityId, from, to)}`,
    { headers: tenantAuthHeaders() });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(body?.message ?? "Could not export the report.", response.status);
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url; link.download = `prescriber-dispensed-${from}-${to}.csv`;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

