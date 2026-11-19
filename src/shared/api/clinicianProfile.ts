import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";

export interface ClinicianProfileDefaults {
  id: string;
  firstName: string;
  lastName: string;
  sancNumber: string | null;
  hpcsaNumber: string | null;
}

export async function getMyClinicianProfile(): Promise<ClinicianProfileDefaults> {
  return apiClient.get<ClinicianProfileDefaults>("/api/v1/clinicians/me/profile", {
    headers: tenantAuthHeaders(),
  });
}
