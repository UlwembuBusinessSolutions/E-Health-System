// Lihle | 2026-09-09 | Restore the signed-in user from session storage and clear cached queries on user changes to avoid stale session data.
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { AuthenticatedUser } from "@/shared/api/types";
import { clearTenantAuth, getTenantToken } from "@/shared/api/auth";
import { useQueryClient } from "@tanstack/react-query";

// Auth state is client state — a dedicated context, not React Query — kept
// separate from the idle-lock timer, which is its own local clock so a
// locked-but-not-expired session can unlock in place.
interface AuthContextValue {
  user: AuthenticatedUser | null;
  setUser: (user: AuthenticatedUser | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const cache = useQueryClient();
  const [user, updateUser] = useState<AuthenticatedUser | null>(() => {
    try { return getTenantToken() ? JSON.parse(sessionStorage.getItem("ulwembu.user") ?? "null") : null; }
    catch { return null; }
  });
  function setUser(value: AuthenticatedUser | null) {
    cache.clear();
    if (value) sessionStorage.setItem("ulwembu.user", JSON.stringify(value));
    else sessionStorage.removeItem("ulwembu.user");
    updateUser(value);
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      setUser,
      logout: () => {
        clearTenantAuth();
        setUser(null);
      },
    }),
    [user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
