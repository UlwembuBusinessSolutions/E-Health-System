import { apiClient } from "./client";

// The patient portal's own auth module — mirrors shared/api/auth.ts
// (staff) field-for-field, with two deliberate differences: a real
// register() call (patients create their own account; staff don't), and
// X-Patient-Key instead of Authorization — PatientJwtAuthenticationFilter's
// own why-note on why a shared header with staff's Bearer token would
// collide.

const PATIENT_TOKEN_KEY = "ulwembu.patientToken";
const PATIENT_TENANT_SLUG_KEY = "ulwembu.patientTenantSlug";

export function getPatientToken(): string | null {
  return sessionStorage.getItem(PATIENT_TOKEN_KEY);
}

function setPatientToken(token: string): void {
  sessionStorage.setItem(PATIENT_TOKEN_KEY, token);
}

export function getPatientTenantSlug(): string | null {
  return sessionStorage.getItem(PATIENT_TENANT_SLUG_KEY);
}

function setPatientTenantSlug(slug: string): void {
  sessionStorage.setItem(PATIENT_TENANT_SLUG_KEY, slug);
}

export function clearPatientAuth(): void {
  sessionStorage.removeItem(PATIENT_TOKEN_KEY);
}

export function patientAuthHeaders(): HeadersInit {
  const token = getPatientToken();
  const slug = getPatientTenantSlug();
  return {
    ...(token ? { "X-Patient-Key": token } : {}),
    ...(slug ? { "X-Tenant-ID": slug } : {}),
  };
}

export interface PatientAccountSummary {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  linked: boolean;
}

export interface PatientOwnRecords {
  mpiNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  contactNumber: string;
  email: string | null;
  visits: PatientOwnVisit[];
}

export interface PatientOwnVisit {
  id: string;
  facilityName: string | null;
  visitType: string;
  serviceStream: string;
  visitDateTime: string;
}

interface AuthResponse {
  accessToken: string;
  expiresAt: string;
  account: PatientAccountSummary;
}

export interface PatientRegistrationStarted {
  verificationRequired: boolean;
  email: string;
  expiresInMinutes: number;
}

export interface RegisterPatientAccountPayload {
  tenantSlug: string;
  firstName: string;
  lastName: string;
  idNumber: string;
  address: string;
  contactNumber: string;
  email: string;
  password: string;
}

export async function registerPatientAccount(
  payload: RegisterPatientAccountPayload,
): Promise<PatientRegistrationStarted> {
  setPatientTenantSlug(payload.tenantSlug);
  return apiClient.post<PatientRegistrationStarted>(
    "/api/v1/patient/register",
    {
      firstName: payload.firstName,
      lastName: payload.lastName,
      idNumber: payload.idNumber,
      address: payload.address,
      contactNumber: payload.contactNumber,
      email: payload.email,
      password: payload.password,
    },
    { headers: { "X-Tenant-ID": payload.tenantSlug } },
  );
}

export async function verifyPatientRegistrationEmail(payload: {
  email: string;
  code: string;
}): Promise<PatientAccountSummary> {
  const response = await apiClient.post<AuthResponse>(
    "/api/v1/patient/verify-email",
    payload,
    { headers: patientAuthHeaders() },
  );
  setPatientToken(response.accessToken);
  return response.account;
}

export interface PatientLoginPayload {
  identifier: string;
  password: string;
  tenantSlug: string;
}

export async function patientLogin(payload: PatientLoginPayload): Promise<PatientAccountSummary> {
  setPatientTenantSlug(payload.tenantSlug);
  const response = await apiClient.post<AuthResponse>(
    "/api/v1/patient/auth/login",
    { identifier: payload.identifier, password: payload.password },
    { headers: { "X-Tenant-ID": payload.tenantSlug } },
  );
  setPatientToken(response.accessToken);
  return response.account;
}

export interface PatientPasswordResetRequest {
  identifier: string;
  tenantSlug: string;
}

export async function requestPatientPasswordReset(payload: PatientPasswordResetRequest): Promise<void> {
  await apiClient.post<void>(
    "/api/v1/patient/auth/password-reset/request",
    { identifier: payload.identifier },
    { headers: { "X-Tenant-ID": payload.tenantSlug } },
  );
}

export interface ConfirmPatientPasswordReset extends PatientPasswordResetRequest {
  code: string;
  newPassword: string;
}

export async function confirmPatientPasswordReset(payload: ConfirmPatientPasswordReset): Promise<void> {
  await apiClient.post<void>(
    "/api/v1/patient/auth/password-reset/confirm",
    { identifier: payload.identifier, code: payload.code, newPassword: payload.newPassword },
    { headers: { "X-Tenant-ID": payload.tenantSlug } },
  );
}

// Same rehydration role as auth.ts's own getCurrentUser() — a stored token
// proves someone was signed in but carries no name/email of its own, so a
// fresh page load round-trips to the server for the same identity
// register()/patientLogin() already returned.
export async function getCurrentPatientAccount(): Promise<PatientAccountSummary> {
  const token = getPatientToken();
  if (!token) throw new Error("No stored session to rehydrate");
  return apiClient.get<PatientAccountSummary>("/api/v1/patient/auth/me", { headers: patientAuthHeaders() });
}

export async function getOwnPatientRecords(): Promise<PatientOwnRecords> {
  return apiClient.get<PatientOwnRecords>("/api/v1/patient/records", { headers: patientAuthHeaders() });
}

export async function patientLogout(): Promise<void> {
  await apiClient.post<void>("/api/v1/patient/auth/logout", undefined, { headers: patientAuthHeaders() });
}
