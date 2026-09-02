import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

// Only checks the role — nest inside RequireAuth, which already guarantees
// `user` is set. Kept separate rather than folded into RequireAuth so a
// route can require login without also requiring a specific role.
export function RequireRole({ role, children }: { role: string; children: ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== role) return <Navigate to="/app" replace />;
  return <>{children}</>;
}
