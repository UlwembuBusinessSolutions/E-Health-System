import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

// Only checks the role — nest inside RequireAuth, which already guarantees
// `user` is set. Kept separate rather than folded into RequireAuth so a
// route can require login without also requiring a specific role.
export function RequireRole({ role, roles, children }: {
  role?: string;
  roles?: readonly string[];
  children: ReactNode;
}) {
  const { user } = useAuth();
  const assignedRoles = user?.roles ?? (user ? [user.role] : []);
  const allowed = roles
    ? roles.some((requiredRole) => assignedRoles.includes(requiredRole))
    : assignedRoles.includes(role ?? "");
  if (!allowed) return <Navigate to="/app" replace />;
  return <>{children}</>;
}
