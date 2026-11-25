import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";
import { queryString } from "./queryString";

export interface MonthlyPharmacyMovement {
  month: string;
  postedTransactions: number;
}

export async function getMonthlyPharmacyMovements(facilityId: string): Promise<MonthlyPharmacyMovement[]> {
  const response = await apiClient.get<{ items: MonthlyPharmacyMovement[] }>(
    `/api/v1/pharmacy/dashboard/monthly-movements?${queryString({ facilityId })}`,
    { headers: tenantAuthHeaders() },
  );
  return response.items;
}
