import type { ReactNode } from "react";
import { Navigate, useParams } from "react-router-dom";
import { usePatientAuth } from "./PatientAuthContext";

// Mirrors auth/RequireAuth.tsx — sends a signed-out visitor back to their
// own org's patient login, using the :tenantSlug route param rather than
// staff's getTenantSlug() (a patient session's own slug lives under a
// different sessionStorage key, see shared/api/patientAuth.ts).
export function RequirePatientPortalAuth({ children }: { children: ReactNode }) {
  const { account, isInitializing } = usePatientAuth();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  if (isInitializing) return null;
  if (!account) {
    return <Navigate to={tenantSlug ? `/org/${tenantSlug}/patient/login` : "/login"} replace />;
  }
  return <>{children}</>;
}
