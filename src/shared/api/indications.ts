import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";

// Which ICD-10 conditions a pharmacy product is used for (backed by PharmacyProductIndicationController).
// This is how "allow for medicines on the stated ICD-10 codes" works: the pharmacy tags its products,
// and prescribing can list the medicines for a code such as I10 or E11.9.

export interface IndicationMedicine {
  productId: string;
  name: string;
  genericName: string | null;
  strength: string | null;
  dosageForm: string | null;
  atcCode: string | null;
}

export const ICD10_LABELS: Record<string, string> = {
  I10: "Hypertension",
  "E10.9": "Type 1 diabetes",
  "E11.9": "Type 2 diabetes",
  "E10.0": "Type 1 diabetes with coma (hypoglycemia)",
  "E11.0": "Type 2 diabetes with coma (hypoglycemia)",
  "E12.0": "Malnutrition-related diabetes with coma",
  "E13.0": "Other diabetes with coma",
  "E14.0": "Unspecified diabetes with coma",
};

export async function getProductIndications(productId: string): Promise<string[]> {
  const body = await apiClient.get<{ items: string[] }>(`/api/v1/pharmacy/products/${productId}/indications`, { headers: tenantAuthHeaders() });
  return body.items;
}

export async function setProductIndications(productId: string, icd10Codes: string[]): Promise<string[]> {
  const body = await apiClient.put<{ items: string[] }>(`/api/v1/pharmacy/products/${productId}/indications`, { icd10Codes }, { headers: tenantAuthHeaders() });
  return body.items;
}

export function getMedicinesForIndication(icd10: string): Promise<{ icd10: string; items: IndicationMedicine[] }> {
  return apiClient.get(`/api/v1/prescribing/indications/${encodeURIComponent(icd10)}/medicines`, { headers: tenantAuthHeaders() });
}
