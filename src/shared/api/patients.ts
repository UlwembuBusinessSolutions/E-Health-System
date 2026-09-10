import type { Gender } from "./types";
import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";

// PREG-US-001/002/003/008. Real from the start, no mock era — matches
// PatientController.RegisterPatientRequest/PatientSummary field-for-field.
// Any authenticated staff member can call these (not ORG_ADMIN-gated):
// registering and finding a patient is front-line reception/clinical work,
// same reasoning as GET /api/v1/facilities being open to any authenticated
// user.

// Matches identity.CitizenshipStatus field-for-field.
export type CitizenshipStatus = "SA_CITIZEN" | "PERMANENT_RESIDENT";

export interface RegisterPatientPayload {
  firstName: string;
  lastName: string;
  idNumber: string;
  address: string;
  contactNumber: string;
  medicalAidProvider?: string;
  medicalAidNumber?: string;
  nextOfKin: NextOfKin[];
}

export interface NextOfKin {
  name: string;
  relationship: string;
  contactNumber: string;
}

// dateOfBirth/gender/citizenshipStatus are never supplied by the caller —
// the backend derives all three from idNumber alone (SouthAfricanIdNumber.parse()'s
// own why-note) — this is the response shape, not the request shape.
export interface Patient {
  id: string;
  mpiNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: Gender;
  citizenshipStatus: CitizenshipStatus;
  idNumber: string;
  address: string;
  contactNumber: string;
  medicalAidProvider: string | null;
  medicalAidNumber: string | null;
  nextOfKin: NextOfKin[];
  createdAt: string;
}

export async function registerPatient(payload: RegisterPatientPayload): Promise<Patient> {
  return apiClient.post<Patient>("/api/v1/patients", payload, { headers: tenantAuthHeaders() });
}

// PREG-US-008 — empty query returns no results rather than the whole
// roster, matching PatientService.search()'s own behavior; callers debounce
// on their end (same pattern OrganizationsPage's own search already uses)
// rather than sending a request per keystroke.
export async function searchPatients(query: string): Promise<Patient[]> {
  const search = new URLSearchParams();
  if (query) search.set("q", query);
  const response = await apiClient.get<{ items: Patient[] }>(`/api/v1/patients/search?${search.toString()}`, {
    headers: tenantAuthHeaders(),
  });
  return response.items;
}

export async function getPatient(id: string): Promise<Patient> {
  return apiClient.get<Patient>(`/api/v1/patients/${id}`, { headers: tenantAuthHeaders() });
}

export type DependantRelationship = "CHILD" | "SPOUSE" | "PARTNER" | "PARENT" | "OTHER";

export interface AddDependantPayload {
  firstName: string;
  lastName: string;
  idNumber: string;
  address: string;
  contactNumber: string;
  relationship: DependantRelationship;
  supportingDocument: File;
}

export interface DependantRelationshipRecord {
  id: string;
  principalId: string;
  dependant: Patient;
  relationship: DependantRelationship;
  supportingDocumentName: string;
  supportingDocumentUrl?: string;
  createdAt: string;
}

export async function addDependant(
  principalId: string,
  payload: AddDependantPayload,
): Promise<DependantRelationshipRecord> {
  const form = new FormData();
  form.append("firstName", payload.firstName);
  form.append("lastName", payload.lastName);
  form.append("idNumber", payload.idNumber);
  form.append("address", payload.address);
  form.append("contactNumber", payload.contactNumber);
  form.append("relationship", payload.relationship);
  form.append("supportingDocument", payload.supportingDocument);

  return apiClient.post<DependantRelationshipRecord>(`/api/v1/patients/${principalId}/dependants`, form, {
    headers: tenantAuthHeaders(),
  });
}
