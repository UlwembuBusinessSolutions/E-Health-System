import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";

export interface WaitingTimeReportRow {
  visitId: string;
  pharmacyVisitId: string | null;
  patientId: string;
  facilityId: string;

  registrationStartedAt: string | null;
  registrationCompletedAt: string | null;
  registrationDurationMinutes: number | null;

  triageStartedAt: string | null;
  triageCompletedAt: string | null;
  triageDurationMinutes: number | null;

  consultationStartedAt: string | null;
  consultationCompletedAt: string | null;
  consultationDurationMinutes: number | null;

  pharmacyStartedAt: string | null;
  pharmacyCompletedAt: string | null;
  pharmacyDurationMinutes: number | null;

  totalWaitingMinutes: number | null;
  totalJourneyMinutes: number | null;
  exceeds120Minutes: boolean;
}

export async function getWaitingTimeReport(
  from: string,
  to: string,
  facilityId?: string,
): Promise<WaitingTimeReportRow[]> {
  const params = new URLSearchParams({
    from,
    to,
  });

  if (facilityId) {
    params.set("facilityId", facilityId);
  }

  return apiClient.get<WaitingTimeReportRow[]>(
    `/api/v1/rpta/waiting-time?${params.toString()}`,
    {
      headers: tenantAuthHeaders(),
    },
  );
}