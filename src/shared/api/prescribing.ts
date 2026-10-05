import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";
import { queryString } from "./queryString";

// What a prescriber sees of the pharmacy's shelf while writing a prescription,
// backed by co.ehealth.platform.pharmacy.prescribing.

/** OUT is none that can be handed over today, LOW is at or under the pharmacy's reorder level. */
export type StockLevel = "IN_STOCK" | "LOW" | "OUT";

/** An in-stock product with the same generic name as an out-of-stock one. */
export interface MedicineAlternative {
  productId: string;
  name: string;
  available: number;
}

export interface Medicine {
  productId: string;
  code: string;
  name: string;
  genericName: string | null;
  strength: string | null;
  dosageForm: string | null;
  unit: string;
  packSize: number | null;
  schedule: "S5" | "S6" | null;
  /** Units that can be handed over today. Expired lots do not count. */
  available: number;
  level: StockLevel;
  /** Soonest usable expiry date (yyyy-mm-dd), so short-dated stock is visible. */
  nearestExpiry: string | null;
  alternatives: MedicineAlternative[];
}

export interface MedicineSearchResult {
  /** The pharmacy a "send to pharmacy" prescription is dispensed from. */
  facilityId: string;
  facilityName: string;
  medicines: Medicine[];
}

/** Needs at least two characters; shorter searches return an empty list. */
export function searchMedicines(query: string): Promise<MedicineSearchResult> {
  return apiClient.get<MedicineSearchResult>(`/api/v1/prescribing/medicines?${queryString({ q: query })}`, {
    headers: tenantAuthHeaders(),
  });
}

export const MIN_SEARCH_LENGTH = 2;
