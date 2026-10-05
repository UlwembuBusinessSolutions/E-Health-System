import type { AuthenticatedUser } from "@/shared/api/types";

// Non-secret (name, email, role, tenant slug) — lets the app shell come up
// offline without a token. It grants nothing on its own: every API call still
// needs a real token, and the outbox can't be read or written until the vault
// is unlocked with the password. Cleared on explicit sign-out.
const KEY = "ulwembu.offlineIdentity";

export interface OfflineIdentity {
  user: AuthenticatedUser;
  tenantSlug: string;
}

export function saveOfflineIdentity(user: AuthenticatedUser, tenantSlug: string | null): void {
  if (!tenantSlug) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ user, tenantSlug } satisfies OfflineIdentity));
  } catch {
    /* storage unavailable — offline cold start just won't be possible */
  }
}

export function loadOfflineIdentity(): OfflineIdentity | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as OfflineIdentity) : null;
  } catch {
    return null;
  }
}

export function clearOfflineIdentity(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}