import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";
import { queryString } from "./queryString";

const base = "/api/v1/pharmacy/ccmdd";
const headers = () => ({ headers: tenantAuthHeaders() });

export interface PickupPoint {
  id: string;
  synchId: string;
  name: string;
  province: string;
  district: string;
  area: string;
  address: string;
  contactEmail: string | null;
}
export interface DirectoryResult {
  items: PickupPoint[];
  source: "SYNCH_LIVE" | "CACHED" | "UNAVAILABLE";
  stale: boolean;
  lastSuccessfulSync: string | null;
  configured: boolean;
  fallback: boolean;
  refreshAttempted: boolean;
  cacheMinutes: number;
}
export interface PickupFilters {
  q?: string;
  province?: string;
  district?: string;
  area?: string;
}
export type ParcelStatus = "DISPATCHED" | "READY" | "COLLECTED" | "RETURNED";
export interface CcmddParcel {
  id: string;
  trackingReference: string;
  prescriptionId: string;
  facilityId: string;
  patientName: string;
  patientMpi: string;
  patientContact: string | null;
  pickupPoint: PickupPoint;
  status: ParcelStatus;
  dispatchedAt: string;
  readyAt: string | null;
  collectedAt: string | null;
  returnedAt: string | null;
  traceDueAt: string;
  tracingDays: number;
  notificationStatus: "NOT_CONFIGURED" | "QUEUED" | "FAILED";
  notifiedAt: string | null;
  notificationError: string | null;
  overdue: boolean;
  traceAttempts: number;
  lastTracedAt: string | null;
  traceNote: string | null;
}
export async function getCcmddPickupPoints(filters: PickupFilters): Promise<DirectoryResult> {
  return apiClient.get(`${base}/pickup-points?${queryString({ q: filters.q, province: filters.province, district: filters.district, area: filters.area })}`, headers());
}
export async function refreshCcmddPickupPoints(filters: PickupFilters): Promise<DirectoryResult> {
  return apiClient.post(`${base}/pickup-points/refresh?${queryString({ q: filters.q, province: filters.province, district: filters.district, area: filters.area })}`, {}, headers());
}
export async function getCcmddParcels(facilityId: string): Promise<CcmddParcel[]> {
  return apiClient.get(`${base}/parcels?${queryString({ facilityId })}`, headers());
}
export async function getCcmddTracing(facilityId: string): Promise<CcmddParcel[]> {
  return apiClient.get(`${base}/tracing?${queryString({ facilityId })}`, headers());
}
export async function getCcmddConfig(): Promise<{ tracingDays: number }> {
  return apiClient.get(`${base}/config`, headers());
}
export async function dispatchCcmddParcel(input: {
  facilityId: string; prescriptionSerial: string; pickupPointId: string; tracingDays: number;
}): Promise<CcmddParcel> {
  return apiClient.post(`${base}/parcels`, input, headers());
}
export async function updateCcmddStatus(id: string, facilityId: string, status: ParcelStatus): Promise<CcmddParcel> {
  return apiClient.patch(`${base}/parcels/${id}/status`, { facilityId, status }, headers());
}
export async function recordCcmddTrace(id: string, facilityId: string, note: string): Promise<CcmddParcel> {
  return apiClient.post(`${base}/parcels/${id}/trace`, { facilityId, note }, headers());
}
export async function resendCcmddNotice(id: string, facilityId: string): Promise<CcmddParcel> {
  return apiClient.post(`${base}/parcels/${id}/notify`, { facilityId }, headers());
}
