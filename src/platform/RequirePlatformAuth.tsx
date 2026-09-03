import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { usePlatformAuth } from "./PlatformAuthContext";

// Mirrors auth/RequireAuth.tsx, redirecting to the platform login instead
// of the staff one — these are two entirely separate identity spaces
// (backend-auth-guide.html Section 1), so a signed-in org admin and a
// signed-in platform operator are unrelated facts about the same browser.
export function RequirePlatformAuth({ children }: { children: ReactNode }) {
  const { operator } = usePlatformAuth();
  if (!operator) return <Navigate to="/platform/login" replace />;
  return <>{children}</>;
}
