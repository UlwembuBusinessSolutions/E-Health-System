import type { Gender } from "./types";
import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";

// Matches identity.CitizenshipStatus field-for-field.
export type CitizenshipStatus = "SA_CITIZEN" | "PERMANENT_RESIDENT";
export interface RegisterPatientPayload {
  firstName: string;
  lastName: string;

  idNumber?: string;
  passportNumber?: string;

  dateOfBirth?: string;
  gender?: Gender;
  citizenshipStatus?: CitizenshipStatus;

  address: string;
  contactNumber: string;

  medicalAidProvider?: string;
  medicalAidNumber?: string;
}

export interface Patient {
  id: string;
  mpiNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  dateOfDeath: string | null;
  deceased: boolean;
  archivedAt: string | null;
  gender: Gender;
  citizenshipStatus: CitizenshipStatus;

  idNumber: string | null;
  passportNumber: string | null;

  address: string;
  contactNumber: string;
  medicalAidProvider: string | null;
  medicalAidNumber: string | null;
  createdAt: string;
}

// export async function markPatientDeceased(id: string, dateOfDeath: string): Promise<Patient> {
//   return apiClient.post<Patient>(`/api/v1/patients/${id}/deceased`, { dateOfDeath }, { headers: tenantAuthHeaders() });
// }

export async function markPatientDeceased(id: string, dateOfDeath: string, confirmDateOfBirth: string,): Promise<Patient> 
{
  return apiClient.post<Patient>(`/api/v1/patients/${id}/deceased`,{ dateOfDeath, confirmDateOfBirth },{ headers: tenantAuthHeaders() },);
}

export async function registerPatient(payload: RegisterPatientPayload): Promise<Patient> 
{
  return apiClient.post<Patient>("/api/v1/patients", payload, { headers: tenantAuthHeaders() });
}

export async function searchPatients(query: string, dateOfBirth?: string): Promise<Patient[]> {
  const search = new URLSearchParams();
  if (query) search.set("q", query);
  if (dateOfBirth) search.set("dob", dateOfBirth);
  const response = await apiClient.get<{ items: Patient[] }>(`/api/v1/patients/search?${search.toString()}`, {
    headers: tenantAuthHeaders(),
  });
  return response.items;
}

export async function getPatient(id: string): Promise<Patient> {
  return apiClient.get<Patient>(`/api/v1/patients/${id}`, { headers: tenantAuthHeaders() });
}

export interface UpdatePatientPayload {
  firstName: string;
  lastName: string;

  idNumber?: string;
  passportNumber?: string;

  dateOfBirth?: string;
  gender?: Gender;
  citizenshipStatus?: CitizenshipStatus;

  address: string;
  contactNumber: string;

  medicalAidProvider?: string;
  medicalAidNumber?: string;

  reasonForChange?: string;
}

export async function updatePatient(id: string, payload: UpdatePatientPayload): Promise<Patient> 
{
  return apiClient.patch<Patient>(`/api/v1/patients/${id}`, payload, { headers: tenantAuthHeaders() });
}