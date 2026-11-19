import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";

export interface LaboratoryInvestigation {
  id: string;
  visitId: string;
  investigationDate: string;
  testName: string;
  testResults: string;
  signedByUserId: string;
  signedByName: string | null;
  signedAt: string;
  createdAt: string;
}

export interface CreateLaboratoryInvestigation {
  investigationDate: string;
  testName: string;
  testResults: string;
}

export async function getLaboratoryInvestigations(visitId: string): Promise<LaboratoryInvestigation[]> {
  const response = await apiClient.get<{ items: LaboratoryInvestigation[] }>(
    `/api/v1/visits/${visitId}/laboratory-investigations`,
    { headers: tenantAuthHeaders() },
  );
  return response.items;
}

export async function saveLaboratoryInvestigations(
  visitId: string,
  items: CreateLaboratoryInvestigation[],
): Promise<LaboratoryInvestigation[]> {
  const response = await apiClient.post<{ items: LaboratoryInvestigation[] }>(
    `/api/v1/visits/${visitId}/laboratory-investigations`,
    { items },
    { headers: tenantAuthHeaders() },
  );
  return response.items;
}
