import type { QueueActionReason } from "@/shared/api/queue";
import type { ClinicianDashboard, DashboardAppointment, TriageColour, WaitingPatient } from "@/shared/api/clinicianDashboard";
import { isWeekend, plural } from "@/shared/lib/chartFormat";

// Pure helpers behind the clinician Dashboard, so every label and number on
// it is worked out one way.

type TriageKey = TriageColour | "NONE";

interface TriageStyle {
  label: string;
  barClassName: string;
}

// Listed in the order the server sorts by: most urgent first, with "not
// triaged" after red and orange because its urgency is unknown.
export const TRIAGE_ORDER: TriageKey[] = ["RED", "ORANGE", "NONE", "YELLOW", "GREEN"];

export const TRIAGE: Record<TriageKey, TriageStyle> = {
  RED: { label: "Red", barClassName: "bg-triage-red" },
  ORANGE: { label: "Orange", barClassName: "bg-triage-orange" },
  NONE: { label: "Not triaged", barClassName: "bg-triage-none-bar" },
  YELLOW: { label: "Yellow", barClassName: "bg-triage-yellow" },
  GREEN: { label: "Green", barClassName: "bg-triage-green" },
};

export function triageKey(colour: TriageColour | null): TriageKey {
  return colour ?? "NONE";
}

/** "within 10 min", "within 4 hours", "now". */
export function targetText(minutes: number): string {
  if (minutes === 0) return "now";
  if (minutes < 60) return `within ${minutes} min`;
  const hours = minutes / 60;
  return `within ${Number.isInteger(hours) ? hours : hours.toFixed(1)} ${hours === 1 ? "hour" : "hours"}`;
}

/** "10 min", "1 hour", "4 hours". */
export function targetSpan(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} ${hours === 1 ? "hour" : "hours"}`;
}

/** "47 min", "1 h 25 min", "2 h". */
export function waitText(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const rest = minutes % 60;
  return `${Math.floor(minutes / 60)} h${rest ? ` ${rest} min` : ""}`;
}

const STREAMS: Record<string, string> = {
  GENERAL: "General",
  CHRONIC_CARE: "Chronic care",
  MATERNAL_CHILD: "Maternal & child health",
  OCCUPATIONAL_HEALTH: "Occupational health",
};

export function streamLabel(stream: string | null): string {
  if (!stream) return "";
  return STREAMS[stream] ?? stream.charAt(0) + stream.slice(1).toLowerCase().replace(/_/g, " ");
}

/** "M, 65"; parts that are unknown are left out rather than guessed. */
export function patientFacts(patient: WaitingPatient): string {
  const sex = patient.gender === "MALE" ? "M" : patient.gender === "FEMALE" ? "F" : patient.gender ? "Other" : null;
  return [sex, patient.age === null ? null : String(patient.age)].filter(Boolean).join(", ");
}

type ColourCounts = Partial<Record<TriageKey, number>>;

/** Counts per triage colour, in display order, including colours with nobody waiting. */
export function triageMix(counts: ColourCounts): { key: TriageKey; count: number }[] {
  return TRIAGE_ORDER.map((key) => ({ key, count: counts[key] ?? 0 }));
}

export function countAll(counts: ColourCounts): number {
  return TRIAGE_ORDER.reduce((sum, key) => sum + (counts[key] ?? 0), 0);
}

/** "1 orange, 1 yellow" for those past their target; empty when nobody is. */
export function pastTargetSummary(overTarget: ColourCounts): string {
  return triageMix(overTarget)
    .filter((m) => m.count > 0)
    .map((m) => `${m.count} ${TRIAGE[m.key].label.toLowerCase()}`)
    .join(", ");
}

/** Who the queue itself would call next (position 0), if they are in the list. */
export function queueHead(patients: WaitingPatient[]): WaitingPatient | undefined {
  return patients.find((p) => p.queuePosition === 0);
}

/**
 * The reason offered first when calling out of turn: a clinical concern when
 * this patient's triage is more urgent than the patient the queue would call,
 * otherwise the clinician's own request. The clinician can change it.
 */
export function suggestedReason(patient: WaitingPatient, head: WaitingPatient | undefined): QueueActionReason {
  if (!head) return "CLINICIAN_REQUEST";
  const rank = (p: WaitingPatient) => TRIAGE_ORDER.indexOf(triageKey(p.triageColour));
  return patient.triageColour !== null && rank(patient) < rank(head) ? "CLINICAL_CONCERN" : "CLINICIAN_REQUEST";
}

/** The note prefilled for an out-of-turn call: the facts behind it. */
export function suggestedNote(patient: WaitingPatient): string {
  const triage = patient.triageColour ? `Triage ${TRIAGE[patient.triageColour].label.toLowerCase()}` : "Not triaged yet";
  return `${triage}; waited ${waitText(patient.waitMinutes)}.`;
}

/** The next appointment still to happen: not seen yet, earliest first. */
export function nextAppointment(appointments: DashboardAppointment[], now: Date): DashboardAppointment | undefined {
  return appointments.find((a) => a.status !== "SEEN" && new Date(a.startsAt).getTime() >= now.getTime() - 15 * 60_000)
    ?? appointments.find((a) => a.status === "IN_QUEUE");
}

export function greeting(now: Date): string {
  const hour = now.getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

export function displayName(user: { firstName: string; lastName: string; role: string }): string {
  return user.role === "Doctor" ? `Dr ${user.lastName}` : user.firstName;
}

/** Average patients a day over weekdays only; null when there are none. */
export function weekdayAverage(days: ClinicianDashboard["seenPerDay"]): number | null {
  const weekdays = days.filter((day) => !isWeekend(day.date));
  if (weekdays.length === 0) return null;
  return weekdays.reduce((sum, day) => sum + day.count, 0) / weekdays.length;
}

/** Whole numbers from 10 up, one decimal below, so a quiet month doesn't read as "0". */
export function averageText(average: number): string {
  return average >= 10 ? String(Math.round(average)) : (Math.round(average * 10) / 10).toFixed(1).replace(/\.0$/, "");
}

/** Weekend columns as % positions across `days` equal-width column slots. */
export function weekendColumns(dates: string[]): { left: number; width: number }[] {
  const slot = 100 / Math.max(dates.length, 1);
  return dates.flatMap((date, index) => (isWeekend(date) ? [{ left: index * slot, width: slot }] : []));
}

export function seenText(count: number): string {
  return plural(count, "patient", "patients") + " seen";
}
