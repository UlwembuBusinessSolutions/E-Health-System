import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AuthenticatedUser } from "@/shared/api/types";
import { clearTenantAuth, getCurrentUser, getTenantToken } from "@/shared/api/auth";

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
      setIsInitializing(false);
      return;
    }
    getCurrentUser()
      .then((rehydrated) => {
        if (!cancelled) setUser(rehydrated);
      })
      .catch(() => {
        // Expired or invalid — clear it so nothing keeps retrying against a
        // session that's already gone; falls through to RequireAuth's
        // normal signed-out redirect.
        clearTenantAuth();
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
      setUser,
      logout: () => {
        clearTenantAuth();
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
