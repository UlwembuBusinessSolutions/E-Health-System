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
  const { user, isInitializing } = useAuth();
  // AuthContext's own rehydration check hasn't resolved yet — render
  // nothing rather than redirect, so a signed-in person's still-valid
  // session gets a chance to prove itself before this decides they're
  // signed out (AuthContext.tsx's own why-note on why every fresh page
  // load starts with user === null regardless of session validity).
  if (isInitializing) return null;
  if (!user) {
    const slug = getTenantSlug();
    return <Navigate to={slug ? `/org/${slug}/login` : "/login"} replace />;
  }
  return <>{children}</>;
}
