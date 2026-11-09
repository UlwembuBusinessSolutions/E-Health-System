// Match the token that made the request: late failures must not erase a new login.
export const STAFF_SESSION_ENDED = "ulwembu:staff-session-ended";
const TOKEN = "ulwembu.tenantToken";
const SLUG = "ulwembu.tenantSlug";
const NOTICE = "ulwembu.staffSessionNotice";
const MESSAGE = "Your session has ended because you signed in elsewhere or signed out. Please sign in again.";

export function getStaffSessionNotice(): string | null {
  return sessionStorage.getItem(NOTICE);
}

export function clearStaffSessionNotice(): void {
  sessionStorage.removeItem(NOTICE);
}

// Used by JSON requests and authenticated file downloads alike.
export async function staffSessionFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  const authorization = headers.get("Authorization");
  const tenant = headers.get("X-Tenant-ID");
  const response = await fetch(input, init);
  if (response.status === 401 &&
      response.headers.get("X-Session-Status") === "SESSION_REPLACED_OR_ENDED" &&
      authorization && tenant && tenant === sessionStorage.getItem(SLUG) &&
      authorization === "Bearer " + sessionStorage.getItem(TOKEN)) {
    sessionStorage.removeItem(TOKEN);
    sessionStorage.setItem(NOTICE, MESSAGE);
    window.dispatchEvent(new Event(STAFF_SESSION_ENDED));
  }
  return response;
}
