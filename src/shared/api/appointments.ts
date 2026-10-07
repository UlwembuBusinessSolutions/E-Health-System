import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";

export interface AppointmentSettings { facilityId: string; facilityName: string; timezone: string; dailyLimit: number | null }
// createdByName/createdAt: who actually booked this and when — always
// captured (createdBy has been required since the first slice, used
// internally for the idempotent-retry check), just newly surfaced here.
// There's no "online" source to distinguish from yet — every appointment
// today is staff-booked through this same page; that only becomes a real
// field once patient self-service booking exists as a second path.
export interface Appointment { id: string; patientId: string; patientName: string; mpiNumber: string; date: string; time: string; startsAt: string; status: "CONFIRMED" | "CANCELLED"; cancelReason: string | null; notes: string | null; version: number; assignedStaffId: string | null; assignedStaffName: string | null; createdByName: string | null; createdAt: string }
export interface AppointmentStaff { id: string; name: string; designation: string | null }
export async function getAppointmentStaff(facilityId: string) {
  return (await apiClient.get<{ items: AppointmentStaff[] }>(`/api/v1/facilities/${facilityId}/appointment-staff`, { headers: tenantAuthHeaders() })).items;
}
export interface AppointmentDiary { items: Appointment[]; totalItems: number; hasMore: boolean; date: string; timezone: string; booked: number; dailyLimit: number | null; remaining: number | null; canManage: boolean }
const path = (facilityId: string) => `/api/v1/facilities/${facilityId}/appointments`;
export async function getAppointmentSettings() {
  return (await apiClient.get<{ items: AppointmentSettings[] }>("/api/v1/admin/appointment-settings", { headers: tenantAuthHeaders() })).items;
}
export function saveAppointmentSettings(facilityId: string, dailyLimit: number | null) {
  return apiClient.patch<AppointmentSettings>(`/api/v1/admin/appointment-settings/${facilityId}`, { unlimited: dailyLimit === null, dailyLimit }, { headers: tenantAuthHeaders() });
}
// View-only filters — narrow which appointments come back without touching
// the daily-limit booked/remaining counts (AppointmentService.diary()'s own
// why-note: those always reflect the facility's real capacity, filtered or
// not). assignedStaffId and unassignedOnly are mutually exclusive in the UI
// (the filter combobox only ever sends one or the other) but both are
// accepted independently here, matching the backend's own param shape.
export interface AppointmentFilters { assignedStaffId?: string; unassignedOnly?: boolean; status?: string }
export function getAppointments(facilityId: string, date: string, page: number, filters?: AppointmentFilters) {
  const params = new URLSearchParams({ page: String(page) });
  if (date) params.set("date", date);
  if (filters?.assignedStaffId) params.set("assignedStaffId", filters.assignedStaffId);
  if (filters?.unassignedOnly) params.set("unassignedOnly", "true");
  if (filters?.status) params.set("status", filters.status);
  return apiClient.get<AppointmentDiary>(`${path(facilityId)}?${params}`, { headers: tenantAuthHeaders() });
}
export function bookAppointment(facilityId: string, payload: { requestId: string; patientId: string; date: string; time: string; assignedStaffId: string | null; notes: string | null }) {
  return apiClient.post<Appointment>(path(facilityId), payload, { headers: tenantAuthHeaders() });
}
export function rescheduleAppointment(facilityId: string, appointment: Appointment, date: string, time: string, assignedStaffId: string | null, notes: string | null) {
  return apiClient.post<Appointment>(`${path(facilityId)}/${appointment.id}/reschedule`, { date, time, assignedStaffId, notes, version: appointment.version }, { headers: tenantAuthHeaders() });
}
export function cancelAppointment(facilityId: string, appointment: Appointment, reason: string) {
  return apiClient.post<Appointment>(`${path(facilityId)}/${appointment.id}/cancel`, { reason, version: appointment.version }, { headers: tenantAuthHeaders() });
}
