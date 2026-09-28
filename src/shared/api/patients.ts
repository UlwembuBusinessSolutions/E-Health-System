import type { Gender } from "./types";
import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";

// PREG-US-001/002/003/008. Real from the start, no mock era — matches
// PatientController.RegisterPatientRequest/PatientSummary field-for-field.
// Any authenticated staff member can call these.
export type CitizenshipStatus = "SA_CITIZEN" | "PERMANENT_RESIDENT";

export interface RegisterPatientPayload {
  firstName: string;
  lastName: string;
  idNumber: string;
  address: string;
  contactNumber: string;
  email?: string;
  medicalAidProvider?: string;
  medicalAidNumber?: string;
  passportNumber?: string;
  passportExpiry?: string;
}

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
  email: string | null;
  medicalAidProvider: string | null;
  medicalAidNumber: string | null;
  passportNumber: string | null;
  passportExpiry: string | null;
  createdAt: string;
  archived: boolean;
  archivedReason: string | null;
  archivedAt: string | null;
  deceasedDate: string | null;
  migrated: boolean;
}

export async function registerPatient(
  payload: RegisterPatientPayload,
): Promise<Patient> {
  return apiClient.post<Patient>("/api/v1/patients", payload, {
    headers: tenantAuthHeaders(),
  });
}

/* -------------------------------------------------------------------------- */
/* Identity document scanning                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Response returned by both identity scanning endpoints.
 *
 * The backend only parses/validates identity information here.
 * It does NOT create or modify a Patient.
 */
export interface IdentityScanResult {
  documentType: "SA_ID" | "PASSPORT";
  firstName: string | null;
  lastName: string | null;
  dateOfBirth: string | null;
  gender: Gender | null;
  citizenshipStatus: CitizenshipStatus | null;
  passportNumber: string | null;
  passportExpiry: string | null;
  nationality: string | null;
  idNumber: string | null;
}

/**
 * SA identity/barcode scanner endpoint.
 *
 * The scanner supplies the SA ID number decoded from the identity
 * document/barcode. The backend validates the number and derives:
 * - date of birth
 * - gender
 * - citizenship status
 */
export async function scanSouthAfricanId(
  idNumber: string,
): Promise<IdentityScanResult> {
  return apiClient.post<IdentityScanResult>(
    "/api/v1/patients/identity-scan/id",
    { idNumber },
    {
      headers: tenantAuthHeaders(),
    },
  );
}

/**
 * Passport TD3 MRZ scanner endpoint.
 *
 * Accepts either:
 * - the normal two-line 44-character MRZ, or
 * - a scanner's concatenated 88-character value.
 *
 * The backend validates the MRZ check digits before returning identity data.
 */
export async function scanPassportMrz(
  mrz: string,
): Promise<IdentityScanResult> {
  return apiClient.post<IdentityScanResult>(
    "/api/v1/patients/identity-scan/passport",
    { mrz },
    {
      headers: tenantAuthHeaders(),
    },
  );
}

/* -------------------------------------------------------------------------- */
/* Patient search/list/get                                                    */
/* -------------------------------------------------------------------------- */

export async function searchPatients(query: string): Promise<Patient[]> {
  const search = new URLSearchParams();

  if (query) {
    search.set("q", query);
  }

  const response = await apiClient.get<{ items: Patient[] }>(
    `/api/v1/patients/search?${search.toString()}`,
    {
      headers: tenantAuthHeaders(),
    },
  );

  return response.items;
}

export interface PatientPage {
  items: Patient[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
}

export type PatientSortBy = "name" | "mpi" | "age" | "registered";
export type SortDirection = "asc" | "desc";

export interface ListPatientsParams {
  page: number;
  size?: number;
  sortBy?: PatientSortBy;
  sortDir?: SortDirection;
  gender?: Gender | "";
  hasMedicalAid?: boolean | null;
  mpiNumber?: string;
  citizenshipStatus?: CitizenshipStatus | "";
  createdFrom?: string;
  createdTo?: string;
}

export async function listPatients(
  params: ListPatientsParams,
): Promise<PatientPage> {
  const search = new URLSearchParams({
    page: String(params.page),
    size: String(params.size ?? 20),
    sortBy: params.sortBy ?? "name",
    sortDir: params.sortDir ?? "asc",
  });

  if (params.gender) {
    search.set("gender", params.gender);
  }

  if (
    params.hasMedicalAid !== undefined &&
    params.hasMedicalAid !== null
  ) {
    search.set("medicalAid", params.hasMedicalAid ? "yes" : "no");
  }

  if (params.mpiNumber) {
    search.set("mpiNumber", params.mpiNumber);
  }

  if (params.citizenshipStatus) {
    search.set("citizenship", params.citizenshipStatus);
  }

  if (params.createdFrom) {
    search.set("createdFrom", params.createdFrom);
  }

  if (params.createdTo) {
    search.set("createdTo", params.createdTo);
  }

  return apiClient.get<PatientPage>(
    `/api/v1/patients?${search.toString()}`,
    {
      headers: tenantAuthHeaders(),
    },
  );
}

export async function getPatient(id: string): Promise<Patient> {
  return apiClient.get<Patient>(`/api/v1/patients/${id}`, {
    headers: tenantAuthHeaders(),
  });
}

/* -------------------------------------------------------------------------- */
/* Patient administration                                                     */
/* -------------------------------------------------------------------------- */

export interface UpdatePatientPayload {
  firstName: string;
  lastName: string;
  address: string;
  contactNumber: string;
  email?: string;
  medicalAidProvider?: string;
  medicalAidNumber?: string;
  passportNumber?: string;
  passportExpiry?: string;
  reason: string;
}

export async function updatePatient(
  id: string,
  payload: UpdatePatientPayload,
): Promise<Patient> {
  return apiClient.patch<Patient>(
    `/api/v1/admin/patients/${id}`,
    payload,
    {
      headers: tenantAuthHeaders(),
    },
  );
}

export interface PatientFieldHistoryEntry {
  id: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  reason: string;
  changedAt: string;
}

export async function getPatientFieldHistory(
  id: string,
): Promise<PatientFieldHistoryEntry[]> {
  const response = await apiClient.get<{
    items: PatientFieldHistoryEntry[];
  }>(`/api/v1/admin/patients/${id}/history`, {
    headers: tenantAuthHeaders(),
  });

  return response.items;
}

export interface ArchivePatientPayload {
  reason: string;
  deceasedDate?: string;
}

export async function archivePatient(
  id: string,
  payload: ArchivePatientPayload,
): Promise<Patient> {
  return apiClient.post<Patient>(
    `/api/v1/admin/patients/${id}/archive`,
    payload,
    {
      headers: tenantAuthHeaders(),
    },
  );
}

/* -------------------------------------------------------------------------- */
/* Patient documents                                                          */
/* -------------------------------------------------------------------------- */

export type PatientDocumentType =
  | "ID_COPY"
  | "MEDICAL_AID_CARD"
  | "PATIENT_PHOTO"
  | "BIRTH_CERTIFICATE";

export const ALLOWED_DOCUMENT_CONTENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const MAX_DOCUMENT_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export function validateDocumentFile(file: File): string | null {
  if (
    !ALLOWED_DOCUMENT_CONTENT_TYPES.includes(
      file.type as (typeof ALLOWED_DOCUMENT_CONTENT_TYPES)[number],
    )
  ) {
    return "Only PDF, JPEG, PNG, or WebP files are allowed.";
  }

  if (file.size > MAX_DOCUMENT_FILE_SIZE_BYTES) {
    return "File is too large. Maximum size is 5MB.";
  }

  return null;
}

export interface PatientDocument {
  id: string;
  documentType: PatientDocumentType;
  originalFilename: string;
  contentType: string;
  fileSize: number;
  uploadedAt: string;
}

export async function uploadPatientDocument(
  patientId: string,
  documentType: PatientDocumentType,
  file: File,
): Promise<PatientDocument> {
  const form = new FormData();

  form.append("file", file);

  const search = new URLSearchParams({
    documentType,
  });

  return apiClient.post<PatientDocument>(
    `/api/v1/patients/${patientId}/documents?${search.toString()}`,
    form,
    {
      headers: tenantAuthHeaders(),
    },
  );
}

export async function listPatientDocuments(
  patientId: string,
): Promise<PatientDocument[]> {
  const response = await apiClient.get<{
    items: PatientDocument[];
  }>(`/api/v1/patients/${patientId}/documents`, {
    headers: tenantAuthHeaders(),
  });

  return response.items;
}

export async function getPatientDocumentDownloadUrl(
  patientId: string,
  documentId: string,
): Promise<string> {
  const response = await apiClient.get<{ url: string }>(
    `/api/v1/patients/${patientId}/documents/${documentId}/download-url`,
    {
      headers: tenantAuthHeaders(),
    },
  );

  return response.url;
}

/* -------------------------------------------------------------------------- */
/* Guardians                                                                  */
/* -------------------------------------------------------------------------- */

export type GuardianRelationship =
  | "PARENT"
  | "LEGAL_GUARDIAN"
  | "GRANDPARENT"
  | "SIBLING"
  | "OTHER";

export interface Guardian {
  id: string;
  firstName: string;
  lastName: string;
  relationship: GuardianRelationship;
  contactNumber: string;
  idNumber: string | null;
  email: string | null;
  hasSignature: boolean;
  consentedAt: string | null;
  createdAt: string;
}

export interface AddGuardianPayload {
  firstName: string;
  lastName: string;
  relationship: GuardianRelationship;
  contactNumber: string;
  idNumber?: string;
  email?: string;
}

export async function addGuardian(
  patientId: string,
  payload: AddGuardianPayload,
): Promise<Guardian> {
  return apiClient.post<Guardian>(
    `/api/v1/patients/${patientId}/guardians`,
    payload,
    {
      headers: tenantAuthHeaders(),
    },
  );
}

export async function listGuardians(
  patientId: string,
): Promise<Guardian[]> {
  const response = await apiClient.get<{ items: Guardian[] }>(
    `/api/v1/patients/${patientId}/guardians`,
    {
      headers: tenantAuthHeaders(),
    },
  );

  return response.items;
}

export async function removeGuardian(
  patientId: string,
  guardianId: string,
): Promise<void> {
  await apiClient.delete<void>(
    `/api/v1/patients/${patientId}/guardians/${guardianId}`,
    {
      headers: tenantAuthHeaders(),
    },
  );
}

export async function uploadGuardianSignature(
  patientId: string,
  guardianId: string,
  signature: Blob,
): Promise<Guardian> {
  const form = new FormData();

  form.append("file", signature, "signature.png");

  return apiClient.post<Guardian>(
    `/api/v1/patients/${patientId}/guardians/${guardianId}/signature`,
    form,
    {
      headers: tenantAuthHeaders(),
    },
  );
}

export async function getGuardianSignatureDownloadUrl(
  patientId: string,
  guardianId: string,
): Promise<string> {
  const response = await apiClient.get<{ url: string }>(
    `/api/v1/patients/${patientId}/guardians/${guardianId}/signature/download-url`,
    {
      headers: tenantAuthHeaders(),
    },
  );

  return response.url;
}

/* -------------------------------------------------------------------------- */
/* Cross-tenant patient migration                                             */
/* -------------------------------------------------------------------------- */

export interface MigrationDestinationOrganization {
  id: string;
  displayName: string;
}

export async function listMigrationDestinationOrganizations(): Promise<
  MigrationDestinationOrganization[]
> {
  const response = await apiClient.get<{
    items: MigrationDestinationOrganization[];
  }>("/api/v1/admin/migration/organizations", {
    headers: tenantAuthHeaders(),
  });

  return response.items;
}

export interface MigrationDestinationFacility {
  id: string;
  name: string;
}

export async function listMigrationDestinationFacilities(
  organizationId: string,
): Promise<MigrationDestinationFacility[]> {
  const response = await apiClient.get<{
    items: MigrationDestinationFacility[];
  }>(
    `/api/v1/admin/migration/organizations/${organizationId}/facilities`,
    {
      headers: tenantAuthHeaders(),
    },
  );

  return response.items;
}

export interface MigratePatientPayload {
  destinationOrganizationId: string;
  destinationFacilityId: string;
  reason: string;
}

export interface MigrationResult {
  destinationPatientId: string;
  destinationMpiNumber: string;
}

export async function migratePatient(
  id: string,
  payload: MigratePatientPayload,
): Promise<MigrationResult> {
  return apiClient.post<MigrationResult>(
    `/api/v1/admin/patients/${id}/migrate`,
    payload,
    {
      headers: tenantAuthHeaders(),
    },
  );
}

export interface PatientMigrationDestinationView {
  patient: Patient;
  documents: PatientDocument[];
  destinationOrganizationDisplayName: string;
  destinationFacilityName: string;
}

export async function getPatientMigrationDestinationView(
  id: string,
): Promise<PatientMigrationDestinationView> {
  return apiClient.get<PatientMigrationDestinationView>(
    `/api/v1/admin/patients/${id}/migration/destination-view`,
    {
      headers: tenantAuthHeaders(),
    },
  );
}

export async function getMigrationDestinationDocumentDownloadUrl(
  id: string,
  documentId: string,
): Promise<string> {
  const response = await apiClient.get<{ url: string }>(
    `/api/v1/admin/patients/${id}/migration/destination-view/documents/${documentId}/download-url`,
    {
      headers: tenantAuthHeaders(),
    },
  );

  return response.url;
}
