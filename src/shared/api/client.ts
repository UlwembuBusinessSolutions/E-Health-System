// Every module's own path already carries its full route ("/api/v1/facilities",
// "/platform/organizations" — the platform module deliberately isn't under
// /api/v1 at all, see SecurityConfig), so this is the origin the backend
// runs on, never a path prefix. Empty by default: same-origin, works behind
// any reverse proxy that fronts both apps on one host; set
// VITE_API_BASE_URL to the API's own origin (e.g. http://localhost:8081)
// only when the frontend dev server and the API aren't served from the
// same origin.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export class ApiError extends Error {
  status: number;
  fieldErrors?: Record<string, string>;

  constructor(message: string, status: number, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // FormData bodies (multipart uploads) must NOT get a manual Content-Type
  // — the browser sets one itself, including the multipart boundary, only
  // if left alone. Forcing application/json here would silently corrupt
  // every upload.
  const isFormData = init?.body instanceof FormData;
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.message ?? res.statusText, res.status, body?.fieldErrors);
  }

  // Not just `res.status === 204` — a 200 with an empty body (the password-
  // reset endpoints' own bug, caught by real browser testing: curl never
  // parses the body, so it never noticed) hits the exact same "nothing here
  // to parse" case. res.json() on empty text throws a SyntaxError that
  // request() doesn't catch, silently turning a successful call into a
  // rejected promise. Every void endpoint SHOULD return 204 (and does,
  // elsewhere in this codebase) — this is the fallback for the one that
  // didn't, not a reason to stop bothering with 204.
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

// Typed client every module's api/ folder is expected to call through —
// mock modules (facilities.ts, auth.ts, roles.ts) exist only until their
// matching backend endpoint (Section 4 of the Phase 1 spec) ships.
// Optional `init` on each method — platform.ts needs it to attach
// X-Platform-Key, tenant modules will need it for Authorization/X-Tenant-ID
// the same way once they're wired up too.
export const apiClient = {
  get: <T>(path: string, init?: RequestInit) => request<T>(path, init),
  post: <T>(path: string, body?: unknown, init?: RequestInit) =>
    request<T>(path, {
      ...init,
      method: "POST",
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(path: string, body?: unknown, init?: RequestInit) =>
    request<T>(path, { ...init, method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string, init?: RequestInit) => request<T>(path, { ...init, method: "DELETE" }),
};
