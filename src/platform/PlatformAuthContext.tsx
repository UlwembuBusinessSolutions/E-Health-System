import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { clearPlatformToken, type PlatformOperator } from "@/shared/api/platform";

// Mirrors auth/AuthContext.tsx exactly, kept as its own separate context
// rather than reusing AuthContext — a platform operator isn't an
// AuthenticatedUser (no facility, no role, not scoped to a tenant at all),
// and mixing the two would mean every consumer of useAuth() has to
// account for a shape that only applies to three internal-only screens.
interface PlatformAuthContextValue {
  operator: PlatformOperator | null;
  setOperator: (operator: PlatformOperator | null) => void;
  logout: () => void;
}

const PlatformAuthContext = createContext<PlatformAuthContextValue | null>(null);

export function PlatformAuthProvider({ children }: { children: ReactNode }) {
  const [operator, setOperator] = useState<PlatformOperator | null>(null);

  const value = useMemo<PlatformAuthContextValue>(
    () => ({
      operator,
      setOperator,
      logout: () => {
        clearPlatformToken();
        setOperator(null);
      },
    }),
    [operator],
  );

  return <PlatformAuthContext.Provider value={value}>{children}</PlatformAuthContext.Provider>;
}

export function usePlatformAuth(): PlatformAuthContextValue {
  const ctx = useContext(PlatformAuthContext);
  if (!ctx) throw new Error("usePlatformAuth must be used within PlatformAuthProvider");
  return ctx;
}
