import { apiClient } from "./client";
import { patientAuthHeaders } from "./patientAuth";

export interface PatientBookingService { code: string; name: string; description: string }
export interface PatientBookingFacility { id: string; name: string; address: string | null; phone: string | null; operatingHours: string | null; timezone: string }
export interface PatientBookingProvider { id: string; name: string; designation: string | null }
export interface PatientAppointment {
  id: string; patientId: string; patientName: string; mpiNumber: string; date: string; time: string;
  startsAt: string; status: "CONFIRMED" | "CANCELLED"; notes: string | null; serviceCode: string;
  assignedStaffId: string | null; assignedStaffName: string | null; version: number;
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
  const params = new URLSearchParams({ facilityId, date });
  if (providerId) params.set("providerId", providerId);
  return (await apiClient.get<{ items: string[] }>(`${root}/slots?${params}`, { headers: headers() })).items;
}
export async function bookPatientAppointment(payload: {
  requestId: string; facilityId: string; serviceCode: string; providerId: string | null; date: string; time: string;
}) {
  return apiClient.post<PatientAppointment>(`${root}/appointments`, payload, { headers: headers() });
}
export async function getMyPatientAppointments() {
  return (await apiClient.get<{ items: PatientAppointment[] }>(`${root}/appointments`, { headers: headers() })).items;
}
