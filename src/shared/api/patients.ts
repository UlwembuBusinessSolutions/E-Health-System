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
  // Optional — cross-tenant patient migration's own notification email is
  // the first thing that actually reads this; nothing required it before.
  email?: string;
  medicalAidProvider?: string;
  medicalAidNumber?: string;
  // Supplementary to idNumber, not an alternative — see
  // PatientController.RegisterPatientRequest's own why-note.
  passportNumber?: string;
  passportExpiry?: string; // "yyyy-MM-dd"
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
  email: string | null;
  medicalAidProvider: string | null;
  medicalAidNumber: string | null;
  passportNumber: string | null;
  passportExpiry: string | null;
  createdAt: string;
  // PREG-US-017 AC2 / PREG-US-018 — the only way this record ever leaves
  // active use; there is no delete anywhere in this API. One-way: once
  // true, it never goes false again (no unarchive endpoint exists).
  archived: boolean;
  archivedReason: string | null;
  archivedAt: string | null;
  deceasedDate: string | null;
  // Cross-tenant patient migration — true only for the single-record GET
  // (PatientController.get()'s own why-note); always false on the list/
  // search endpoints below, since a migrated patient is always archived and
  // therefore already excluded from both of those.
  migrated: boolean;
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

export interface PatientPage {
  items: Patient[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
}

// Matches PatientService.buildSort()'s own key set field-for-field — "age"
// is the one case where the API's sortDir and the underlying column's
// direction diverge (ascending age = descending date of birth), handled
// entirely server-side so callers never have to think about it.
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
  createdFrom?: string; // "yyyy-MM-dd", matches PatientService.list()'s own UTC-day-boundary contract
  createdTo?: string;
}

// The default roster view — everyone registered in the tenant, paged,
// sorted, and optionally filtered, shown before a search query narrows it
// down. Distinct from searchPatients() above, which returns nothing for an
// empty query and doesn't support sort/filter at all. mpiNumber here is a
// substring filter (PatientRepository.findFiltered()'s own LIKE match),
// unlike searchPatients()'s exact-only MPI branch.
export async function listPatients(params: ListPatientsParams): Promise<PatientPage> {
  const search = new URLSearchParams({
    page: String(params.page),
    size: String(params.size ?? 20),
    sortBy: params.sortBy ?? "name",
    sortDir: params.sortDir ?? "asc",
  });
  if (params.gender) search.set("gender", params.gender);
  if (params.hasMedicalAid !== undefined && params.hasMedicalAid !== null) {
    search.set("medicalAid", params.hasMedicalAid ? "yes" : "no");
  }
  if (params.mpiNumber) search.set("mpiNumber", params.mpiNumber);
  if (params.citizenshipStatus) search.set("citizenship", params.citizenshipStatus);
  if (params.createdFrom) search.set("createdFrom", params.createdFrom);
  if (params.createdTo) search.set("createdTo", params.createdTo);
  return apiClient.get<PatientPage>(`/api/v1/patients?${search.toString()}`, {
    headers: tenantAuthHeaders(),
  });
}

export async function getPatient(id: string): Promise<Patient> {
  return apiClient.get<Patient>(`/api/v1/patients/${id}`, { headers: tenantAuthHeaders() });
}

// PREG-US-016 — admin-only server-side (SecurityConfig's own
// /api/v1/admin/** -> ORG_ADMIN matcher), so this is only ever called from
// UI already gated on user.role === "ORG_ADMIN". No idNumber field here —
// Patient has no setter for it (Backend's own why-note); mpiNumber/
// dateOfBirth/gender/citizenshipStatus are never editable by any role.
// reason is required on every call, not just ones touching a clinically
// significant field — PatientFieldHistory's own why-note on why this
// doesn't try to classify which fields count.
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

export async function updatePatient(id: string, payload: UpdatePatientPayload): Promise<Patient> {
  return apiClient.patch<Patient>(`/api/v1/admin/patients/${id}`, payload, { headers: tenantAuthHeaders() });
}

export interface PatientFieldHistoryEntry {
  id: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  reason: string;
  changedAt: string;
}

export async function getPatientFieldHistory(id: string): Promise<PatientFieldHistoryEntry[]> {
  const response = await apiClient.get<{ items: PatientFieldHistoryEntry[] }>(
    `/api/v1/admin/patients/${id}/history`,
    { headers: tenantAuthHeaders() },
  );
  return response.items;
}

export interface ArchivePatientPayload {
  reason: string;
  deceasedDate?: string; // "yyyy-MM-dd" — optional, only when the archive is due to death
}

// PREG-US-017 AC2 / PREG-US-018 — admin-only server-side, one-way (no
// unarchive endpoint), same as the backend's own why-notes. Locks out
// further edits to this patient's own record and its documents/guardians
// (PatientService/PatientDocumentService/PatientGuardianService all guard
// against an archived patient) — the UI should confirm before calling this,
// not fire it from a single accidental click.
export async function archivePatient(id: string, payload: ArchivePatientPayload): Promise<Patient> {
  return apiClient.post<Patient>(`/api/v1/admin/patients/${id}/archive`, payload, {
    headers: tenantAuthHeaders(),
  });
}

// Matches PatientDocumentType field-for-field.
export type PatientDocumentType = "ID_COPY" | "MEDICAL_AID_CARD" | "PATIENT_PHOTO" | "BIRTH_CERTIFICATE";

// Mirrors PatientDocumentService.ALLOWED_CONTENT_TYPES and application.yml's
// spring.servlet.multipart.max-file-size exactly — the backend is still the
// real enforcement (GlobalExceptionHandler's own InvalidFileTypeException/
// MaxUploadSizeExceededException handlers), this just catches the same
// rejection before a round trip: at file-selection time, where it also
// covers drag-and-drop (the <input accept> attribute is browse-dialog-only
// and silently does nothing for a dropped file).
export const ALLOWED_DOCUMENT_CONTENT_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
export const MAX_DOCUMENT_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export function validateDocumentFile(file: File): string | null {
  if (!ALLOWED_DOCUMENT_CONTENT_TYPES.includes(file.type as (typeof ALLOWED_DOCUMENT_CONTENT_TYPES)[number])) {
    return "Only PDF, JPEG, PNG, or WebP files are allowed.";
  }
  if (file.size > MAX_DOCUMENT_FILE_SIZE_BYTES) {
    return "File is too large. Maximum size is 5MB.";
  }
  return null;
}

// s3Key is never part of this shape — PatientController.PatientDocumentSummary's
// own why-note. getPatientDocumentDownloadUrl() below is the only way to
// actually reach the file.
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
  const search = new URLSearchParams({ documentType });
  return apiClient.post<PatientDocument>(`/api/v1/patients/${patientId}/documents?${search.toString()}`, form, {
    headers: tenantAuthHeaders(),
  });
}

export async function listPatientDocuments(patientId: string): Promise<PatientDocument[]> {
  const response = await apiClient.get<{ items: PatientDocument[] }>(`/api/v1/patients/${patientId}/documents`, {
    headers: tenantAuthHeaders(),
  });
  return response.items;
}

// A fresh, short-lived URL every call (PatientDocumentService.getDownloadUrl()'s
// own why-note) — callers fetch this right before navigating to it, never
// cache it past that one use.
export async function getPatientDocumentDownloadUrl(patientId: string, documentId: string): Promise<string> {
  const response = await apiClient.get<{ url: string }>(
    `/api/v1/patients/${patientId}/documents/${documentId}/download-url`,
    { headers: tenantAuthHeaders() },
  );
  return response.url;
}

// Matches GuardianRelationship field-for-field.
export type GuardianRelationship = "PARENT" | "LEGAL_GUARDIAN" | "GRANDPARENT" | "SIBLING" | "OTHER";

// signatureS3Key is never part of this shape, same reasoning as Patient
// documents' own s3Key omission — hasSignature + getGuardianSignatureDownloadUrl()
// below are the only things a caller needs.
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

export async function addGuardian(patientId: string, payload: AddGuardianPayload): Promise<Guardian> {
  return apiClient.post<Guardian>(`/api/v1/patients/${patientId}/guardians`, payload, {
    headers: tenantAuthHeaders(),
  });
}

export async function listGuardians(patientId: string): Promise<Guardian[]> {
  const response = await apiClient.get<{ items: Guardian[] }>(`/api/v1/patients/${patientId}/guardians`, {
    headers: tenantAuthHeaders(),
  });
  return response.items;
}

// A removal, not an edit — PatientGuardianService.remove()'s own why-note;
// a wrong entry gets deleted and re-added, not amended in place.
export async function removeGuardian(patientId: string, guardianId: string): Promise<void> {
  await apiClient.delete<void>(`/api/v1/patients/${patientId}/guardians/${guardianId}`, {
    headers: tenantAuthHeaders(),
  });
}

export async function uploadGuardianSignature(
  patientId: string,
  guardianId: string,
  signature: Blob,
): Promise<Guardian> {
  const form = new FormData();
  form.append("file", signature, "signature.png");
  return apiClient.post<Guardian>(`/api/v1/patients/${patientId}/guardians/${guardianId}/signature`, form, {
    headers: tenantAuthHeaders(),
  });
}

export async function getGuardianSignatureDownloadUrl(patientId: string, guardianId: string): Promise<string> {
  const response = await apiClient.get<{ url: string }>(
    `/api/v1/patients/${patientId}/guardians/${guardianId}/signature/download-url`,
    { headers: tenantAuthHeaders() },
  );
  return response.url;
}

// Cross-tenant patient migration — the destination picker's first step:
// every other ACTIVE organization this tenant could migrate a patient to.
// id + displayName only, matching PatientController.MigrationOrganizationSummary's
// own deliberately narrow shape — this is the first endpoint that gives
// ordinary tenant staff any visibility into another tenant's existence at
// all, so it stays that narrow on purpose.
export interface MigrationDestinationOrganization {
  id: string;
  displayName: string;
}

export async function listMigrationDestinationOrganizations(): Promise<MigrationDestinationOrganization[]> {
  const response = await apiClient.get<{ items: MigrationDestinationOrganization[] }>(
    "/api/v1/admin/migration/organizations",
    { headers: tenantAuthHeaders() },
  );
  return response.items;
}

// The dependent second step, once an organization is chosen.
export interface MigrationDestinationFacility {
  id: string;
  name: string;
}

export async function listMigrationDestinationFacilities(
  organizationId: string,
): Promise<MigrationDestinationFacility[]> {
  const response = await apiClient.get<{ items: MigrationDestinationFacility[] }>(
    `/api/v1/admin/migration/organizations/${organizationId}/facilities`,
    { headers: tenantAuthHeaders() },
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

// PREG's cross-tenant migration — admin-only server-side, same
// /api/v1/admin/** -> ORG_ADMIN matcher as archivePatient/updatePatient
// above. One-way, same as archiving: the origin record is locked
// (archived: true, migrated: true) the moment this succeeds.
export async function migratePatient(id: string, payload: MigratePatientPayload): Promise<MigrationResult> {
  return apiClient.post<MigrationResult>(`/api/v1/admin/patients/${id}/migrate`, payload, {
    headers: tenantAuthHeaders(),
  });
}

// The origin tenant's "full ongoing access" view — a live read of the
// destination record, not a frozen snapshot taken at migration time.
// Deliberately no visits/vitals/prescriptions field: migration only ever
// moves the core record (demographics, MPI, documents) — the destination
// starts a fresh clinical history for this person — so there's nothing of
// that kind to show here.
export interface PatientMigrationDestinationView {
  patient: Patient;
  documents: PatientDocument[];
  destinationOrganizationDisplayName: string;
  destinationFacilityName: string;
}

export async function getPatientMigrationDestinationView(id: string): Promise<PatientMigrationDestinationView> {
  return apiClient.get<PatientMigrationDestinationView>(`/api/v1/admin/patients/${id}/migration/destination-view`, {
    headers: tenantAuthHeaders(),
  });
}

export async function getMigrationDestinationDocumentDownloadUrl(id: string, documentId: string): Promise<string> {
  const response = await apiClient.get<{ url: string }>(
    `/api/v1/admin/patients/${id}/migration/destination-view/documents/${documentId}/download-url`,
    { headers: tenantAuthHeaders() },
  );
  return response.url;
}
