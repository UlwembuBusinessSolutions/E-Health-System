import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";
import { queryString } from "./queryString";
import type { StockBaseUnit } from "./pharmacyStock";

// The pharmacy Overview tab, backed by co.ehealth.platform.pharmacy.overview.
// Days are the facility's own calendar days; history covers the 30 full days
// before today.

/** Sort order of the stock-cover list, most urgent first. */
export type CoverLevel = "OUT" | "CRITICAL" | "WARNING" | "OK" | "NO_RECENT_USE";

export interface StockCover {
  productId: string;
  code: string;
  displayName: string;
  baseUnit: StockBaseUnit;
  available: number;
  /** Units that left the shelf for patients over `basisDays`, net of returns. */
  used: number;
  /** Days of history behind the average: since the product was first stocked here, at most 30. */
  basisDays: number;
  /** Whole days the stock on hand lasts at the recent rate; null when there was no recent use. */
  daysLeft: number | null;
  level: CoverLevel;
}

export interface ExpiryMonth {
  /** `YYYY-MM` */
  month: string;
  within90Count: number;
  laterCount: number;
}

export interface ExpiringLot {
  productName: string;
  lotNumber: string;
  expiryDate: string;
  quantity: number;
  baseUnit: StockBaseUnit;
  daysLeft: number;
}

export interface PharmacyOverview {
  today: string;
  waiting: { count: number; oldestSince: string | null };
  stockCover: StockCover[];
  expiry: {
    within90Count: number;
    expiredCount: number;
    nextExpiry: string | null;
    /** This month and the next five, empty months included. */
    months: ExpiryMonth[];
    /** Earliest first, capped server-side; `totalLots` is the uncapped count. */
    lots: ExpiringLot[];
    totalLots: number;
  };
  /** 30 days, oldest first, ending yesterday. */
  prescriptionsPerDay: { date: string; received: number; dispensed: number }[];
}

export async function getPharmacyOverview(facilityId: string): Promise<PharmacyOverview> {
  return apiClient.get<PharmacyOverview>(`/api/v1/pharmacy/overview?${queryString({ facilityId })}`, {
    headers: tenantAuthHeaders(),
  });
}
