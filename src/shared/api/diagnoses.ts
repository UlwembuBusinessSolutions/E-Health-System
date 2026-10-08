import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";
import { queryString } from "./queryString";

// The diagnosis catalogue behind the consultation's diagnosis box, backed by co.ehealth.platform.diagnosis.

export interface DiagnosisOption {
  id: string;
  /** ICD-10 code; blank for a diagnosis a clinician added themselves. */
  code: string | null;
  name: string;
  source: "ICD10" | "CUSTOM";
}

/** Fewer characters than this and the server returns nothing, so we do not ask. */
export const MIN_DIAGNOSIS_SEARCH_LENGTH = 2;

export async function searchDiagnoses(query: string): Promise<DiagnosisOption[]> {
  const response = await apiClient.get<{ items: DiagnosisOption[] }>(
    `/api/v1/diagnoses?${queryString({ q: query.trim() })}`,
    { headers: tenantAuthHeaders() },
  );
  return response.items;
}
