import type { AuthenticatedUser } from "./types";
import { apiClient } from "./client";

// login() is wired to the real backend; requestPasswordReset()/resetPassword()
// below are still TEMP mocks — out of scope for the staff-creation/photo/
// logo-upload testing pass this was wired up for. Swap those two the same
// way once needed.

const TENANT_TOKEN_KEY = "ulwembu.tenantToken";
const TENANT_SLUG_KEY = "ulwembu.tenantSlug";

// sessionStorage, not localStorage — same reasoning as the platform token
// store (shared/api/platform.ts): clears when the tab closes rather than
// sitting around indefinitely.
export function getTenantToken(): string | null {
  return sessionStorage.getItem(TENANT_TOKEN_KEY);
}

function setTenantToken(token: string): void {
  sessionStorage.setItem(TENANT_TOKEN_KEY, token);
}

export function getTenantSlug(): string | null {
  return sessionStorage.getItem(TENANT_SLUG_KEY);
}

function setTenantSlug(slug: string): void {
  sessionStorage.setItem(TENANT_SLUG_KEY, slug);
}

// Clears the token only, deliberately leaves the slug — it isn't sensitive
// (it's already sitting in the URL of every tenant page), and RequireAuth's
// own redirect reads getTenantSlug() to send a signed-out visitor back to
// their own org's login rather than the bare /login gate. Erasing it here
// used to race that exact redirect: BrowserRouter's location update can lag
// one render behind a plain setState-driven one, so RequireAuth was
// observed re-rendering with the new path already in window.location but
// the old route tree (and therefore this component) still mounted — if the
// slug was already gone by then, its own redirect fell back to bare /login
// and silently overwrote whichever tenant-scoped URL the sign-out click had
// just navigated to. The next login() call overwrites this regardless of
// which org signs in next, so nothing goes stale.
export function clearTenantAuth(): void {
  sessionStorage.removeItem(TENANT_TOKEN_KEY);
}

// Every other tenant-scoped module (staff.ts, organization.ts) sends these
// on every call — Authorization from login, X-Tenant-ID from whichever
// slug was used to log in. There's no tenant-resolution mechanism (no
// subdomain routing, no real GET .../branding endpoint yet — see
// TenantContext.tsx's own why-note) beyond "whatever was typed into the
// login form," which is why login() takes it as a real form field below,
// not something inferred.
export function tenantAuthHeaders(): HeadersInit {
  const token = getTenantToken();
  const slug = getTenantSlug();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(slug ? { "X-Tenant-ID": slug } : {}),
  };
}

// JWTs are signature-protected, not confidentiality-protected — decoding
// the payload client-side (no verification, the server already did that)
// to read the roles claim is the normal, correct way apps read their own
// token's claims for UI-only role gating. The real enforcement is still
// entirely server-side (SecurityConfig's hasRole checks); this only
// decides what the UI shows, same trust boundary as any other client-side
// state.
function decodeRolesFromToken(token: string): string[] {
  try {
    const payload = token.split(".")[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return Array.isArray(decoded.roles) ? decoded.roles : [];
  } catch {
    return [];
  }
}

export interface LoginPayload {
  email: string;
  password: string;
  tenantSlug: string;
}

interface LoginResponse {
  accessToken: string;
  expiresAt: string;
  user: { id: string; email: string; firstName: string; lastName: string };
}

export async function login(payload: LoginPayload): Promise<AuthenticatedUser> {
  setTenantSlug(payload.tenantSlug);
  const response = await apiClient.post<LoginResponse>(
    "/api/v1/auth/login",
    { email: payload.email, password: payload.password },
    { headers: { "X-Tenant-ID": payload.tenantSlug } },
  );
  setTenantToken(response.accessToken);

  const roles = decodeRolesFromToken(response.accessToken);
  return {
    id: response.user.id,
    email: response.user.email,
    firstName: response.user.firstName,
    lastName: response.user.lastName,
    // The real LoginResponse has no role field at all — this is the known
    // drift api-reference.html already flags (Section "Tenant auth"). Read
    // from the token's own roles claim instead of leaving this hardcoded.
    role: roles.includes("ORG_ADMIN") ? "ORG_ADMIN" : (roles[0] ?? "STAFF"),
  };
}

// Real from here on — PasswordResetService (api-reference.html, "Tenant
// auth" section). Both endpoints are permitAll server-side (no token exists
// yet for someone who can't log in), but TenantFilter still resolves the
// schema to search from X-Tenant-ID alone, independent of the Authorization
// header — built from the tenantSlug passed in here, same as login()'s own
// payload field, rather than tenantAuthHeaders()'s sessionStorage-backed
// getTenantSlug(): someone who has never successfully logged in on this
// device has no slug in storage yet, only the one in the URL they arrived
// on (ForgotPasswordScreen's own :tenantSlug route param).
export interface RequestPasswordResetPayload {
  email: string;
  tenantSlug: string;
}

export async function requestPasswordReset(payload: RequestPasswordResetPayload): Promise<void> {
  await apiClient.post<void>(
    "/api/v1/auth/password-reset/request",
    { email: payload.email },
    { headers: { "X-Tenant-ID": payload.tenantSlug } },
  );
}

export interface ResetPasswordPayload {
  email: string;
  code: string;
  newPassword: string;
  tenantSlug: string;
}

export async function resetPassword(payload: ResetPasswordPayload): Promise<void> {
  await apiClient.post<void>(
    "/api/v1/auth/password-reset/confirm",
    { email: payload.email, code: payload.code, newPassword: payload.newPassword },
    { headers: { "X-Tenant-ID": payload.tenantSlug } },
  );
}
