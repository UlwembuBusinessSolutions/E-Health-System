import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { getTenantSlug } from "@/shared/api/auth";

// Sends a signed-out visitor back to their own org's login, not the bare
// /login gate — getTenantSlug() survives a sign-out click that fires this
// same redirect a moment after the click handler's own explicit navigate()
// (both land in the same render pass; without this, the hardcoded bare
// /login this used to redirect to would silently overwrite whichever
// tenant-scoped URL the click handler had just navigated to, since nothing
// here ran a moment "too late" — it's racing the same click, not a separate
// bug). Only truly falls back to /login when no tenant was ever known in
// this tab (a stale bookmark to /app with no prior login), matching
// FindOrganizationScreen's own role as the gate for exactly that case.
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user) {
    const slug = getTenantSlug();
    return <Navigate to={slug ? `/org/${slug}/login` : "/login"} replace />;
  }
  return <>{children}</>;
}
