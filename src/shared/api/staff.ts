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
