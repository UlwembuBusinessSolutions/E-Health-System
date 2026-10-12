import type { ManualRemovalKind, RecordRegisterEntryPayload } from "@/shared/api/pharmacyRegister";
import type { DrugSchedule } from "@/shared/api/pharmacyStock";

// Register rules as pure functions, so the day-close arithmetic can be read
// (and tested) without any screen around it.

export interface DayFigures {
  opening: number;
  received: number;
  dispensed: number;
  destroyed: number;
  lost: number;
  returned: number;
}

/** What should be on the shelf at close: what we began with, plus in, minus every way out. */
export function expectedBalance({ opening, received, dispensed, destroyed, lost, returned }: DayFigures): number {
  return opening + received - dispensed - destroyed - lost - returned;
}

/** Counted minus expected: negative means stock is missing. */
export function varianceOf(counted: number, expected: number): number {
  return counted - expected;
}

/** The calendar day in the pharmacist's own timezone, as `YYYY-MM-DD`. */
export function businessDateOf(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export const MIN_VARIANCE_REASON_LENGTH = 5;

/** A day may be signed off when it balances, or when a difference is explained. */
export function canCloseDay(variance: number, reason: string): boolean {
  return variance === 0 || reason.trim().length >= MIN_VARIANCE_REASON_LENGTH;
}

export type RemovalMode = "PATIENT" | "OTHER";

export const OTHER_REMOVAL_KINDS: { value: Exclude<ManualRemovalKind, "DISPENSED">; label: string }[] = [
  { value: "DESTROYED", label: "Destroyed" },
  { value: "LOST", label: "Lost" },
  { value: "RETURNED", label: "Returned to supplier" },
];

/** Schedule 6 always needs a witness; Schedule 5 may have one. */
export function witnessRequired(schedule: DrugSchedule): boolean {
  return schedule === "S6";
}

export interface RemovalDraft {
  mode: RemovalMode;
  kind: Exclude<ManualRemovalKind, "DISPENSED">;
  quantity: number;
  rxSerial: string;
  patientName: string;
  patientIdRef: string;
  prescriber: string;
  prescriberRegNo: string;
  reason: string;
  witnessStaffId: string;
  witnessPin: string;
}

export const EMPTY_REMOVAL: RemovalDraft = {
  mode: "PATIENT",
  kind: "DESTROYED",
  quantity: 1,
  rxSerial: "",
  patientName: "",
  patientIdRef: "",
  prescriber: "",
  prescriberRegNo: "",
  reason: "",
  witnessStaffId: "",
  witnessPin: "",
};

/** Turns what was typed into the request, sending only the fields that belong to the chosen mode. */
export function toEntryPayload(
  draft: RemovalDraft,
  facilityId: string,
  productId: string,
  lotNumber: string,
): RecordRegisterEntryPayload {
  const witness = draft.witnessStaffId
    ? { witnessStaffId: draft.witnessStaffId, witnessPin: draft.witnessPin }
    : {};
  const base = { facilityId, productId, quantity: draft.quantity, lotNumber, ...witness };

  if (draft.mode === "OTHER") return { ...base, kind: draft.kind, reason: draft.reason.trim() };
  return {
    ...base,
    kind: "DISPENSED",
    rxSerial: draft.rxSerial.trim(),
    patientName: draft.patientName.trim(),
    patientIdRef: draft.patientIdRef.trim() || undefined,
    prescriber: draft.prescriber.trim(),
    prescriberRegNo: draft.prescriberRegNo.trim() || undefined,
  };
}

/** The first thing still missing, in words the pharmacist can act on; null when ready. */
export function removalProblem(draft: RemovalDraft, schedule: DrugSchedule, onHand: number): string | null {
  if (draft.quantity < 1) return "Enter how many are being removed.";
  if (draft.quantity > onHand) return `Only ${onHand} on hand, so ${draft.quantity} cannot be removed.`;
  if (draft.mode === "PATIENT") {
    if (!draft.rxSerial.trim()) return "Enter the prescription (RX) number.";
    if (!draft.patientName.trim()) return "Enter the patient's name.";
    if (!draft.prescriber.trim()) return "Enter who prescribed it.";
  } else if (draft.reason.trim().length < MIN_VARIANCE_REASON_LENGTH) {
    return "Give a short reason for this removal.";
  }
  if (witnessRequired(schedule) && !draft.witnessStaffId) return "Choose the staff member who witnessed this.";
  if (draft.witnessStaffId && draft.witnessPin.trim() === "") return "The witness must confirm with their PIN or password.";
  return null;
}
