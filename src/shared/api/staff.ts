import type { Gender } from "./types";
import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";

// createStaff() and uploadStaffPhoto() are wired to the real backend; the
// three uniqueness-check functions below are not — there's no real
// "check availability" endpoint for any of them (same gap as platform.ts's
// checkSlugAvailable()), only the create call itself, which 409s on a real
// collision. Always-true no-ops so the on-blur checks never block
// submission; AddStaffScreen's mutation error handling already surfaces
// the real 409 message if creation itself fails.

// Matches StaffController.CreateStaffRequest's EmploymentType constants
// exactly (api/src/main/java/.../identity/EmploymentType.java).
export type EmploymentType =
  | "PERMANENT"
  | "CONTRACT"
  | "INTERN"
  | "COMMUNITY_SERVICE"
  | "EXTENDED_PUBLIC_WORKS"
  | "SECONDED";

// Single source of truth for the label text — shared by AddStaffScreen's
// create form and StaffListPage's post-hire edit control, so the two never
// drift apart.
export const EMPLOYMENT_TYPE_OPTIONS: { value: EmploymentType; label: string }[] = [
  { value: "PERMANENT", label: "Permanent" },
  { value: "CONTRACT", label: "Contract" },
  { value: "INTERN", label: "Intern" },
  { value: "COMMUNITY_SERVICE", label: "Community service" },
  { value: "EXTENDED_PUBLIC_WORKS", label: "Extended public works" },
  { value: "SECONDED", label: "Seconded" },
];

export function employmentTypeLabel(type: EmploymentType | null): string {
  return EMPLOYMENT_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? "—";
}

export interface CreateStaffPayload {
  firstName: string;
  lastName: string;
  employeeNumber: string;
  idNumber?: string;
  email: string;
  contactNumber: string;
  gender: Gender;
  dateOfBirth?: string;
  employmentStartDate?: string;
  employmentType?: EmploymentType;
  managerId?: string;
  facilityId: string;
  additionalFacilityIds?: string[];
  department?: string;
  designation?: string;
  roleId: string;
  sancNumber?: string;
  sancExpiryDate?: string;
  hpcsaNumber?: string;
  hpcsaExpiryDate?: string;
  sapcNumber?: string;
  sapcExpiryDate?: string;
  emergencyContactName?: string;
  emergencyContactRelationship?: string;
  emergencyContactPhone?: string;
  temporaryPassword: string;
}

export interface StaffSummary {
  id: string;
  employeeNumber: string;
  email: string;
  firstName: string;
  lastName: string;
  facilityId: string;
  mustChangePassword: boolean;
}

export async function createStaff(payload: CreateStaffPayload): Promise<StaffSummary> {
  return apiClient.post<StaffSummary>("/api/v1/admin/staff", payload, { headers: tenantAuthHeaders() });
}

// Matches UserStatus field-for-field.
export type StaffStatus = "ACTIVE" | "LOCKED" | "DISABLED";

// The roster row — matches StaffController.StaffRosterEntry field-for-field.
// roles is a list because user_roles has no cardinality constraint
// (StaffService.StaffRosterEntry's own why-note), even though a typical
// staff member holds exactly one today.
export interface StaffRosterEntry {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  contactNumber: string;
  roles: string[];
  facilityId: string | null;
  status: StaffStatus;
  lastLoginAt: string | null;
  employmentType: EmploymentType | null;
  employmentEndDate: string | null;
}

// ORG_ADMIN-only server-side (SecurityConfig's /api/v1/admin/** matcher) —
// a full roster is admin territory, not something every staff member needs
// to see about their colleagues.
export async function listStaff(): Promise<StaffRosterEntry[]> {
  const response = await apiClient.get<{ items: StaffRosterEntry[] }>("/api/v1/admin/staff", {
    headers: tenantAuthHeaders(),
  });
  return response.items;
}

// Admin-triggered — generates and returns a new temporary password exactly
// once, same discipline as createStaff()'s own account-creation flow. Also
// emails it (StaffService.resetPassword()'s own why-note), so this isn't
// the only place it's recoverable from, but it's the only place the caller
// gets to see and hand it over directly.
export interface ResetPasswordResponse {
  temporaryPassword: string;
}

export async function resetStaffPassword(staffId: string): Promise<ResetPasswordResponse> {
  return apiClient.post<ResetPasswordResponse>(`/api/v1/admin/staff/${staffId}/reset-password`, undefined, {
    headers: tenantAuthHeaders(),
  });
}

// Refuses (409) to disable an organization's last remaining ORG_ADMIN —
// StaffService.setEnabled()'s own guard.
export async function setStaffEnabled(staffId: string, enabled: boolean): Promise<void> {
  await apiClient.post<void>(`/api/v1/admin/staff/${staffId}/${enabled ? "enable" : "disable"}`, undefined, {
    headers: tenantAuthHeaders(),
  });
}

// "This person left" — stamps employmentEndDate and disables login in the
// same backend transaction (StaffService.offboardStaff()). Distinct from
// setStaffEnabled(false): that one is reversible and says nothing about why;
// this one is a real HR fact.
export async function offboardStaff(staffId: string, employmentEndDate: string): Promise<void> {
  await apiClient.post<void>(`/api/v1/admin/staff/${staffId}/offboard`, { employmentEndDate }, {
    headers: tenantAuthHeaders(),
  });
}

// The reverse of offboardStaff() above — clears employmentEndDate and
// re-enables login in one call (StaffService.reboardStaff()'s own why-note
// on why this isn't just setStaffEnabled(true, ...)).
export async function reboardStaff(staffId: string): Promise<void> {
  await apiClient.post<void>(`/api/v1/admin/staff/${staffId}/reboard`, undefined, {
    headers: tenantAuthHeaders(),
  });
}

// "Their contract type changed while they're still here" — never touches
// status or employmentEndDate either way (StaffService.updateEmploymentType()).
export async function updateStaffEmploymentType(staffId: string, employmentType: EmploymentType): Promise<void> {
  await apiClient.post<void>(`/api/v1/admin/staff/${staffId}/employment-type`, { employmentType }, {
    headers: tenantAuthHeaders(),
  });
}

// The edit-details form's own read/write pair — matches StaffController.
// StaffDetailResponse field-for-field. Deliberately excludes email
// (login identifier), facility/role, employmentType, status/
// employmentEndDate and password: each already has its own dedicated
// endpoint above, same "one lever per real-world fact" reasoning as
// offboardStaff() vs setStaffEnabled().
export interface StaffDetail {
  id: string;
  employeeNumber: string;
  email: string;
  firstName: string;
  lastName: string;
  contactNumber: string;
  idNumber: string | null;
  department: string | null;
  designation: string | null;
  managerId: string | null;
  dateOfBirth: string | null;
  sancNumber: string | null;
  sancExpiryDate: string | null;
  hpcsaNumber: string | null;
  hpcsaExpiryDate: string | null;
  sapcNumber: string | null;
  sapcExpiryDate: string | null;
  emergencyContactName: string | null;
  emergencyContactRelationship: string | null;
  emergencyContactPhone: string | null;
  facilityId: string | null;
  status: StaffStatus;
  profilePhotoUrl: string | null;
}

export async function getStaffDetail(staffId: string): Promise<StaffDetail> {
  return apiClient.get<StaffDetail>(`/api/v1/admin/staff/${staffId}`, { headers: tenantAuthHeaders() });
}

export interface UpdateStaffDetailsPayload {
  firstName: string;
  lastName: string;
  contactNumber: string;
  idNumber?: string;
  department?: string;
  designation?: string;
  managerId?: string;
  dateOfBirth?: string;
  sancNumber?: string;
  sancExpiryDate?: string;
  hpcsaNumber?: string;
  hpcsaExpiryDate?: string;
  sapcNumber?: string;
  sapcExpiryDate?: string;
  emergencyContactName?: string;
  emergencyContactRelationship?: string;
  emergencyContactPhone?: string;
}

export async function updateStaffDetails(staffId: string, payload: UpdateStaffDetailsPayload): Promise<StaffSummary> {
  return apiClient.post<StaffSummary>(`/api/v1/admin/staff/${staffId}/details`, payload, {
    headers: tenantAuthHeaders(),
  });
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function checkEmployeeNumberAvailable(_employeeNumber: string): Promise<boolean> {
  await delay(150);
  return true;
}

export async function checkStaffEmailAvailable(_email: string): Promise<boolean> {
  await delay(150);
  return true;
}

export async function checkStaffContactAvailable(_contactNumber: string): Promise<boolean> {
  await delay(150);
  return true;
}

export interface PhotoUploadResponse {
  profilePhotoUrl: string;
}

export async function uploadStaffPhoto(staffId: string, file: File): Promise<PhotoUploadResponse> {
  const form = new FormData();
  form.append("file", file);
  return apiClient.post<PhotoUploadResponse>(`/api/v1/admin/staff/${staffId}/photo`, form, {
    headers: tenantAuthHeaders(),
  });
}

// Matches StaffDocumentType field-for-field — qualification certificates,
// professional registration proof, ID copies, contracts and other HR
// paperwork, same upload/list/download-url/delete shape as
// shared/api/patients.ts's own PatientDocument, just against a staff
// member instead of a patient (and with a delete path patient documents
// deliberately don't have — StaffDocumentService.delete()'s own why-note).
export type StaffDocumentType =
  | "QUALIFICATION_CERTIFICATE"
  | "PROFESSIONAL_REGISTRATION_CERTIFICATE"
  | "ID_COPY"
  | "CONTRACT"
  | "OTHER";

export const STAFF_DOCUMENT_TYPE_OPTIONS: { value: StaffDocumentType; label: string }[] = [
  { value: "QUALIFICATION_CERTIFICATE", label: "Qualification certificate" },
  { value: "PROFESSIONAL_REGISTRATION_CERTIFICATE", label: "Professional registration certificate" },
  { value: "ID_COPY", label: "ID copy" },
  { value: "CONTRACT", label: "Contract" },
  { value: "OTHER", label: "Other" },
];

// Mirrors patients.ts's own validateDocumentFile()/ALLOWED_DOCUMENT_CONTENT_TYPES
// — same 5MB/PDF-JPEG-PNG-WebP limits StaffDocumentService.ALLOWED_CONTENT_TYPES
// and application.yml's multipart limit enforce server-side; this just
// catches the same rejection before a round trip. Kept as its own small
// copy rather than importing patients.ts's version — same "duplicate a
// three-line pure function rather than reach across an unrelated feature
// module" convention this codebase already follows elsewhere.
export const ALLOWED_STAFF_DOCUMENT_CONTENT_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
export const MAX_STAFF_DOCUMENT_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export function validateStaffDocumentFile(file: File): string | null {
  if (!ALLOWED_STAFF_DOCUMENT_CONTENT_TYPES.includes(file.type as (typeof ALLOWED_STAFF_DOCUMENT_CONTENT_TYPES)[number])) {
    return "Only PDF, JPEG, PNG, or WebP files are allowed.";
  }
  if (file.size > MAX_STAFF_DOCUMENT_FILE_SIZE_BYTES) {
    return "File is too large. Maximum size is 5MB.";
  }
  return null;
}

// s3Key is never part of this shape — StaffController.StaffDocumentSummary's
// own why-note. getStaffDocumentDownloadUrl() below is the only way to
// actually reach the file.
export interface StaffDocument {
  id: string;
  documentType: StaffDocumentType;
  originalFilename: string;
  contentType: string;
  fileSize: number;
  uploadedAt: string;
}

export async function uploadStaffDocument(
  staffId: string,
  documentType: StaffDocumentType,
  file: File,
): Promise<StaffDocument> {
  const form = new FormData();
  form.append("file", file);
  const search = new URLSearchParams({ documentType });
  return apiClient.post<StaffDocument>(`/api/v1/admin/staff/${staffId}/documents?${search.toString()}`, form, {
    headers: tenantAuthHeaders(),
  });
}

export async function listStaffDocuments(staffId: string): Promise<StaffDocument[]> {
  const response = await apiClient.get<{ items: StaffDocument[] }>(`/api/v1/admin/staff/${staffId}/documents`, {
    headers: tenantAuthHeaders(),
  });
  return response.items;
}

// A fresh, short-lived URL every call (StaffDocumentService.getDownloadUrl()'s
// own why-note) — callers fetch this right before navigating to it, never
// cache it past that one use.
export async function getStaffDocumentDownloadUrl(staffId: string, documentId: string): Promise<string> {
  const response = await apiClient.get<{ url: string }>(
    `/api/v1/admin/staff/${staffId}/documents/${documentId}/download-url`,
    { headers: tenantAuthHeaders() },
  );
  return response.url;
}

export async function deleteStaffDocument(staffId: string, documentId: string): Promise<void> {
  await apiClient.delete<void>(`/api/v1/admin/staff/${staffId}/documents/${documentId}`, {
    headers: tenantAuthHeaders(),
  });
}
