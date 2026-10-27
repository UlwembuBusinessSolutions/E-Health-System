import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";
import { queryString } from "./queryString";
import type { TriageColour } from "./triage";

export type { TriageColour };

// The clinician Dashboard, backed by co.ehealth.platform.clinician. Every
// "today" is the facility's own calendar day.

export type DashboardAppointmentStatus = "SEEN" | "IN_QUEUE" | "NOT_ARRIVED" | "BOOKED";

export interface WaitingPatient {
  tokenId: string;
  ticketNumber: number;
  priority: boolean;
  issuedAt: string;
  waitMinutes: number;
  /** 0 is who the queue's "Call next" would take; anyone else is called out of turn and needs a reason. */
  queuePosition: number;
  visitId: string;
  patientId: string;
  patientName: string;
  age: number | null;
  gender: string | null;
  serviceStream: string | null;
  /** null when the patient has not been triaged yet. */
  triageColour: TriageColour | null;
  targetMinutes: number | null;
  overTarget: boolean;
}

export interface DashboardAppointment {
  appointmentId: string;
  time: string;
  startsAt: string;
  patientId: string;
  patientName: string;
  status: DashboardAppointmentStatus;
}

export interface PharmacyMessage {
  messageId: string;
  prescriptionId: string;
  serialNumber: string;
  patientId: string;
  patientName: string;
  message: string;
  senderName: string | null;
  sentAt: string;
}

export interface ClinicianDashboard {
  today: string;
  generatedAt: string;
  /** Whether this user may call patients (queue manage access). */
  canCall: boolean;
  /**
   * The counts cover everyone waiting. `patients` is sorted most urgent first
   * and capped server-side, so never count from it. Colour keys: the triage
   * colours plus NONE for not triaged.
   */
  waiting: {
    total: number;
    longestWaitMinutes: number;
    byColour: Record<TriageColour | "NONE", number>;
    overTargetByColour: Record<TriageColour | "NONE", number>;
    patients: WaitingPatient[];
  };
  /** null when the user's role has no access to appointments. */
  appointments: DashboardAppointment[] | null;
  pharmacyMessages: PharmacyMessage[];
  /** 30 days, oldest first, ending yesterday. */
  seenPerDay: { date: string; count: number }[];
}

export async function getClinicianDashboard(facilityId: string): Promise<ClinicianDashboard> {
  return apiClient.get<ClinicianDashboard>(`/api/v1/clinician/dashboard?${queryString({ facilityId })}`, {
    headers: tenantAuthHeaders(),
  });
}
