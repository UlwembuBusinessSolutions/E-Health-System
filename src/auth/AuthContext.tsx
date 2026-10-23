import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AuthenticatedUser } from "@/shared/api/types";
import { clearTenantAuth, getCurrentUser, getTenantSlug, getTenantToken } from "@/shared/api/auth";
// OFFLINE: network failures must not sign a person out; see the rehydration effect below.
import { ApiError } from "@/shared/api/client";
import { clearOfflineIdentity, loadOfflineIdentity, saveOfflineIdentity } from "@/offline/identity";

// Auth state is client state — a dedicated context, not React Query — kept
// separate from the idle-lock timer, which is its own local clock so a
// locked-but-not-expired session can unlock in place.
interface AuthContextValue {
  user: AuthenticatedUser | null;
  // True only during the one rehydration check below, right after this
  // provider mounts. RequireAuth renders nothing while this is true rather
  // than treating a not-yet-checked session the same as a signed-out one
  // — without that distinction, every fresh page load (a reload, or a
  // window.open()'d print ticket) would flash straight to the login screen
  // before the token in sessionStorage ever got a chance to prove itself
  // still valid.
  isInitializing: boolean;
  setUser: (user: AuthenticatedUser | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // A fresh page load starts this whole tree from scratch — user is always
  // null here regardless of whether sessionStorage still holds a perfectly
  // valid tenant token, since nothing else ever populated it. Every /app
  // route reload, and every window.open()'d popup (TicketPrintPage's own
  // why-note on this), hits exactly this path. Without rehydrating here, a
  // signed-in person gets bounced to the login screen just for refreshing.
  useEffect(() => {
    let cancelled = false;
    if (!getTenantToken()) {
      // OFFLINE: no token. If we're offline and this device has a previous
      // sign-in, come up with that identity so offline registration still
      // works. It grants nothing by itself (see offline/identity.ts).
      const cached = !navigator.onLine ? loadOfflineIdentity() : null;
      if (cached) setUser(cached.user);
      setIsInitializing(false);
      return;
    }
    getCurrentUser()
      .then((rehydrated) => {
        if (cancelled) return;
        setUser(rehydrated);
        saveOfflineIdentity(rehydrated, getTenantSlug()); // OFFLINE
      })
      .catch((error) => {
        if (error instanceof ApiError) {
          // Expired or invalid — clear it so nothing keeps retrying against a
          // session that's already gone; falls through to RequireAuth's
          // normal signed-out redirect.
          clearTenantAuth();
        } else {
          // OFFLINE: a network failure is not a rejected token. Keep the
          // session usable offline with the cached, non-secret identity.
          const cached = loadOfflineIdentity();
          if (cached && !cancelled) setUser(cached.user);
        }
      })
      .finally(() => {
        if (!cancelled) setIsInitializing(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isInitializing,
      setUser: (next: AuthenticatedUser | null) => {
        setUser(next);
        if (next) saveOfflineIdentity(next, getTenantSlug()); // OFFLINE
      },
      logout: () => {
        clearTenantAuth();
        clearOfflineIdentity(); // OFFLINE
        setUser(null);
      },
    }),
    [user, isInitializing],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}