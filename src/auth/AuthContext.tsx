import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { AuthenticatedUser } from "@/shared/api/types";
import { clearTenantAuth } from "@/shared/api/auth";

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
  const [user, setUser] = useState<AuthenticatedUser | null>(null);

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
