import { apiClient } from "./client";
import { patientAuthHeaders } from "./patientAuth";

export interface PatientBookingService { code: string; name: string; description: string }
export interface PatientBookingFacility { id: string; name: string; address: string | null; phone: string | null; operatingHours: string | null; timezone: string }
export interface PatientBookingProvider { id: string; name: string; designation: string | null }
export interface PatientBookingAvailability { items: string[]; booked: number; dailyLimit: number | null; remaining: number | null }
export interface PatientAppointment {
  id: string; patientId: string; patientName: string; mpiNumber: string; date: string; time: string; facilityId: string;
  startsAt: string; status: "CONFIRMED" | "CANCELLED"; notes: string | null; serviceCode: string;
  assignedStaffId: string | null; assignedStaffName: string | null; version: number;
  facilityName: string;
}

const root = "/api/v1/patient/booking";
const headers = () => patientAuthHeaders();

export async function getPatientBookingServices() {
  return (await apiClient.get<{ items: PatientBookingService[] }>(`${root}/services`, { headers: headers() })).items;
}
export async function getPatientBookingFacilities() {
  return (await apiClient.get<{ items: PatientBookingFacility[] }>(`${root}/facilities`, { headers: headers() })).items;
}
export async function getPatientBookingProviders(facilityId: string) {
  const params = new URLSearchParams({ facilityId });
  return (await apiClient.get<{ items: PatientBookingProvider[] }>(`${root}/providers?${params}`, { headers: headers() })).items;
}
export async function getPatientBookingSlots(facilityId: string, date: string, providerId: string | null) {
  return (await getPatientBookingAvailability(facilityId, date, providerId)).items;
}
export async function getPatientBookingAvailability(facilityId: string, date: string, providerId: string | null, excludeAppointmentId?: string) {
  const params = new URLSearchParams({ facilityId, date });
  if (providerId) params.set("providerId", providerId);
  if (excludeAppointmentId) params.set("excludeAppointmentId", excludeAppointmentId);
  return apiClient.get<PatientBookingAvailability>(`${root}/slots?${params}`, { headers: headers() });
}
export async function bookPatientAppointment(payload: {
  requestId: string; facilityId: string; serviceCode: string; providerId: string | null; date: string; time: string;
}) {
  return apiClient.post<PatientAppointment>(`${root}/appointments`, payload, { headers: headers() });
}
export async function getMyPatientAppointments() {
  return (await apiClient.get<{ items: PatientAppointment[] }>(`${root}/appointments`, { headers: headers() })).items;
}
export async function rescheduleMyPatientAppointment(id: string, date: string, time: string) {
  return apiClient.patch<PatientAppointment>(`${root}/appointments/${id}`, { date, time }, { headers: headers() });
}
export async function cancelMyPatientAppointment(id: string) {
  return apiClient.post<PatientAppointment>(`${root}/appointments/${id}/cancel`, {}, { headers: headers() });
}
