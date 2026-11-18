import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";
import type { AllergyStatus } from "./consultations";

// Patient Allergy Management. Matches PatientAllergyController's request/response records field-for-field.
// Readable by anyone with patient-record access; changing needs a clinical role (enforced server-side).

export type AllergenType = "MEDICATION" | "FOOD" | "ENVIRONMENTAL" | "OTHER";
export type AllergySeverity = "MILD" | "MODERATE" | "SEVERE" | "LIFE_THREATENING";
export type AllergyRecordStatus = "ACTIVE" | "INACTIVE";

export interface PatientAllergy {
  id: string;
  patientId: string;
  /** An ATC code for a medication allergy; an optional reference code otherwise. */
  allergyCode: string | null;
  catalogProductId: string | null;
  allergyName: string;
  allergenType: AllergenType;
  reaction: string;
  severity: AllergySeverity;
  /** "yyyy-MM-dd" */
  dateIdentified: string;
  clinicalNotes: string | null;
  status: AllergyRecordStatus;
  inactiveReason: string | null;
  inactivatedAt: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedByUserId: string | null;
  updatedAt: string;
}

export interface PatientAllergyRecord {
  /** KNOWN is derived from having active allergies; UNKNOWN means the patient has not been asked yet. */
  status: AllergyStatus;
  statusUpdatedAt: string | null;
  activeCount: number;
  allergies: PatientAllergy[];
}

export interface AllergyPayload {
  allergyCode?: string;
  catalogProductId?: string;
  allergyName: string;
  allergenType: AllergenType;
  reaction: string;
  severity: AllergySeverity;
  dateIdentified: string;
  clinicalNotes?: string;
}

const base = (patientId: string) => `/api/v1/patients/${patientId}`;

export async function getPatientAllergies(patientId: string): Promise<PatientAllergyRecord> {
  return apiClient.get<PatientAllergyRecord>(`${base(patientId)}/allergies`, { headers: tenantAuthHeaders() });
}

export async function addPatientAllergy(patientId: string, payload: AllergyPayload): Promise<PatientAllergy> {
  return apiClient.post<PatientAllergy>(`${base(patientId)}/allergies`, payload, { headers: tenantAuthHeaders() });
}

export async function updatePatientAllergy(
  patientId: string,
  allergyId: string,
  payload: AllergyPayload,
): Promise<PatientAllergy> {
  return apiClient.put<PatientAllergy>(`${base(patientId)}/allergies/${allergyId}`, payload, {
    headers: tenantAuthHeaders(),
  });
}

/** Marks an allergy inactive (resolved or entered in error). Nothing is ever deleted. */
export async function deactivatePatientAllergy(
  patientId: string,
  allergyId: string,
  reason: string,
): Promise<PatientAllergy> {
  return apiClient.post<PatientAllergy>(`${base(patientId)}/allergies/${allergyId}/deactivate`, { reason }, {
    headers: tenantAuthHeaders(),
  });
}

export async function reactivatePatientAllergy(patientId: string, allergyId: string): Promise<PatientAllergy> {
  return apiClient.post<PatientAllergy>(`${base(patientId)}/allergies/${allergyId}/reactivate`, undefined, {
    headers: tenantAuthHeaders(),
  });
}

/** Records "no known allergies" or "unknown". KNOWN is set by recording an allergy, never directly. */
export async function setPatientAllergyStatus(
  patientId: string,
  status: Exclude<AllergyStatus, "KNOWN">,
): Promise<PatientAllergyRecord> {
  return apiClient.put<PatientAllergyRecord>(`${base(patientId)}/allergy-status`, { status }, {
    headers: tenantAuthHeaders(),
  });
}