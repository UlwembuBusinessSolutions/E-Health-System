import type { Role } from "./types";
import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";

// Real from here on — same fix, same reason as facilities.ts: mock
// integer-string ids ("3", "21", ...) aren't valid UUIDs, so submitting
// one as roleId to the real POST /api/v1/admin/staff produced a 400,
// same silent staff-creation failure.
export async function getRoles(): Promise<Role[]> {
  const response = await apiClient.get<{ items: Role[] }>("/api/v1/roles", { headers: tenantAuthHeaders() });
  return response.items;
}
