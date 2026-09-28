import { PatientVisitsTab } from "./PatientVisitsTab";
import { createPortal } from "react-dom";
import { VitalsOverview } from "./VitalsOverview";
import { PatientConsultationTab } from "./PatientConsultationTab";
import { AdditionalVitalsForm, AdditionalVitalsSummary, EMPTY_ADDITIONAL_VITALS, additionalPayload, type AdditionalVitalsState } from "./AdditionalVitals";
import { useEffect, useRef, useState, type ChangeEvent, type ComponentType, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import {
  Activity,
  Gauge,
  Thermometer,
  Wind,
  Archive,
  ArrowLeft,
  ArrowRightLeft,
  Baby,
  Camera,
  ChevronDown,
  CreditCard,
  Download,
  Eye,
  FileText,
  HeartPulse,
  History,
  Image as ImageIcon,
  Loader2,
  Pencil,
  PenLine,
  Pill,
  Plus,
  Printer,
  Ticket,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import {
  addGuardian,
  archivePatient,
  getMigrationDestinationDocumentDownloadUrl,
  getPatient,
  getPatientDocumentDownloadUrl,
  getPatientFieldHistory,
  getPatientMigrationDestinationView,
  getGuardianSignatureDownloadUrl,
  listGuardians,
  listMigrationDestinationFacilities,
  listMigrationDestinationOrganizations,
  listPatientDocuments,
  migratePatient,
  removeGuardian,
  updatePatient,
  uploadGuardianSignature,
  uploadPatientDocument,
  validateDocumentFile,
  type Guardian,
  type GuardianRelationship,
  type Patient,
  type PatientDocument,
  type PatientDocumentType,
} from "@/shared/api/patients";
import {
  createVisit,
  type ServiceStream,
  type VisitType,
  type VisitWithToken,
} from "@/shared/api/visits";
import {
  createPrescription,
  getPatientPrescriptions,
  type Prescription,
  type PrescriptionItemInput,
} from "@/shared/api/pharmacy";
import { getFacilities } from "@/shared/api/facilities";
import { printQueueTicket } from "@/shared/lib/printTicket";
import { printVitalsReading } from "@/shared/lib/printVitals";
import { printPrescription } from "@/shared/lib/printPrescription";
import {
  AVPU_OPTIONS,
  DISCRIMINATOR_OPTIONS,
  MOBILITY_OPTIONS,
  OXYGEN_SUPPORT_OPTIONS,
  SCORING_PROFILE_OPTIONS,
  TRIAGE_COLOUR_OPTIONS,
  VitalsDetailContent,
} from "./VitalsDetailContent";
import {
  captureTriage,
  getPatientVitalsHistory,
  getTriageHistory,
  type Avpu,
  type CaptureTriagePayload,
  type Mobility,
  type OxygenSupport,
  type ScoringProfile,
  type TriageAssessment,
  type TriageColour,
  type TriageDiscriminator,
} from "@/shared/api/triage";
import { ApiError } from "@/shared/api/client";
import { useAuth } from "@/auth/AuthContext";
import { Card } from "@/shared/components/Card";
import { Button } from "@/shared/components/Button";
import { Input } from "@/shared/components/Input";
import { Select } from "@/shared/components/Select";
import { Switch } from "@/shared/components/Switch";
import { SignaturePad } from "@/shared/components/SignaturePad";
import { TriageColourBadge } from "@/shared/components/TriageColourBadge";
import { StatusPill } from "@/shared/components/StatusPill";
import { useToast } from "@/shared/components/toast/ToastProvider";

const EMPTY_ITEM: PrescriptionItemInput = { drugName: "", dosage: "", quantity: 1 };

const VISIT_TYPE_OPTIONS: { value: VisitType; label: string }[] = [
  { value: "NEW", label: "New visit" },
  { value: "FOLLOW_UP", label: "Follow-up visit" },
];

const SERVICE_STREAM_OPTIONS: { value: ServiceStream; label: string }[] = [
  { value: "GENERAL", label: "General / acute care" },
  { value: "CHRONIC_CARE", label: "Chronic care" },
  { value: "MATERNAL_CHILD", label: "Maternal & child health" },
  { value: "OCCUPATIONAL_HEALTH", label: "Occupational health" },
];

function isPaediatric(dateOfBirth?: string): boolean {
  if (!dateOfBirth) return false;
  const birth = new Date(`${dateOfBirth}T00:00:00`);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate())) age -= 1;
  return age < 13;
}

interface VitalsFormState {
  additional: AdditionalVitalsState;
  emergencySign: boolean;
  emergencySignNote: string;
  respiratoryRate: string;
  heartRate: string;
  systolicBp: string;
  diastolicBp: string;
  temperatureCelsius: string;
  spo2Percent: string;
  oxygenSupport: OxygenSupport;
  oxygenDevice: string;
  oxygenFlowLpm: string;
  avpu: Avpu | "";
  mobility: Mobility | "";
  painScore: string;
  painScale: string;
  presentingComplaint: string;
  discriminators: TriageDiscriminator[];
  scoringProfileOverride: ScoringProfile | "";
  confirmOutOfRange: boolean;
  clinicianConfirmedColour: TriageColour | "";
  colourConfirmationReason: string;
}

const EMPTY_VITALS_FORM: VitalsFormState = {
  additional: EMPTY_ADDITIONAL_VITALS,
  emergencySign: false,
  emergencySignNote: "",
  respiratoryRate: "",
  heartRate: "",
  systolicBp: "",
  diastolicBp: "",
  temperatureCelsius: "",
  spo2Percent: "",
  oxygenSupport: "ROOM_AIR",
  oxygenDevice: "",
  oxygenFlowLpm: "",
  avpu: "",
  mobility: "",
  painScore: "",
  painScale: "",
  presentingComplaint: "",
  discriminators: [],
  scoringProfileOverride: "",
  confirmOutOfRange: false,
  clinicianConfirmedColour: "",
  colourConfirmationReason: "",
};

// "" means not entered — distinct from 0, which is a real (if extreme)
// reading. Sending undefined for a blank field is what lets the backend's
// own required-vitals validation (TriageService.requireVitalsForScoring())
// tell "not measured" apart from "measured as zero," rather than this page
// silently turning a blank box into a false 0.
function numberOrUndefined(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function unusualVitals(form: VitalsFormState): string[] {
  const warnings: string[] = [];
  const check = (raw: string, minimum: number, maximum: number, label: string) => {
    if (!raw) return;
    const value = Number(raw);
    if (Number.isFinite(value) && (value < minimum || value > maximum)) warnings.push(`${label}: ${raw}`);
  };
  check(form.respiratoryRate, 1, 100, "Respiratory rate");
  check(form.heartRate, 20, 300, "Heart rate");
  check(form.systolicBp, 40, 300, "Systolic BP");
  check(form.diastolicBp, 20, 200, "Diastolic BP");
  check(form.temperatureCelsius, 25, 45, "Temperature");
  check(form.spo2Percent, 50, 100, "SpO2");
  if (Number(form.additional.weightKg) > 0) check(form.additional.weightKg, 0.2, 500, "Weight (kg)");
  if (Number(form.additional.heightCm) > 0) check(form.additional.heightCm, 10, 250, "Height (cm)");
  if (Number(form.additional.glucoseMmolL) > 0) check(form.additional.glucoseMmolL, 0.1, 100, "Glucose (mmol/L)");
  if (Number(form.additional.haemoglobinGdl) > 0) check(form.additional.haemoglobinGdl, 0.1, 30, "Haemoglobin (g/dL)");
  return warnings;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function titleCase(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

const DOCUMENT_TYPE_CONFIG: Record<PatientDocumentType, { label: string; icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }> }> = {
  ID_COPY: { label: "ID copy", icon: CreditCard },
  MEDICAL_AID_CARD: { label: "Medical aid card", icon: HeartPulse },
  PATIENT_PHOTO: { label: "Patient photo", icon: Camera },
  BIRTH_CERTIFICATE: { label: "Birth certificate", icon: Baby },
};

// Matches PatientGuardianService.MAX_GUARDIANS_PER_PATIENT.
const MAX_GUARDIANS = 5;

const RELATIONSHIP_OPTIONS: { value: GuardianRelationship; label: string }[] = [
  { value: "PARENT", label: "Parent" },
  { value: "LEGAL_GUARDIAN", label: "Legal guardian" },
  { value: "GRANDPARENT", label: "Grandparent" },
  { value: "SIBLING", label: "Sibling" },
  { value: "OTHER", label: "Other" },
];

const RELATIONSHIP_LABEL: Record<GuardianRelationship, string> = {
  PARENT: "Parent",
  LEGAL_GUARDIAN: "Legal guardian",
  GRANDPARENT: "Grandparent",
  SIBLING: "Sibling",
  OTHER: "Other",
};

// Matches PatientController.UpdatePatientRequest's own field set — the
// history table's field_name values are these same identifiers verbatim
// (PatientService.update()'s own diff() calls), so this doubles as the
// display label for PatientFieldHistoryEntry.fieldName below.
const FIELD_LABEL: Record<string, string> = {
  firstName: "First name",
  lastName: "Last name",
  address: "Address",
  contactNumber: "Contact number",
  email: "Email",
  medicalAidProvider: "Medical aid provider",
  medicalAidNumber: "Medical aid number",
  passportNumber: "Passport number",
  passportExpiry: "Passport expiry",
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// "Today"/"Yesterday"/"N days ago" reads faster than a date at a glance for
// something uploaded minutes or hours ago — the exact date is still one
// click away on the full record, so this doesn't need to carry it too.
function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days > 1 && days < 7) return `${days} days ago`;
  return formatDate(iso);
}

function fileTypeIcon(contentType: string): ComponentType<{ className?: string; "aria-hidden"?: boolean }> {
  return contentType.startsWith("image/") ? ImageIcon : FileText;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-text-secondary">{label}</p>
      <p className="mt-1 text-[13.5px] text-text-primary">{value}</p>
    </div>
  );
}

// One condensed row per earlier reading — the same fields latestVitals
// shows in full, folded into a single line since these are here for
// context/trend, not as the active reading someone's acting on right now.
// Clicking it (or the Eye affordance) opens VitalsDetailModal for the full
// captured record — every reading here is a real clinical observation, not
// just a line of trend data, so it needs to stay fully inspectable, not
// just summarised.
function VitalsHistoryRow({
  assessment,
  capturedByName,
  patientName,
  patientMpi,
}: {
  assessment: TriageAssessment;
  capturedByName?: string | null;
  patientName?: string;
  patientMpi?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-full rounded-xl border border-border-subtle bg-surface-raised p-4 text-left transition-colors duration-150 hover:border-brand-300 hover:bg-brand-50/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold text-text-primary"><HeartPulse className="size-4 text-brand-600" aria-hidden />{formatDateTime(assessment.observedAt)}</p>
          <div className="flex items-center gap-2">
            {assessment.tewsScore != null && <span className="text-xs font-medium text-text-secondary">TEWS {assessment.tewsScore}</span>}
            <TriageColourBadge colour={assessment.finalColour} />
            <Eye className="size-3.5 text-text-secondary" aria-hidden />
          </div>
        </div>
        <div className="my-3"><VitalsOverview assessment={assessment} /></div>
        <p className="mt-0.5 text-[12px] text-text-secondary">
          Captured {formatDateTime(assessment.observedAt)}
          {capturedByName && ` · by ${capturedByName}`}
          {assessment.status === "SUPERSEDED" && " · superseded"}
          {assessment.status === "ENTERED_IN_ERROR" && " · entered in error"}
          {assessment.overrideReason && " · colour manually overridden"}
        </p>
      </button>
      {isOpen && (
        <VitalsDetailModal
          assessment={assessment}
          capturedByName={capturedByName}
          patientName={patientName}
          patientMpi={patientMpi}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}

// The full record behind one VitalsHistoryRow, in a dialog — the same
// content VitalsPrintPage renders on paper (VitalsDetailContent is shared
// between the two), just with a close button instead of nothing in the
// header's trailing slot. Portal to the body so animated ancestors cannot
// constrain the overlay. Keep keyboard focus inside and restore it on close.
function VitalsDetailModal({
  assessment,
  capturedByName,
  patientName,
  patientMpi,
  onClose,
}: {
  assessment: TriageAssessment;
  capturedByName?: string | null;
  patientName?: string;
  patientMpi?: string;
  onClose: () => void;
}) {
  const overlay = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    overlay.current?.querySelector<HTMLButtonElement>('button[aria-label="Close"]')?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
      if (event.key !== "Tab") return;
      const buttons = overlay.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
      if (!buttons?.length) return;
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, [onClose]);
  return createPortal(
    <div
      ref={overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Vitals reading detail"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/45 p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        className="max-h-full w-full max-w-[720px] overflow-y-auto rounded-[20px] bg-surface-raised p-4 shadow-card sm:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <VitalsDetailContent
          assessment={assessment}
          capturedByName={capturedByName}
          patientName={patientName}
          patientMpi={patientMpi}
          headerAction={
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => printVitalsReading(assessment.id)}
                aria-label="Print this vitals reading"
                title="Print"
                className="flex size-8 items-center justify-center rounded-full text-text-secondary transition-colors duration-150 hover:bg-surface-sunken"
              >
                <Printer className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex size-8 items-center justify-center rounded-full bg-surface-sunken text-text-secondary transition-colors duration-150 hover:bg-border-subtle"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          }
        />
      </div>
    </div>,
    document.body,
  );
}

// The patient-level Medication tab — every prescription this patient has
// ever had, PENDING and DISPENSED alike, newest first. Distinct from the
// pharmacy-facility dispensing queue (PharmacyQueuePage, which only ever
// shows PENDING ones for whichever facility is selected): this is "what
// has this patient actually been prescribed," not "what's left to
// dispense," so a real prescription and dispensing history survives here
// even after a facility's own queue has moved on.
function PatientPrescriptionsTab({ patientId }: { patientId: string }) {
  const prescriptionsQuery = useQuery({
    queryKey: ["patients", patientId, "prescriptions"],
    queryFn: () => getPatientPrescriptions(patientId),
  });
  const prescriptions = prescriptionsQuery.data ?? [];

  return (
    <Card className="mb-6 p-6">
      <h2 className="text-[14.5px] font-semibold text-text-primary">Medication</h2>
      <p className="mb-4 mt-0.5 text-[12.5px] text-text-secondary">
        Every prescription issued for this patient, and whether it's been taken.
      </p>

      {prescriptionsQuery.isLoading ? (
        <p className="text-[13.5px] text-text-secondary">Loading…</p>
      ) : prescriptions.length === 0 ? (
        <p className="text-[13.5px] text-text-secondary">No prescriptions recorded for this patient yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {prescriptions.map((rx) => (
            <div key={rx.id} className="rounded-lg border border-border-subtle bg-surface-sunken/40 px-3.5 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-[13px] font-semibold text-text-primary">{rx.serialNumber}</p>
                  <p className="mt-0.5 text-[12.5px] text-text-secondary">
                    Prescribed by {rx.prescriberName ?? "Unknown"}
                    {rx.prescriberRegistrationNumber && (
                      <span className="font-mono"> · Reg. {rx.prescriberRegistrationNumber}</span>
                    )}{" "}
                    &middot; {formatDateTime(rx.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {rx.status === "DISPENSED" ? (
                    <StatusPill tone="success">Fully collected</StatusPill>
                  ) : rx.status === "PARTIALLY_DISPENSED" ? (
                    <StatusPill tone="warning">Partially collected</StatusPill>
                  ) : rx.status === "OUT_OF_STOCK" ? (
                    <StatusPill tone="danger">Not collected — out of stock</StatusPill>
                  ) : (
                    <StatusPill tone="warning">Not yet taken</StatusPill>
                  )}
                  <button
                    type="button"
                    onClick={() => printPrescription(rx.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-raised hover:text-text-primary"
                    aria-label="Print prescription"
                  >
                    <Printer className="size-4" aria-hidden />
                  </button>
                </div>
              </div>
              <ul className="mt-2 flex flex-col gap-2">
                {rx.items.map((item) => (
                  <li key={item.id} className="text-[13px] text-text-primary">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        {item.drugName} — {item.dosage} <span className="text-text-secondary">× {item.quantity}</span>
                      </span>
                      {item.status === "DISPENSED" ? (
                        <StatusPill tone="success">Taken</StatusPill>
                      ) : item.status === "OUT_OF_STOCK" ? (
                        <StatusPill tone="danger">Not collected — out of stock</StatusPill>
                      ) : (
                        <StatusPill tone="warning">Not yet taken</StatusPill>
                      )}
                    </div>
                    {item.status === "DISPENSED" && item.dispensedAt && (
                      <p className="mt-1 text-[12px] text-success-600">
                        Dispensed by {item.dispensedByName ?? "unknown"} on {formatDateTime(item.dispensedAt)}
                      </p>
                    )}
                    {item.status === "OUT_OF_STOCK" && item.markedOutOfStockAt && (
                      <p className="mt-1 text-[12px] text-danger-600">
                        Marked out of stock by {item.markedOutOfStockByName ?? "unknown"} on{" "}
                        {formatDateTime(item.markedOutOfStockAt)}
                        {item.outOfStockNote && `: ${item.outOfStockNote}`}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// RECQ-US-008/009/010's read side, at the patient level rather than one
// visit: every capture across every visit this patient has ever had, so a
// clinician can see the trend over time, not just "what did the current
// visit record." Filtered by observed date (server-side, TriageService.
// getPatientVitalsHistory()) since a long-standing patient's history can
// span years — unlike the per-visit list above, which never needs a date
// filter because a visit's own vitals are already a small, bounded set.
function PatientVitalsHistoryTab({
  patientId,
  patientName,
  patientMpi,
}: {
  patientId: string;
  patientName: string;
  patientMpi: string;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [ascending, setAscending] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const vitalsQuery = useQuery({
    queryKey: ["patient-vitals-history", patientId, from, to, ascending, page, pageSize],
    queryFn: () =>
      getPatientVitalsHistory(patientId, { from: from || undefined, to: to || undefined, ascending, page, pageSize }),
  });
  const entries = vitalsQuery.data?.items ?? [];
  const totalElements = vitalsQuery.data?.totalElements ?? 0;
  const totalPages = vitalsQuery.data?.totalPages ?? 0;

  // Every filter/order change invalidates whatever page someone was on —
  // page 3 of "last month" almost never lines up with page 3 of "this
  // year," so landing back on page 0 avoids a silently-empty page.
  const updateFrom = (value: string) => {
    setFrom(value);
    setPage(0);
  };
  const updateTo = (value: string) => {
    setTo(value);
    setPage(0);
  };
  const updateAscending = (value: boolean) => {
    setAscending(value);
    setPage(0);
  };

  return (
    <Card className="mb-6 p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="flex items-center gap-2 text-base font-semibold text-text-primary"><History className="size-5 text-brand-600" aria-hidden />Vitals history</h2><p className="mt-1 text-xs text-text-secondary">Open a reading for all measurements, investigations and capture details.</p></div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-[12px] font-medium text-text-secondary">
            From
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => updateFrom(e.target.value)}
              className="h-9 rounded-lg border border-border-strong bg-surface-raised px-2.5 text-[13px] text-text-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-medium text-text-secondary">
            To
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => updateTo(e.target.value)}
              className="h-9 rounded-lg border border-border-strong bg-surface-raised px-2.5 text-[13px] text-text-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-medium text-text-secondary">
            Order
            <select
              value={ascending ? "asc" : "desc"}
              onChange={(e) => updateAscending(e.target.value === "asc")}
              className="h-9 rounded-lg border border-border-strong bg-surface-raised px-2 text-[13px] text-text-primary"
            >
              <option value="desc">Newest first</option>
              <option value="asc">Oldest first</option>
            </select>
          </label>
          {(from || to) && (
            <Button
              variant="ghost"
              size="md"
              onClick={() => {
                updateFrom("");
                updateTo("");
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {vitalsQuery.isLoading ? (
        <p className="text-[13.5px] text-text-secondary">Loading…</p>
      ) : vitalsQuery.isError ? (
        <div role="alert" className="text-sm text-danger-600">Could not load vitals. <button type="button" className="underline" onClick={() => vitalsQuery.refetch()}>Try again</button></div>
      ) : entries.length === 0 ? (
        <p className="text-[13.5px] text-text-secondary">
          {from || to ? "No vitals captured in that date range." : "No vitals captured for this patient yet."}
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {entries.map((entry) => (
              <VitalsHistoryRow
                key={entry.assessment.id}
                assessment={entry.assessment}
                capturedByName={entry.capturedByName}
                patientName={patientName}
                patientMpi={patientMpi}
              />
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-3">
            <p className="text-[12.5px] text-text-secondary">
              {totalElements} {totalElements === 1 ? "reading" : "readings"} · Page {page + 1} of{" "}
              {Math.max(totalPages, 1)}
            </p>
            <div className="flex items-center gap-2">
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(0);
                }}
                aria-label="Readings per page"
                className="h-9 rounded-lg border border-border-strong bg-surface-raised px-2 text-[13px] text-text-primary"
              >
                <option value={10}>10 per page</option>
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
              </select>
              <Button
                variant="secondary"
                size="md"
                disabled={page === 0}
                onClick={() => setPage((value) => value - 1)}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="md"
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

// The read half of PREG-US-001/015 — "view longitudinal record" is a later
// story (visits/consultations don't exist yet), so this is the demographic
// record on its own: everything PatientController.PatientSummary returns,
// laid out the same "profile card" shape OrganizationDetailPage's own
// header already uses.
export function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const patientId = id ?? "";
  const { user } = useAuth();
  const isOrgAdmin = user?.role === "ORG_ADMIN";
  // Starting a visit stays outside the tabs below — it's a primary action
  // relevant no matter which tab someone's looking at, not "content" that
  // should hide when the Vitals tab (a different, cross-visit view of the
  // same clinical data) is selected.
  const [activeTab, setActiveTab] = useState<"overview" | "vitals" | "consultation" | "medication" | "visits">(
    "overview",
  );
  const [isStartingVisit, setIsStartingVisit] = useState(false);
  const [facilityId, setFacilityId] = useState("");
  const [visitType, setVisitType] = useState<VisitType | "">("");
  const [serviceStream, setServiceStream] = useState<ServiceStream | "">("");
  const [visitError, setVisitError] = useState<string | null>(null);
  const [startedVisit, setStartedVisit] = useState<VisitWithToken | null>(null);
  const [isPrescribing, setIsPrescribing] = useState(false);
  const [prescriptionItems, setPrescriptionItems] = useState<PrescriptionItemInput[]>([{ ...EMPTY_ITEM }]);
  const [prescriptionError, setPrescriptionError] = useState<string | null>(null);
  const [createdPrescription, setCreatedPrescription] = useState<Prescription | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [archiveReason, setArchiveReason] = useState("");
  const [archiveDeceasedDate, setArchiveDeceasedDate] = useState("");
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrateOrgId, setMigrateOrgId] = useState("");
  const [migrateFacilityId, setMigrateFacilityId] = useState("");
  const [migrateReason, setMigrateReason] = useState("");
  const [migrateError, setMigrateError] = useState<string | null>(null);
  const [showDestinationRecord, setShowDestinationRecord] = useState(false);

  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const patientQuery = useQuery({
    queryKey: ["patients", patientId],
    queryFn: () => getPatient(patientId),
    enabled: !!patientId,
  });

  // PREG-US-017 AC2 / PREG-US-018 — one-way (no unarchive endpoint exists),
  // so the confirmation form below is the only guard against a misclick;
  // the button itself never fires this directly.
  const archive = useMutation({
    mutationFn: () =>
      archivePatient(patientId, { reason: archiveReason, deceasedDate: archiveDeceasedDate || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients", patientId] });
      setIsArchiving(false);
      setArchiveReason("");
      setArchiveDeceasedDate("");
    },
    onError: (error) => {
      setArchiveError(error instanceof ApiError ? error.message : "Couldn't archive that patient. Try again.");
    },
  });

  const handleArchive = () => {
    setArchiveError(null);
    if (!archiveReason.trim()) {
      setArchiveError("A reason is required.");
      return;
    }
    archive.mutate();
  };

  // Destination-picker queries — organizations load once the panel opens,
  // facilities are a dependent query keyed on the chosen organization, same
  // "enabled once the parent selection exists" shape the Start-a-visit
  // facility select above (and PatientVitalsHistoryTab's own filters)
  // already use elsewhere on this page.
  const migrationOrgsQuery = useQuery({
    queryKey: ["migration-destination-organizations"],
    queryFn: listMigrationDestinationOrganizations,
    enabled: isMigrating,
  });
  const migrationFacilitiesQuery = useQuery({
    queryKey: ["migration-destination-facilities", migrateOrgId],
    queryFn: () => listMigrationDestinationFacilities(migrateOrgId),
    enabled: isMigrating && !!migrateOrgId,
  });

  // One-way, same as archiving — the confirmation form below is the only
  // guard against a misclick; there's no way to undo this from here once it
  // succeeds (PatientMigrationService.migrate()'s own one-way guarantee).
  const migrate = useMutation({
    mutationFn: () =>
      migratePatient(patientId, {
        destinationOrganizationId: migrateOrgId,
        destinationFacilityId: migrateFacilityId,
        reason: migrateReason,
      }),
    onSuccess: () => {
      const orgName =
        migrationOrgsQuery.data?.find((o) => o.id === migrateOrgId)?.displayName ?? "the destination organization";
      const facilityName =
        migrationFacilitiesQuery.data?.find((f) => f.id === migrateFacilityId)?.name ?? "the destination facility";
      queryClient.invalidateQueries({ queryKey: ["patients", patientId] });
      setIsMigrating(false);
      setMigrateOrgId("");
      setMigrateFacilityId("");
      setMigrateReason("");
      showToast(`Migrated to ${facilityName} at ${orgName}.`, "success");
    },
    onError: (error) => {
      setMigrateError(error instanceof ApiError ? error.message : "Couldn't migrate that patient. Try again.");
    },
  });

  const handleMigrate = () => {
    setMigrateError(null);
    if (!migrateOrgId || !migrateFacilityId) {
      setMigrateError("Select a destination organization and facility.");
      return;
    }
    if (!migrateReason.trim()) {
      setMigrateError("A reason is required.");
      return;
    }
    migrate.mutate();
  };

  const facilitiesQuery = useQuery({ queryKey: ["facilities"], queryFn: getFacilities, enabled: isStartingVisit });

  const startVisit = useMutation({
    mutationFn: () =>
      createVisit({
        patientId,
        facilityId,
        visitType: visitType as VisitType,
        serviceStream: serviceStream as ServiceStream,
      }),
    onSuccess: (result) => {
      setStartedVisit(result);
      setIsStartingVisit(false);
    },
    onError: (error) => {
      setVisitError(error instanceof ApiError ? error.message : "Couldn't start that visit. Try again.");
    },
  });

  const handleStartVisit = () => {
    setVisitError(null);
    if (!facilityId || !visitType || !serviceStream) {
      setVisitError("Select a facility, visit type, and service stream.");
      return;
    }
    startVisit.mutate();
  };

  // A visit reached this page two different ways: just started in this
  // same session (startedVisit, local state) or an existing one being
  // returned to — the queue page's "Vitals" action on a CALLED token links
  // here with ?visitId=, since a nurse capturing vitals is very often
  // visiting a patient's page for a visit someone else (or an earlier
  // page load) already started, not one they're starting right now.
  const [searchParams] = useSearchParams();
  const linkedVisitId = searchParams.get("visitId");
  const activeVisitId = startedVisit?.visit.id ?? linkedVisitId ?? null;

  const [isCapturingVitals, setIsCapturingVitals] = useState(false);
  const [vitalsForm, setVitalsForm] = useState<VitalsFormState>(EMPTY_VITALS_FORM);
  const [vitalsError, setVitalsError] = useState<string | null>(null);
  // One key per open of the form, not one per keystroke — a genuine new
  // capture (form dismissed and reopened) gets a fresh key, while retrying
  // the same submission (the mutation firing again for the same click)
  // reuses it, which is the whole point of idempotencyKey server-side.
  const [vitalsIdempotencyKey, setVitalsIdempotencyKey] = useState(() => crypto.randomUUID());

  const vitalsHistoryQuery = useQuery({
    queryKey: ["triage-history", activeVisitId],
    queryFn: () => getTriageHistory(activeVisitId as string),
    enabled: !!activeVisitId,
  });
  const vitalsHistory = vitalsHistoryQuery.data ?? [];
  const latestVitals: TriageAssessment | undefined = vitalsHistory
    .filter((a) => a.status === "ACTIVE")
    .at(-1);
  // Every reading stays its own row (TriageService.capture() never
  // overwrites), so anything other than the single latest one shown above
  // needs its own place to display — otherwise a second or third capture
  // just makes the earlier ones vanish from view even though they're still
  // in the database. Newest-of-the-rest first, mirroring latestVitals sitting
  // above it.
  const earlierVitals = vitalsHistory.filter((a) => a.id !== latestVitals?.id).reverse();
  const [showVitalsHistory, setShowVitalsHistory] = useState(false);

  const captureVitals = useMutation({
    mutationFn: (payload: CaptureTriagePayload) => captureTriage(activeVisitId as string, payload),
    onSuccess: () => {
      setIsCapturingVitals(false);
      setVitalsForm(EMPTY_VITALS_FORM);
      setVitalsIdempotencyKey(crypto.randomUUID());
      queryClient.invalidateQueries({ queryKey: ["triage-history", activeVisitId] });
      queryClient.invalidateQueries({ queryKey: ["patient-vitals-history"] });
    },
    onError: (error) => {
      setVitalsError(error instanceof ApiError ? error.message : "Couldn't save those vitals. Try again.");
    },
  });

  const handleCaptureVitals = () => {
    setVitalsError(null);
    if (vitalsForm.emergencySign && !vitalsForm.emergencySignNote.trim()) {
      setVitalsError("Describe the emergency sign observed.");
      return;
    }
    if (!vitalsForm.emergencySign) {
      const missing =
        !vitalsForm.respiratoryRate ||
        !vitalsForm.heartRate ||
        !vitalsForm.systolicBp ||
        !vitalsForm.temperatureCelsius ||
        !vitalsForm.avpu ||
        !vitalsForm.mobility;
      if (missing) {
        setVitalsError(
          "Respiratory rate, heart rate, systolic BP, temperature, AVPU, and mobility are all required " +
            "(unless this is an emergency-sign capture).",
        );
        return;
      }
    }
    if (!vitalsForm.emergencySign && !vitalsForm.additional.traumaPresent) {
      setVitalsError("Select whether an injury occurred within the past 48 hours.");
      return;
    }
    for (const key of ["weightKg", "heightCm", "glucoseMmolL", "haemoglobinGdl"] as const) {
      const value = vitalsForm.additional[key];
      if (value !== "" && (!Number.isFinite(Number(value)) || Number(value) <= 0)) {
        setVitalsError("Additional measurements must be numbers greater than zero. Leave unmeasured values blank.");
        return;
      }
    }
    const warnings = unusualVitals(vitalsForm);
    if (warnings.length > 0 && !vitalsForm.confirmOutOfRange) {
      setVitalsError(`Confirm the unusual measurements before saving: ${warnings.join(", ")}`);
      return;
    }
    const paediatricProfile = vitalsForm.scoringProfileOverride
      ? vitalsForm.scoringProfileOverride.startsWith("PAEDIATRIC")
      : isPaediatric(patientQuery.data?.dateOfBirth);
    if (!vitalsForm.emergencySign && paediatricProfile
        && (!vitalsForm.clinicianConfirmedColour || !vitalsForm.colourConfirmationReason.trim())) {
      setVitalsError("Select and explain the clinician-confirmed paediatric triage colour.");
      return;
    }
    captureVitals.mutate({
      additionalObservations: additionalPayload(vitalsForm.additional),
      emergencySign: vitalsForm.emergencySign,
      emergencySignNote: vitalsForm.emergencySignNote.trim() || undefined,
      scoringProfileOverride: vitalsForm.scoringProfileOverride || undefined,
      respiratoryRate: numberOrUndefined(vitalsForm.respiratoryRate),
      heartRate: numberOrUndefined(vitalsForm.heartRate),
      systolicBp: numberOrUndefined(vitalsForm.systolicBp),
      diastolicBp: numberOrUndefined(vitalsForm.diastolicBp),
      temperatureCelsius: numberOrUndefined(vitalsForm.temperatureCelsius),
      spo2Percent: numberOrUndefined(vitalsForm.spo2Percent),
      oxygenSupport: vitalsForm.oxygenSupport,
      oxygenDevice: vitalsForm.oxygenSupport === "SUPPLEMENTAL" ? vitalsForm.oxygenDevice.trim() || undefined : undefined,
      oxygenFlowLpm: vitalsForm.oxygenSupport === "SUPPLEMENTAL" ? numberOrUndefined(vitalsForm.oxygenFlowLpm) : undefined,
      avpu: vitalsForm.avpu || undefined,
      mobility: vitalsForm.mobility || undefined,
      painScore: numberOrUndefined(vitalsForm.painScore),
      painScale: vitalsForm.painScale.trim() || undefined,
      presentingComplaint: vitalsForm.presentingComplaint.trim() || undefined,
      discriminators: vitalsForm.discriminators,
      idempotencyKey: vitalsIdempotencyKey,
      confirmOutOfRange: vitalsForm.confirmOutOfRange,
      clinicianConfirmedColour: vitalsForm.clinicianConfirmedColour || undefined,
      colourConfirmationReason: vitalsForm.colourConfirmationReason.trim() || undefined,
    });
  };

  const toggleDiscriminator = (value: TriageDiscriminator) => {
    setVitalsForm((form) => ({
      ...form,
      discriminators: form.discriminators.includes(value)
        ? form.discriminators.filter((d) => d !== value)
        : [...form.discriminators, value],
    }));
  };

  const prescribe = useMutation({
    mutationFn: (visitId: string) => createPrescription({ visitId, items: prescriptionItems }),
    onSuccess: (result) => {
      setCreatedPrescription(result);
      setIsPrescribing(false);
    },
    onError: (error) => {
      setPrescriptionError(error instanceof ApiError ? error.message : "Couldn't create that prescription. Try again.");
    },
  });

  const handlePrescribe = () => {
    setPrescriptionError(null);
    if (!startedVisit) return;
    const incomplete = prescriptionItems.some((item) => !item.drugName.trim() || !item.dosage.trim());
    if (incomplete) {
      setPrescriptionError("Every item needs a drug name and dosage.");
      return;
    }
    prescribe.mutate(startedVisit.visit.id);
  };

  const updateItem = (index: number, patch: Partial<PrescriptionItemInput>) => {
    setPrescriptionItems((items) => items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const patient = patientQuery.data;

  // Same query key PatientDocumentsCard's own documents list uses further
  // down this page — React Query dedupes identical keys across components,
  // so this doesn't add a second network round trip, just a second reader
  // of the one already-fetched list. Only the presigned download URL for
  // the PATIENT_PHOTO row (if one exists) is fetched here specifically, so
  // the header avatar can show the real photo instead of initials —
  // fetched once per page view, not per patient in a list, which is what
  // makes doing this here fine despite PatientDocumentService's private,
  // presigned-URL-only design (getDownloadUrl()'s own why-note).
  const documentsForAvatarQuery = useQuery({
    queryKey: ["patients", patientId, "documents"],
    queryFn: () => listPatientDocuments(patientId),
    enabled: !!patientId,
  });
  const photoDocument = documentsForAvatarQuery.data?.find((d) => d.documentType === "PATIENT_PHOTO");
  const photoUrlQuery = useQuery({
    queryKey: ["patients", patientId, "photo-url", photoDocument?.id],
    queryFn: () => getPatientDocumentDownloadUrl(patientId, photoDocument?.id as string),
    enabled: !!photoDocument,
  });

  // Clicking the header avatar is the one entry point for a patient photo —
  // there's deliberately no separate "Patient photo" box in the Documents
  // card below (that section is for supporting paperwork someone opens to
  // review; a photo is an identity cue people expect right where the
  // patient's name already is). Uploading again doesn't need a "replace"
  // step of its own: PatientDocumentService never overwrites, so this just
  // adds a newer PATIENT_PHOTO row, and documentsForAvatarQuery's
  // newest-first order means the avatar always shows the latest one.
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photoMutation = useMutation({
    mutationFn: (file: File) => uploadPatientDocument(patientId, "PATIENT_PHOTO", file),
    onMutate: () => setPhotoError(null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["patients", patientId, "documents"] }),
    onError: (error) => {
      setPhotoError(error instanceof ApiError ? error.message : "Couldn't upload that photo. Try again.");
    },
  });

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const message = validateDocumentFile(file);
    if (message) {
      setPhotoError(message);
      return;
    }
    photoMutation.mutate(file);
  };

  return (
    <div>
      <Link
        to="/app/patients"
        className="mb-5 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to patients
      </Link>

      {patientQuery.isLoading ? (
        <p className="text-[14px] text-text-secondary">Loading…</p>
      ) : !patient ? (
        <p className="text-[14px] text-text-secondary">This patient couldn't be found.</p>
      ) : (
        <>
          <Card className="mb-6 p-6">
            {patient.migrated ? (
              <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-brand-500/25 bg-brand-50 px-3.5 py-3 text-[13.5px] text-brand-700">
                <ArrowRightLeft className="mt-0.5 size-4 shrink-0" aria-hidden />
                <div>
                  <p className="font-medium">Migrated to another organization</p>
                  <p className="text-brand-600">
                    {patient.archivedReason}
                    {patient.archivedAt && <> · {formatDate(patient.archivedAt)}</>}
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowDestinationRecord((s) => !s)}
                    className="mt-1.5 inline-flex items-center gap-1 text-[12.5px] font-medium text-brand-700 hover:text-brand-800"
                  >
                    {showDestinationRecord ? "Hide" : "View"} current record
                  </button>
                </div>
              </div>
            ) : (
              patient.archived && (
                <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-amber-500/25 bg-amber-50 px-3.5 py-3 text-[13.5px] text-amber-600">
                  <Archive className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <div>
                    <p className="font-medium">Archived record</p>
                    <p className="text-amber-600">
                      {patient.archivedReason}
                      {patient.archivedAt && <> · {formatDate(patient.archivedAt)}</>}
                      {patient.deceasedDate && <> · Date of death: {formatDate(patient.deceasedDate)}</>}
                    </p>
                  </div>
                </div>
              )
            )}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3.5">
                {patient.archived ? (
                  <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-brand-500/25 bg-brand-50 text-[14px] font-semibold text-brand-600">
                    {photoUrlQuery.data ? (
                      <img src={photoUrlQuery.data} alt="" className="size-full object-cover" />
                    ) : (
                      initials(patient.firstName, patient.lastName)
                    )}
                  </span>
                ) : (
                  <label
                    htmlFor="patient-photo-input"
                    title="Click to add or change the patient photo"
                    className="group relative flex size-11 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-brand-500/25 bg-brand-50 text-[14px] font-semibold text-brand-600"
                  >
                    {photoMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : photoUrlQuery.data ? (
                      <img src={photoUrlQuery.data} alt="" className="size-full object-cover" />
                    ) : (
                      initials(patient.firstName, patient.lastName)
                    )}
                    <span className="absolute inset-0 flex items-center justify-center bg-ink-900/0 opacity-0 transition-all duration-150 group-hover:bg-ink-900/40 group-hover:opacity-100">
                      <Camera className="size-4 text-white" aria-hidden />
                    </span>
                    <input
                      id="patient-photo-input"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      onChange={handlePhotoChange}
                    />
                  </label>
                )}
                <div>
                  <h1 className="text-[19px] font-semibold text-text-primary">
                    {patient.firstName} {patient.lastName}
                  </h1>
                  <p className="font-mono text-[13px] text-text-secondary">
                    {patient.mpiNumber} · registered {formatDate(patient.createdAt)}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {!patient.archived && !isStartingVisit && !startedVisit && (
                  <Button
                    variant="secondary"
                    icon={<Ticket className="size-4" aria-hidden />}
                    onClick={() => setIsStartingVisit(true)}
                  >
                    Start visit
                  </Button>
                )}
                {!patient.archived && isOrgAdmin && !isMigrating && (
                  <Button
                    variant="ghost"
                    icon={<ArrowRightLeft className="size-4" aria-hidden />}
                    onClick={() => {
                      setMigrateError(null);
                      setIsMigrating(true);
                    }}
                  >
                    Migrate patient
                  </Button>
                )}
                {!patient.archived && isOrgAdmin && !isArchiving && (
                  <Button
                    variant="ghost"
                    icon={<Archive className="size-4" aria-hidden />}
                    onClick={() => {
                      setArchiveError(null);
                      setIsArchiving(true);
                    }}
                  >
                    Archive patient
                  </Button>
                )}
              </div>
            </div>
            {photoError && (
              <p role="alert" className="mt-3 text-[13px] text-danger-600">
                {photoError}
              </p>
            )}
          </Card>

          {patient.migrated && showDestinationRecord && <DestinationRecordCard patientId={patient.id} />}

          {isMigrating && (
            <Card className="mb-6 p-6">
              <h2 className="text-[16px] font-semibold text-text-primary">Migrate this patient</h2>
              <p className="mt-1 text-[13.5px] text-text-secondary">
                Moves this patient's demographics, MPI, and documents to a new organization and facility. Visits,
                vitals, and prescriptions stay here — the destination starts a fresh clinical history. This record
                stays viewable but locked from further edits once the migration completes.
              </p>
              <div className="mt-4 flex flex-col gap-3.5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Select
                    label="Destination organization"
                    required
                    options={(migrationOrgsQuery.data ?? []).map((o) => ({ value: o.id, label: o.displayName }))}
                    value={migrateOrgId}
                    onChange={(e) => {
                      setMigrateOrgId(e.target.value);
                      setMigrateFacilityId("");
                    }}
                  />
                  <Select
                    label="Destination facility"
                    required
                    disabled={!migrateOrgId}
                    options={(migrationFacilitiesQuery.data ?? []).map((f) => ({ value: f.id, label: f.name }))}
                    value={migrateFacilityId}
                    onChange={(e) => setMigrateFacilityId(e.target.value)}
                  />
                </div>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-medium text-text-primary">Reason *</span>
                  <textarea
                    className="min-h-[80px] rounded-lg border border-border-default bg-surface-base px-3 py-2 text-[13.5px] text-text-primary outline-none focus:border-brand-500"
                    value={migrateReason}
                    onChange={(event) => setMigrateReason(event.target.value)}
                    placeholder="e.g. Patient relocated, requested transfer to a closer facility…"
                  />
                </label>
                {migrateError && <p role="alert" className="text-[13px] text-danger-600">{migrateError}</p>}
                <div className="flex gap-2">
                  <Button loading={migrate.isPending} onClick={handleMigrate}>
                    Confirm migration
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={migrate.isPending}
                    onClick={() => {
                      setIsMigrating(false);
                      setMigrateOrgId("");
                      setMigrateFacilityId("");
                      setMigrateReason("");
                      setMigrateError(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {isArchiving && (
            <Card className="mb-6 p-6">
              <h2 className="text-[16px] font-semibold text-text-primary">Archive this patient</h2>
              <p className="mt-1 text-[13.5px] text-text-secondary">
                The record is kept, not deleted — it stays viewable but locked from further edits, documents,
                guardians, and new visits. This can't be undone from here.
              </p>
              <div className="mt-4 flex flex-col gap-3.5">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-medium text-text-primary">Reason *</span>
                  <textarea
                    className="min-h-[80px] rounded-lg border border-border-default bg-surface-base px-3 py-2 text-[13.5px] text-text-primary outline-none focus:border-brand-500"
                    value={archiveReason}
                    onChange={(event) => setArchiveReason(event.target.value)}
                    placeholder="e.g. Deceased, transferred to another facility, duplicate record…"
                  />
                </label>
                <Input
                  label="Date of death (optional)"
                  type="date"
                  value={archiveDeceasedDate}
                  onChange={(event) => setArchiveDeceasedDate(event.target.value)}
                />
                {archiveError && <p className="text-[13px] text-danger-600">{archiveError}</p>}
                <div className="flex gap-2">
                  <Button
                    className="bg-danger-500! hover:bg-danger-600!"
                    loading={archive.isPending}
                    onClick={handleArchive}
                  >
                    Confirm archive
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setIsArchiving(false);
                      setArchiveReason("");
                      setArchiveDeceasedDate("");
                      setArchiveError(null);
                    }}
                    disabled={archive.isPending}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {(isStartingVisit || startedVisit) && (
            <Card className="mb-6 p-6">
              {startedVisit ? (
                <div className="flex flex-col items-center gap-2 text-center">
                  <span className="flex size-11 items-center justify-center rounded-full bg-success-50 text-success-500">
                    <Ticket className="size-6" aria-hidden />
                  </span>
                  <h2 className="text-[16px] font-semibold text-text-primary">Visit started</h2>
                  <p className="rounded-lg bg-surface-sunken px-3 py-1.5 font-mono text-[18px] font-semibold text-text-primary">
                    Token #{startedVisit.token.tokenNumber}
                  </p>
                  <p className="text-[13.5px] text-text-secondary">
                    {patient.firstName} is now in the queue.{" "}
                    <Link to="/app/queue" className="font-medium text-brand-600 hover:text-brand-700">
                      View queue
                    </Link>
                  </p>
                  <div className="mt-1 flex gap-2">
                    <Button
                      variant="secondary"
                      size="md"
                      icon={<Printer className="size-3.5" aria-hidden />}
                      onClick={() => printQueueTicket(startedVisit.token.id)}
                    >
                      Print ticket
                    </Button>
                    <Button
                      variant="secondary"
                      size="md"
                      icon={<HeartPulse className="size-3.5" aria-hidden />}
                      onClick={() => setIsCapturingVitals(true)}
                    >
                      Take vitals
                    </Button>
                    {!isPrescribing && !createdPrescription && (
                      <Button
                        variant="secondary"
                        size="md"
                        icon={<Pill className="size-3.5" aria-hidden />}
                        onClick={() => setIsPrescribing(true)}
                      >
                        Prescribe
                      </Button>
                    )}
                    <Button variant="secondary" size="md" onClick={() => setStartedVisit(null)}>
                      Dismiss
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="mb-4 text-[14.5px] font-semibold text-text-primary">Start a visit</h2>
                  {visitError && (
                    <p role="alert" className="mb-4 text-[13.5px] text-danger-600">
                      {visitError}
                    </p>
                  )}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Select
                      label="Facility"
                      required
                      options={(facilitiesQuery.data ?? []).map((f) => ({ value: f.id, label: f.name }))}
                      value={facilityId}
                      onChange={(e) => setFacilityId(e.target.value)}
                    />
                    <Select
                      label="Visit type"
                      required
                      options={VISIT_TYPE_OPTIONS}
                      value={visitType}
                      onChange={(e) => setVisitType(e.target.value as VisitType)}
                    />
                    <Select
                      label="Service stream"
                      required
                      options={SERVICE_STREAM_OPTIONS}
                      value={serviceStream}
                      onChange={(e) => setServiceStream(e.target.value as ServiceStream)}
                    />
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button loading={startVisit.isPending} onClick={handleStartVisit}>
                      Issue queue token
                    </Button>
                    <Button variant="secondary" onClick={() => setIsStartingVisit(false)}>
                      Cancel
                    </Button>
                  </div>
                </>
              )}
            </Card>
          )}

          <div role="tablist" aria-label="Patient record sections" className="mb-6 flex gap-1 overflow-x-auto border-b border-border-subtle">
            {(["overview", "visits", "vitals", "consultation", "medication"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                onClick={() => setActiveTab(tab)}
                className={clsx(
                  "-mb-px shrink-0 border-b-2 px-3.5 py-2.5 text-[13.5px] font-medium capitalize transition-colors duration-150",
                  activeTab === tab
                    ? "border-brand-500 text-brand-600"
                    : "border-transparent text-text-secondary hover:text-text-primary",
                )}
              >
                {tab === "overview"
                  ? "Overview"
                  : tab === "visits"
                    ? "Visits"
                    : tab === "vitals"
                      ? "Vitals"
                      : tab === "consultation"
                        ? "Consultation"
                        : "Medication"}
              </button>
            ))}
          </div>

          {activeTab === "visits" && <PatientVisitsTab patientId={patient.id} />}

          {activeTab === "vitals" && (
            <PatientVitalsHistoryTab
              patientId={patient.id}
              patientName={`${patient.firstName} ${patient.lastName}`}
              patientMpi={patient.mpiNumber}
            />
          )}

          {activeTab === "consultation" && <PatientConsultationTab visitId={activeVisitId} />}

          {activeTab === "medication" && <PatientPrescriptionsTab patientId={patient.id} />}

          {activeTab === "overview" && (
            <>
          {!patient.archived && (
            <Card className="mb-6 p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-[14.5px] font-semibold text-text-primary">Vitals / triage</h2>
                {latestVitals && !isCapturingVitals && <TriageColourBadge colour={latestVitals.finalColour} />}
              </div>

              {!activeVisitId ? (
                <div className="rounded-lg border border-border-default bg-surface-sunken p-4">
                  <p className="text-[13.5px] text-text-secondary">
                    Start a visit before recording vitals so the readings are linked to the correct consultation.
                  </p>
                  {!isStartingVisit && (
                    <Button
                      className="mt-3"
                      variant="secondary"
                      size="md"
                      icon={<HeartPulse className="size-3.5" aria-hidden />}
                      onClick={() => setIsStartingVisit(true)}
                    >
                      Start visit to take vitals
                    </Button>
                  )}
                </div>
              ) : isCapturingVitals ? (
                <>
                  {vitalsError && (
                    <p role="alert" className="mb-4 text-[13.5px] text-danger-600">
                      {vitalsError}
                    </p>
                  )}

                  <label className="mb-4 flex items-center gap-3 rounded-lg border border-danger-500/25 bg-danger-50 px-3.5 py-3">
                    <Switch
                      checked={vitalsForm.emergencySign}
                      onChange={(checked) => setVitalsForm((f) => ({ ...f, emergencySign: checked }))}
                      label="Emergency sign present"
                    />
                    <span className="text-[13.5px] font-medium text-danger-600">
                      Emergency sign present — assigns Red immediately, skips the vitals below
                    </span>
                  </label>

                  {vitalsForm.emergencySign ? (
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[13px] font-medium text-text-primary">
                        What emergency sign was observed? <span className="text-danger-500">*</span>
                      </span>
                      <textarea
                        className="min-h-[70px] rounded-lg border border-border-default bg-surface-base px-3 py-2 text-[13.5px] text-text-primary outline-none focus:border-brand-500"
                        value={vitalsForm.emergencySignNote}
                        onChange={(e) => setVitalsForm((f) => ({ ...f, emergencySignNote: e.target.value }))}
                        placeholder="e.g. Airway obstruction, unresponsive, active seizure…"
                      />
                    </label>
                  ) : (
                    <div className="flex flex-col gap-4">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <Input
                          label="Respiratory rate (breaths/min)"
                          icon={<Wind className="size-4" aria-hidden />}
                          required
                          type="number"
                          value={vitalsForm.respiratoryRate}
                          onChange={(e) => setVitalsForm((f) => ({ ...f, respiratoryRate: e.target.value }))}
                        />
                        <Input
                          label="Heart rate (bpm)"
                          icon={<HeartPulse className="size-4" aria-hidden />}
                          required
                          type="number"
                          value={vitalsForm.heartRate}
                          onChange={(e) => setVitalsForm((f) => ({ ...f, heartRate: e.target.value }))}
                        />
                        <Input
                          label="Temperature (°C)"
                          required
                          type="number"
                          step="0.1"
                          icon={<Thermometer className="size-4" aria-hidden />}
                          value={vitalsForm.temperatureCelsius}
                          onChange={(e) => setVitalsForm((f) => ({ ...f, temperatureCelsius: e.target.value }))}
                        />
                        <Input
                          label="Systolic BP (mmHg)"
                          icon={<Gauge className="size-4" aria-hidden />}
                          required
                          type="number"
                          value={vitalsForm.systolicBp}
                          onChange={(e) => setVitalsForm((f) => ({ ...f, systolicBp: e.target.value }))}
                        />
                        <Input
                          label="Diastolic BP (mmHg)"
                          icon={<Gauge className="size-4" aria-hidden />}
                          type="number"
                          value={vitalsForm.diastolicBp}
                          onChange={(e) => setVitalsForm((f) => ({ ...f, diastolicBp: e.target.value }))}
                        />
                        <Input
                          label="SpO2 (%)"
                          icon={<Activity className="size-4" aria-hidden />}
                          type="number"
                          value={vitalsForm.spo2Percent}
                          onChange={(e) => setVitalsForm((f) => ({ ...f, spo2Percent: e.target.value }))}
                        />
                        <Select
                          label="AVPU"
                          required
                          options={AVPU_OPTIONS}
                          value={vitalsForm.avpu}
                          onChange={(e) => setVitalsForm((f) => ({ ...f, avpu: e.target.value as Avpu }))}
                        />
                        {(vitalsForm.scoringProfileOverride
                          ? vitalsForm.scoringProfileOverride.startsWith("PAEDIATRIC")
                          : isPaediatric(patient?.dateOfBirth)) && (
                          <>
                            <Select
                              label="Clinician-confirmed final colour"
                              options={TRIAGE_COLOUR_OPTIONS}
                              value={vitalsForm.clinicianConfirmedColour}
                              onChange={(e) => setVitalsForm((f) => ({
                                ...f,
                                clinicianConfirmedColour: e.target.value as TriageColour,
                              }))}
                            />
                            <Input
                              label="Paediatric colour reason"
                              placeholder="Clinical basis for the selected colour"
                              value={vitalsForm.colourConfirmationReason}
                              onChange={(e) => setVitalsForm((f) => ({ ...f, colourConfirmationReason: e.target.value }))}
                            />
                          </>
                        )}
                        <Select
                          label="Mobility"
                          required
                          options={MOBILITY_OPTIONS}
                          value={vitalsForm.mobility}
                          onChange={(e) => setVitalsForm((f) => ({ ...f, mobility: e.target.value as Mobility }))}
                        />
                        <Select
                          label="Oxygen"
                          options={OXYGEN_SUPPORT_OPTIONS}
                          value={vitalsForm.oxygenSupport}
                          onChange={(e) =>
                            setVitalsForm((f) => ({ ...f, oxygenSupport: e.target.value as OxygenSupport }))
                          }
                        />
                        {vitalsForm.oxygenSupport === "SUPPLEMENTAL" && (
                          <>
                            <Input
                              label="Oxygen device"
                              placeholder="Nasal cannula, face mask…"
                              value={vitalsForm.oxygenDevice}
                              onChange={(e) => setVitalsForm((f) => ({ ...f, oxygenDevice: e.target.value }))}
                            />
                            <Input
                              label="Flow rate (L/min)"
                              type="number"
                              step="0.1"
                              value={vitalsForm.oxygenFlowLpm}
                              onChange={(e) => setVitalsForm((f) => ({ ...f, oxygenFlowLpm: e.target.value }))}
                            />
                          </>
                        )}
                        <Input
                          label="Pain score"
                          type="number"
                          value={vitalsForm.painScore}
                          onChange={(e) => setVitalsForm((f) => ({ ...f, painScore: e.target.value }))}
                        />
                        <Input
                          label="Pain scale used"
                          placeholder="Numeric 0-10, Wong-Baker…"
                          value={vitalsForm.painScale}
                          onChange={(e) => setVitalsForm((f) => ({ ...f, painScale: e.target.value }))}
                        />
                        <Select
                          label="Scoring profile"
                          options={SCORING_PROFILE_OPTIONS}
                          value={vitalsForm.scoringProfileOverride}
                          onChange={(e) =>
                            setVitalsForm((f) => ({ ...f, scoringProfileOverride: e.target.value as ScoringProfile }))
                          }
                        />
                      </div>

                      <div>
                        <p className="mb-2 text-[13px] font-medium text-text-primary">
                          Clinical discriminators (if any apply)
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {DISCRIMINATOR_OPTIONS.map((option) => {
                            const selected = vitalsForm.discriminators.includes(option.value);
                            return (
                              <button
                                type="button"
                                key={option.value}
                                aria-pressed={selected}
                                onClick={() => toggleDiscriminator(option.value)}
                                className={`rounded-full border px-3 py-1.5 text-[12.5px] font-medium ${
                                  selected
                                    ? "border-brand-500 bg-brand-50 text-brand-700"
                                    : "border-border-strong bg-surface-raised text-text-secondary"
                                }`}
                              >
                                {option.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  <AdditionalVitalsForm value={vitalsForm.additional} onChange={additional => setVitalsForm(f => ({ ...f, additional }))} />
                  <label className="mt-4 flex flex-col gap-1.5">
                    <span className="text-[13px] font-medium text-text-primary">Presenting complaint</span>
                    <textarea
                      className="min-h-[60px] rounded-lg border border-border-default bg-surface-base px-3 py-2 text-[13.5px] text-text-primary outline-none focus:border-brand-500"
                      value={vitalsForm.presentingComplaint}
                      onChange={(e) => setVitalsForm((f) => ({ ...f, presentingComplaint: e.target.value }))}
                      placeholder="Why is the patient here today?"
                    />
                  </label>

                  {unusualVitals(vitalsForm).length > 0 && (
                    <label className="mt-4 flex items-start gap-2 rounded-lg border border-warning-500/30 bg-warning-50 p-3">
                      <input
                        type="checkbox"
                        checked={vitalsForm.confirmOutOfRange}
                        onChange={(e) => setVitalsForm((f) => ({ ...f, confirmOutOfRange: e.target.checked }))}
                        className="mt-0.5 size-4"
                      />
                      <span className="text-[13px] text-text-primary">
                        <span className="block font-semibold">Unusual measurement confirmation</span>
                        I repeated or otherwise confirmed these values and want to save them as observed:
                        {` ${unusualVitals(vitalsForm).join(", ")}`}.
                      </span>
                    </label>
                  )}

                  <div className="mt-4 flex gap-2">
                    <Button loading={captureVitals.isPending} onClick={handleCaptureVitals}>
                      Save vitals
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setIsCapturingVitals(false);
                        setVitalsError(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  {latestVitals ? (
                    <div className="flex flex-col gap-3">
                      {latestVitals.scoringVersion.includes("DRAFT") && (
                        <div role="alert" className="rounded-lg border border-warning-500/30 bg-warning-50 px-3 py-2 text-[12.5px] text-text-primary">
                          Draft SATS scoring table — for development only. Clinical validation is required before production use.
                        </div>
                      )}
                      <VitalsOverview assessment={latestVitals} />
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        <Field label="TEWS score" value={latestVitals.tewsScore == null ? "Not calculated" : String(latestVitals.tewsScore)} />
                        <Field label="Consciousness" value={AVPU_OPTIONS.find(o => o.value === latestVitals.avpu)?.label ?? "Not recorded"} />
                        <Field label="Mobility" value={MOBILITY_OPTIONS.find(o => o.value === latestVitals.mobility)?.label ?? "Not recorded"} />
                      </div>
                      <AdditionalVitalsSummary value={latestVitals.additionalObservations} />
                      {latestVitals.presentingComplaint && (
                        <Field label="Presenting complaint" value={latestVitals.presentingComplaint} />
                      )}
                      {latestVitals.outOfRangeConfirmed && latestVitals.validationWarnings && (
                        <div className="rounded-lg border border-warning-500/30 bg-warning-50 px-3 py-2 text-[12.5px] text-text-primary">
                          Confirmed unusual measurements: {latestVitals.validationWarnings}
                        </div>
                      )}
                      <p className="text-[12.5px] text-text-secondary">
                        Captured {formatDateTime(latestVitals.observedAt)}
                        {latestVitals.overrideReason && " · colour manually overridden"}
                      </p>
                    </div>
                  ) : (
                    <p className="text-[13.5px] text-text-secondary">No vitals captured yet for this visit.</p>
                  )}
                  <div className="mt-4 flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="md"
                      icon={<HeartPulse className="size-3.5" aria-hidden />}
                      onClick={() => setIsCapturingVitals(true)}
                    >
                      {latestVitals ? "Take new reading" : "Take vitals"}
                    </Button>
                    {earlierVitals.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowVitalsHistory((s) => !s)}
                        className="inline-flex items-center gap-1 text-[12.5px] font-medium text-text-secondary transition-colors duration-150 hover:text-text-primary"
                      >
                        <ChevronDown
                          className={clsx("size-3.5 transition-transform duration-150", showVitalsHistory && "rotate-180")}
                          aria-hidden
                        />
                        {showVitalsHistory ? "Hide" : "Show"} {earlierVitals.length} earlier{" "}
                        {earlierVitals.length === 1 ? "reading" : "readings"}
                      </button>
                    )}
                  </div>
                  {showVitalsHistory && earlierVitals.length > 0 && (
                    <div className="mt-3 flex flex-col gap-2 border-t border-border-subtle pt-3">
                      {earlierVitals.map((assessment) => (
                        <VitalsHistoryRow
                          key={assessment.id}
                          assessment={assessment}
                          patientName={`${patient.firstName} ${patient.lastName}`}
                          patientMpi={patient.mpiNumber}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </Card>
          )}

          {(isPrescribing || createdPrescription) && (
            <Card className="mb-6 p-6">
              {createdPrescription ? (
                <div className="flex flex-col items-center gap-2 text-center">
                  <span className="flex size-11 items-center justify-center rounded-full bg-success-50 text-success-500">
                    <Pill className="size-6" aria-hidden />
                  </span>
                  <h2 className="text-[16px] font-semibold text-text-primary">Prescription created</h2>
                  <p className="rounded-lg bg-surface-sunken px-3 py-1.5 font-mono text-[15px] font-semibold text-text-primary">
                    {createdPrescription.serialNumber}
                  </p>
                  <p className="text-[13.5px] text-text-secondary">
                    Sent to the dispensing queue.{" "}
                    <Link to="/app/pharmacy" className="font-medium text-brand-600 hover:text-brand-700">
                      View pharmacy queue
                    </Link>
                  </p>
                  <Button variant="secondary" size="md" className="mt-1" onClick={() => setCreatedPrescription(null)}>
                    Dismiss
                  </Button>
                </div>
              ) : (
                <>
                  <h2 className="mb-4 text-[14.5px] font-semibold text-text-primary">Prescribe</h2>
                  {prescriptionError && (
                    <p role="alert" className="mb-4 text-[13.5px] text-danger-600">
                      {prescriptionError}
                    </p>
                  )}
                  <div className="flex flex-col gap-3">
                    {prescriptionItems.map((item, index) => (
                      <div key={index} className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_2fr_1fr_auto]">
                        <Input
                          label="Drug name"
                          required={index === 0}
                          placeholder="Paracetamol"
                          value={item.drugName}
                          onChange={(e) => updateItem(index, { drugName: e.target.value })}
                        />
                        <Input
                          label="Dosage"
                          required={index === 0}
                          placeholder="500mg twice daily"
                          value={item.dosage}
                          onChange={(e) => updateItem(index, { dosage: e.target.value })}
                        />
                        <Input
                          label="Quantity"
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => updateItem(index, { quantity: Number(e.target.value) || 1 })}
                        />
                        <div className="flex items-end">
                          <button
                            type="button"
                            disabled={prescriptionItems.length === 1}
                            onClick={() =>
                              setPrescriptionItems((items) => items.filter((_, i) => i !== index))
                            }
                            className="flex h-11 w-11 items-center justify-center rounded-lg text-text-secondary transition-colors duration-150 hover:bg-danger-50 hover:text-danger-600 disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label="Remove item"
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setPrescriptionItems((items) => [...items, { ...EMPTY_ITEM }])}
                    className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-600 hover:text-brand-700"
                  >
                    <Plus className="size-3.5" aria-hidden />
                    Add another item
                  </button>
                  <div className="mt-4 flex gap-2">
                    <Button loading={prescribe.isPending} onClick={handlePrescribe}>
                      Create prescription
                    </Button>
                    <Button variant="secondary" onClick={() => setIsPrescribing(false)}>
                      Cancel
                    </Button>
                  </div>
                </>
              )}
            </Card>
          )}

          <DemographicsCard patient={patient} isOrgAdmin={isOrgAdmin} />

          <PatientDocumentsCard patientId={patient.id} archived={patient.archived} />

          <GuardiansCard patientId={patient.id} archived={patient.archived} />
            </>
          )}
        </>
      )}
    </div>
  );
}

interface PatientDraft {
  firstName: string;
  lastName: string;
  address: string;
  contactNumber: string;
  email: string;
  medicalAidProvider: string;
  medicalAidNumber: string;
  passportNumber: string;
  passportExpiry: string;
  reason: string;
}

function draftFromPatient(patient: Patient): PatientDraft {
  return {
    firstName: patient.firstName,
    lastName: patient.lastName,
    address: patient.address,
    contactNumber: patient.contactNumber,
    email: patient.email ?? "",
    medicalAidProvider: patient.medicalAidProvider ?? "",
    medicalAidNumber: patient.medicalAidNumber ?? "",
    passportNumber: patient.passportNumber ?? "",
    passportExpiry: patient.passportExpiry ?? "",
    reason: "",
  };
}

// PREG-US-016 — the Demographics card doubles as the edit form: isOrgAdmin
// (checked by the caller against user.role, RequireRole's own pattern)
// gates both the Edit button and the change-history toggle, but the real
// enforcement is server-side (SecurityConfig's /api/v1/admin/** matcher on
// PatientController.update()/getHistory() — see those methods' own
// why-notes). idNumber/dateOfBirth/gender/citizenshipStatus/mpiNumber stay
// plain Field rows even while editing — there's no input for them because
// there's nothing on UpdatePatientPayload for them to send.
function DemographicsCard({ patient, isOrgAdmin }: { patient: Patient; isOrgAdmin: boolean }) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [draft, setDraft] = useState<PatientDraft>(() => draftFromPatient(patient));
  const [formError, setFormError] = useState<string | null>(null);

  const historyQuery = useQuery({
    queryKey: ["patients", patient.id, "history"],
    queryFn: () => getPatientFieldHistory(patient.id),
    enabled: isOrgAdmin && showHistory,
  });

  const update = useMutation({
    mutationFn: () =>
      updatePatient(patient.id, {
        firstName: draft.firstName,
        lastName: draft.lastName,
        address: draft.address,
        contactNumber: draft.contactNumber,
        email: draft.email || undefined,
        medicalAidProvider: draft.medicalAidProvider || undefined,
        medicalAidNumber: draft.medicalAidNumber || undefined,
        passportNumber: draft.passportNumber || undefined,
        passportExpiry: draft.passportExpiry || undefined,
        reason: draft.reason,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients", patient.id] });
      queryClient.invalidateQueries({ queryKey: ["patients", patient.id, "history"] });
      setIsEditing(false);
    },
    onError: (error) => {
      setFormError(error instanceof ApiError ? error.message : "Couldn't save those changes. Try again.");
    },
  });

  const handleSave = () => {
    setFormError(null);
    if (!draft.firstName.trim() || !draft.lastName.trim() || !draft.address.trim() || !draft.contactNumber.trim()) {
      setFormError("First name, last name, address, and contact number are required.");
      return;
    }
    if (!draft.reason.trim()) {
      setFormError("A reason for this change is required.");
      return;
    }
    update.mutate();
  };

  const history = historyQuery.data ?? [];

  return (
    <Card className="p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[14.5px] font-semibold text-text-primary">Demographics</h2>
        {isOrgAdmin && !isEditing && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowHistory((s) => !s)}
              className="inline-flex items-center gap-1 text-[12.5px] font-medium text-text-secondary transition-colors duration-150 hover:text-text-primary"
            >
              <History className="size-3.5" aria-hidden />
              {showHistory ? "Hide" : "View"} change history
            </button>
            {!patient.archived && (
              <Button
                type="button"
                variant="secondary"
                size="md"
                icon={<Pencil className="size-3.5" aria-hidden />}
                onClick={() => {
                  setDraft(draftFromPatient(patient));
                  setIsEditing(true);
                }}
              >
                Edit
              </Button>
            )}
          </div>
        )}
      </div>

      {showHistory && !isEditing && (
        <div className="mb-4 rounded-lg border border-border-subtle p-3">
          {historyQuery.isLoading ? (
            <p className="text-[13px] text-text-secondary">Loading history…</p>
          ) : history.length === 0 ? (
            <p className="text-[13px] text-text-secondary">No changes recorded yet.</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {history.map((h) => (
                <li key={h.id} className="text-[12.5px] text-text-secondary">
                  <span className="font-medium text-text-primary">{FIELD_LABEL[h.fieldName] ?? h.fieldName}</span>{" "}
                  changed from <span className="font-mono text-text-primary">{h.oldValue || "—"}</span> to{" "}
                  <span className="font-mono text-text-primary">{h.newValue || "—"}</span>
                  <br />
                  &ldquo;{h.reason}&rdquo; · {formatDateTime(h.changedAt)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {isEditing ? (
        <div className="flex flex-col gap-4">
          {formError && (
            <p role="alert" className="text-[13.5px] text-danger-600">
              {formError}
            </p>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="First name"
              required
              value={draft.firstName}
              onChange={(e) => setDraft((d) => ({ ...d, firstName: e.target.value }))}
            />
            <Input
              label="Last name"
              required
              value={draft.lastName}
              onChange={(e) => setDraft((d) => ({ ...d, lastName: e.target.value }))}
            />
            <Input
              label="Address"
              required
              value={draft.address}
              onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))}
            />
            <Input
              label="Contact number"
              required
              value={draft.contactNumber}
              onChange={(e) => setDraft((d) => ({ ...d, contactNumber: e.target.value }))}
            />
            <Input
              label="Email"
              type="email"
              value={draft.email}
              onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
            />
            <Input
              label="Medical aid provider"
              value={draft.medicalAidProvider}
              onChange={(e) => setDraft((d) => ({ ...d, medicalAidProvider: e.target.value }))}
            />
            <Input
              label="Medical aid number"
              value={draft.medicalAidNumber}
              onChange={(e) => setDraft((d) => ({ ...d, medicalAidNumber: e.target.value }))}
            />
            <Input
              label="Passport number"
              value={draft.passportNumber}
              onChange={(e) => setDraft((d) => ({ ...d, passportNumber: e.target.value }))}
            />
            <Input
              label="Passport expiry"
              type="date"
              value={draft.passportExpiry}
              onChange={(e) => setDraft((d) => ({ ...d, passportExpiry: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-text-primary">
              Reason for change <span className="text-danger-500">*</span>
            </label>
            <textarea
              value={draft.reason}
              onChange={(e) => setDraft((d) => ({ ...d, reason: e.target.value }))}
              rows={2}
              placeholder="e.g. Patient moved address, confirmed by phone"
              className="w-full rounded-lg border border-border-strong bg-surface-raised px-3.5 py-2.5 text-[14px] text-text-primary outline-none transition-colors duration-150 placeholder:text-text-secondary/70 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" loading={update.isPending} onClick={handleSave}>
              Save changes
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsEditing(false);
                setFormError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Date of birth" value={formatDate(patient.dateOfBirth)} />
          <Field label="Gender" value={titleCase(patient.gender)} />
          <Field
            label="Citizenship"
            value={patient.citizenshipStatus === "SA_CITIZEN" ? "SA citizen" : "Permanent resident"}
          />
          <Field label="ID number" value={patient.idNumber} />
          <Field label="Contact number" value={patient.contactNumber} />
          <Field label="Email" value={patient.email ?? "—"} />
          <Field label="Address" value={patient.address} />
          <Field label="Medical aid provider" value={patient.medicalAidProvider ?? "—"} />
          <Field label="Medical aid number" value={patient.medicalAidNumber ?? "—"} />
          <Field label="Passport number" value={patient.passportNumber ?? "—"} />
          <Field
            label="Passport expiry"
            value={patient.passportExpiry ? formatDate(patient.passportExpiry) : "—"}
          />
          <Field label="Registered" value={formatDateTime(patient.createdAt)} />
        </div>
      )}
    </Card>
  );
}

// The origin tenant's "full ongoing access" view (decision #3) — a LIVE
// read of the destination record, fetched fresh on every expand, not a
// snapshot frozen at migration time. Reuses DocumentRow for each document
// (its onView prop doesn't care what it fetches, just that it resolves to a
// URL), but with its own handleView pointed at the destination-scoped
// download endpoint rather than the normal patient one — this record's
// documents live in a different tenant's schema, so the normal
// getPatientDocumentDownloadUrl() would 404 against this tenant's own data.
function DestinationRecordCard({ patientId }: { patientId: string }) {
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [viewError, setViewError] = useState<string | null>(null);

  const viewQuery = useQuery({
    queryKey: ["patients", patientId, "migration-destination-view"],
    queryFn: () => getPatientMigrationDestinationView(patientId),
  });

  const handleView = async (doc: PatientDocument) => {
    setViewError(null);
    setViewingId(doc.id);
    const tab = window.open("", "_blank");
    if (tab) tab.opener = null;
    try {
      const url = await getMigrationDestinationDocumentDownloadUrl(patientId, doc.id);
      if (tab) tab.location.href = url;
    } catch (error) {
      tab?.close();
      setViewError(error instanceof ApiError ? error.message : "Couldn't open that file. Try again.");
    } finally {
      setViewingId(null);
    }
  };

  if (viewQuery.isLoading) {
    return (
      <Card className="mb-6 p-6">
        <p className="text-[13.5px] text-text-secondary">Loading current record…</p>
      </Card>
    );
  }
  if (viewQuery.isError || !viewQuery.data) {
    return (
      <Card className="mb-6 p-6">
        <p role="alert" className="text-[13.5px] text-danger-600">
          Couldn't load the current record.{" "}
          <button type="button" className="underline" onClick={() => viewQuery.refetch()}>
            Try again
          </button>
        </p>
      </Card>
    );
  }

  const view = viewQuery.data;
  return (
    <Card className="mb-6 border-brand-500/20 p-6">
      <h2 className="text-[14.5px] font-semibold text-text-primary">
        Current record at {view.destinationOrganizationDisplayName}
      </h2>
      <p className="mb-4 mt-0.5 text-[12.5px] text-text-secondary">
        {view.destinationFacilityName} · demographics and documents only — visits, vitals, and prescriptions
        recorded there stay private to that organization.
      </p>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="MPI" value={view.patient.mpiNumber} />
        <Field label="Contact number" value={view.patient.contactNumber} />
        <Field label="Email" value={view.patient.email ?? "—"} />
        <Field label="Address" value={view.patient.address} />
        <Field label="Medical aid provider" value={view.patient.medicalAidProvider ?? "—"} />
        <Field label="Medical aid number" value={view.patient.medicalAidNumber ?? "—"} />
      </div>

      {view.documents.length > 0 && (
        <div className="mt-5 border-t border-border-subtle pt-4">
          <p className="mb-2 text-[12.5px] font-medium text-text-secondary">Documents</p>
          {viewError && (
            <p role="alert" className="mb-2 text-[13px] text-danger-600">
              {viewError}
            </p>
          )}
          <div className="flex flex-col gap-2">
            {view.documents.map((doc) => (
              <DocumentRow key={doc.id} doc={doc} viewing={viewingId === doc.id} onView={handleView} />
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

// Wraps a hidden file input and hands the caller just an `open()` trigger —
// used twice per DocumentTypeSection (the small header "Add" affordance,
// the empty-state dropzone) rather than duplicating the input each time.
function FileTrigger({
  documentType,
  onSelect,
  children,
}: {
  documentType: PatientDocumentType;
  onSelect: (documentType: PatientDocumentType, file: File) => void;
  children: (open: () => void) => ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      {children(() => inputRef.current?.click())}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onSelect(documentType, file);
        }}
      />
    </>
  );
}

function DocumentRow({
  doc,
  viewing,
  onView,
  muted,
}: {
  doc: PatientDocument;
  viewing: boolean;
  onView: (doc: PatientDocument) => void;
  muted?: boolean;
}) {
  const FileIcon = fileTypeIcon(doc.contentType);
  return (
    <div
      className={clsx(
        "flex items-center justify-between gap-3 rounded-lg px-2.5 py-2",
        muted ? "opacity-70" : "bg-surface-sunken",
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <FileIcon className="size-4 shrink-0 text-text-secondary" aria-hidden />
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-text-primary">{doc.originalFilename}</p>
          <p className="text-[12px] text-text-secondary">
            {formatFileSize(doc.fileSize)} · {formatRelativeDate(doc.uploadedAt)}
          </p>
        </div>
      </div>
      <Button
        type="button"
        variant="secondary"
        size="md"
        loading={viewing}
        icon={<Download className="size-3.5" aria-hidden />}
        onClick={() => onView(doc)}
      >
        View
      </Button>
    </div>
  );
}

// One panel per document type rather than a single flat list — "do we have
// an ID copy on file" should be answerable at a glance, and a rescanned ID
// or renewed medical aid card is a new row, not an overwrite
// (PatientDocumentService.upload()'s own why-note), so each type can grow
// its own history. Only the latest of each type shows by default; older
// ones sit behind a "N earlier versions" toggle.
function DocumentTypeSection({
  documentType,
  documents,
  uploading,
  onSelect,
  viewingId,
  onView,
  disabled = false,
}: {
  documentType: PatientDocumentType;
  documents: PatientDocument[];
  uploading: boolean;
  onSelect: (documentType: PatientDocumentType, file: File) => void;
  viewingId: string | null;
  onView: (doc: PatientDocument) => void;
  disabled?: boolean;
}) {
  const [showHistory, setShowHistory] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const { label, icon: TypeIcon } = DOCUMENT_TYPE_CONFIG[documentType];
  const [latest, ...history] = documents;

  return (
    <div className="rounded-xl border border-border-subtle p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-surface-sunken text-text-secondary">
            <TypeIcon className="size-4" aria-hidden />
          </span>
          <span className="text-[13.5px] font-semibold text-text-primary">{label}</span>
        </div>
        {latest && !disabled && (
          <FileTrigger documentType={documentType} onSelect={onSelect}>
            {(open) => (
              <button
                type="button"
                onClick={open}
                disabled={uploading}
                className="inline-flex items-center gap-1 text-[12.5px] font-medium text-brand-600 transition-colors duration-150 hover:text-brand-700 disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <Upload className="size-3.5" aria-hidden />
                )}
                Add
              </button>
            )}
          </FileTrigger>
        )}
      </div>

      {!latest && disabled ? (
        <div className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-border-subtle bg-surface-sunken/40 px-4 py-6 text-center">
          <p className="text-[12.5px] text-text-secondary">No document on file</p>
        </div>
      ) : !latest ? (
        <FileTrigger documentType={documentType} onSelect={onSelect}>
          {(open) => (
            <div
              role="button"
              tabIndex={0}
              onClick={open}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") open();
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file) onSelect(documentType, file);
              }}
              className={clsx(
                "flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-dashed px-4 py-6 text-center transition-colors duration-150",
                isDragOver
                  ? "border-brand-400 bg-brand-50"
                  : "border-border-strong bg-surface-sunken/60 hover:bg-surface-sunken",
              )}
            >
              {uploading ? (
                <Loader2 className="size-5 animate-spin text-text-secondary" aria-hidden />
              ) : (
                <Upload className="size-5 text-text-secondary" aria-hidden />
              )}
              <p className="text-[12.5px] text-text-secondary">
                {uploading ? (
                  "Uploading…"
                ) : (
                  <>
                    Drop a file, or <span className="font-medium text-brand-600">browse</span>
                  </>
                )}
              </p>
            </div>
          )}
        </FileTrigger>
      ) : (
        <div className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            <motion.div
              key={latest.id}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <DocumentRow doc={latest} viewing={viewingId === latest.id} onView={onView} />
            </motion.div>
          </AnimatePresence>

          {history.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setShowHistory((s) => !s)}
                className="inline-flex items-center gap-1 self-start text-[12px] font-medium text-text-secondary transition-colors duration-150 hover:text-text-primary"
              >
                <ChevronDown
                  className={clsx("size-3.5 transition-transform duration-150", showHistory && "rotate-180")}
                  aria-hidden
                />
                {showHistory ? "Hide" : "Show"} {history.length} earlier {history.length === 1 ? "version" : "versions"}
              </button>
              {showHistory && (
                <div className="flex flex-col gap-1.5 border-t border-border-subtle pt-2">
                  {history.map((doc) => (
                    <DocumentRow key={doc.id} doc={doc} viewing={viewingId === doc.id} onView={onView} muted />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// PREG-US-... document attachments — an ID copy and/or medical aid card
// filed against the patient record. Uploads are server-proxied (same shape
// as StaffPhotoService's own why-note) so PatientDocumentService can
// validate content type before anything reaches S3; downloads go straight
// from the browser to a short-lived presigned URL instead, fetched fresh
// right before use rather than cached (getPatientDocumentDownloadUrl()'s own
// why-note) — this card never holds a link longer than the one click that
// asked for it.
function PatientDocumentsCard({ patientId, archived }: { patientId: string; archived: boolean }) {
  const queryClient = useQueryClient();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [viewError, setViewError] = useState<string | null>(null);

  const documentsQuery = useQuery({
    queryKey: ["patients", patientId, "documents"],
    queryFn: () => listPatientDocuments(patientId),
  });

  const upload = useMutation({
    mutationFn: ({ documentType, file }: { documentType: PatientDocumentType; file: File }) =>
      uploadPatientDocument(patientId, documentType, file),
    onMutate: () => setUploadError(null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["patients", patientId, "documents"] }),
    onError: (error) => {
      setUploadError(error instanceof ApiError ? error.message : "Couldn't upload that file. Try again.");
    },
  });

  // Same checks PatientDocumentService.upload() and the global multipart
  // limit enforce server-side — validateDocumentFile()'s own why-note on
  // why this doesn't replace that, just catches the same rejection before
  // a round trip. Covers both trigger paths (the header "Add" link and the
  // empty-state dropzone's drag-and-drop) since DocumentTypeSection funnels
  // every selection through this one onSelect.
  const handleSelect = (documentType: PatientDocumentType, file: File) => {
    const message = validateDocumentFile(file);
    if (message) {
      setUploadError(message);
      return;
    }
    upload.mutate({ documentType, file });
  };

  const handleView = async (doc: PatientDocument) => {
    setViewError(null);
    setViewingId(doc.id);
    // Opened synchronously, inside the click handler's own call stack, then
    // navigated once the presigned URL comes back — a window.open() called
    // only after the await below (the URL is asynchronous, fetched fresh
    // per PatientDocumentService.getDownloadUrl()'s own why-note) loses the
    // browser's "direct user gesture" context and gets silently treated as
    // a popup. No "noopener" in the feature string, deliberately — that
    // flag makes window.open() itself return null, which would defeat
    // navigating this tab below; severing tab.opener by hand achieves the
    // same tabnabbing protection without losing the reference.
    const tab = window.open("", "_blank");
    if (tab) tab.opener = null;
    try {
      const url = await getPatientDocumentDownloadUrl(patientId, doc.id);
      if (tab) tab.location.href = url;
    } catch (error) {
      tab?.close();
      setViewError(error instanceof ApiError ? error.message : "Couldn't open that file. Try again.");
    } finally {
      setViewingId(null);
    }
  };

  const documents = documentsQuery.data ?? [];
  const byType = (type: PatientDocumentType) => documents.filter((d) => d.documentType === type);

  return (
    <Card className="mt-6 p-6">
      <h2 className="text-[14.5px] font-semibold text-text-primary">Documents</h2>
      <p className="mb-4 mt-0.5 text-[12.5px] text-text-secondary">
        PDF, JPEG, or PNG. Stored privately — each "View" link expires a few minutes after you open it.
      </p>

      {uploadError && (
        <p role="alert" className="mb-3 text-[13.5px] text-danger-600">
          {uploadError}
        </p>
      )}
      {viewError && (
        <p role="alert" className="mb-3 text-[13.5px] text-danger-600">
          {viewError}
        </p>
      )}

      {documentsQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="h-28 animate-pulse rounded-xl bg-surface-sunken" />
          <div className="h-28 animate-pulse rounded-xl bg-surface-sunken" />
          <div className="h-28 animate-pulse rounded-xl bg-surface-sunken" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <DocumentTypeSection
            documentType="ID_COPY"
            documents={byType("ID_COPY")}
            uploading={upload.isPending && upload.variables?.documentType === "ID_COPY"}
            onSelect={handleSelect}
            viewingId={viewingId}
            onView={handleView}
            disabled={archived}
          />
          <DocumentTypeSection
            documentType="BIRTH_CERTIFICATE"
            documents={byType("BIRTH_CERTIFICATE")}
            uploading={upload.isPending && upload.variables?.documentType === "BIRTH_CERTIFICATE"}
            onSelect={handleSelect}
            viewingId={viewingId}
            onView={handleView}
            disabled={archived}
          />
          <DocumentTypeSection
            documentType="MEDICAL_AID_CARD"
            documents={byType("MEDICAL_AID_CARD")}
            uploading={upload.isPending && upload.variables?.documentType === "MEDICAL_AID_CARD"}
            onSelect={handleSelect}
            viewingId={viewingId}
            onView={handleView}
            disabled={archived}
          />
        </div>
      )}
    </Card>
  );
}

interface GuardianDraft {
  firstName: string;
  lastName: string;
  relationship: GuardianRelationship | "";
  contactNumber: string;
  idNumber: string;
  email: string;
  signature: Blob | null;
}

const EMPTY_GUARDIAN_DRAFT: GuardianDraft = {
  firstName: "",
  lastName: "",
  relationship: "",
  contactNumber: "",
  idNumber: "",
  email: "",
  signature: null,
};

// Anyone travelling with the patient who may need to be reached, or —
// once they've signed — act on the patient's behalf. Unlike documents
// (deliberately append-only), a guardian is editable-by-deletion: a wrong
// entry gets removed and re-added rather than amended in place, matching
// PatientGuardianService.remove()'s own why-note.
function GuardiansCard({ patientId, archived }: { patientId: string; archived: boolean }) {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [draft, setDraft] = useState<GuardianDraft>(EMPTY_GUARDIAN_DRAFT);
  const [addError, setAddError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [viewingSignatureId, setViewingSignatureId] = useState<string | null>(null);
  const [signatureError, setSignatureError] = useState<string | null>(null);

  const guardiansQuery = useQuery({
    queryKey: ["patients", patientId, "guardians"],
    queryFn: () => listGuardians(patientId),
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const created = await addGuardian(patientId, {
        firstName: draft.firstName,
        lastName: draft.lastName,
        relationship: draft.relationship as GuardianRelationship,
        contactNumber: draft.contactNumber,
        idNumber: draft.idNumber || undefined,
        email: draft.email || undefined,
      });
      if (draft.signature) await uploadGuardianSignature(patientId, created.id, draft.signature);
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients", patientId, "guardians"] });
      setIsAdding(false);
      setDraft(EMPTY_GUARDIAN_DRAFT);
    },
    onError: (error) => {
      setAddError(error instanceof ApiError ? error.message : "Couldn't save that guardian. Try again.");
    },
  });

  const handleAdd = () => {
    setAddError(null);
    if (!draft.firstName.trim() || !draft.lastName.trim() || !draft.relationship || !draft.contactNumber.trim()) {
      setAddError("First name, last name, relationship, and contact number are required.");
      return;
    }
    addMutation.mutate();
  };

  const removeMutation = useMutation({
    mutationFn: (guardianId: string) => removeGuardian(patientId, guardianId),
    onMutate: (guardianId) => {
      setRemoveError(null);
      setRemovingId(guardianId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["patients", patientId, "guardians"] }),
    onError: (error) => {
      setRemoveError(error instanceof ApiError ? error.message : "Couldn't remove that guardian. Try again.");
    },
    onSettled: () => setRemovingId(null),
  });

  // Same "open blank, navigate once the URL resolves" shape as
  // PatientDetailPage's own handleView() for documents — see that
  // function's why-note on the popup-blocking bug this avoids.
  const handleViewSignature = async (guardian: Guardian) => {
    setSignatureError(null);
    setViewingSignatureId(guardian.id);
    const tab = window.open("", "_blank");
    if (tab) tab.opener = null;
    try {
      const url = await getGuardianSignatureDownloadUrl(patientId, guardian.id);
      if (tab) tab.location.href = url;
    } catch (error) {
      tab?.close();
      setSignatureError(error instanceof ApiError ? error.message : "Couldn't open that signature. Try again.");
    } finally {
      setViewingSignatureId(null);
    }
  };

  const guardians = guardiansQuery.data ?? [];

  return (
    <Card className="mt-6 p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-text-secondary" aria-hidden />
          <div>
            <h2 className="text-[14.5px] font-semibold text-text-primary">Guardians</h2>
            <p className="text-[12.5px] text-text-secondary">
              Anyone travelling with the patient who may need to be reached, or act on their behalf.
            </p>
          </div>
        </div>
        {!archived && !isAdding && guardians.length < MAX_GUARDIANS && (
          <Button
            type="button"
            variant="secondary"
            size="md"
            icon={<Plus className="size-3.5" aria-hidden />}
            onClick={() => setIsAdding(true)}
          >
            Add guardian
          </Button>
        )}
      </div>

      {removeError && (
        <p role="alert" className="mb-3 text-[13.5px] text-danger-600">
          {removeError}
        </p>
      )}
      {signatureError && (
        <p role="alert" className="mb-3 text-[13.5px] text-danger-600">
          {signatureError}
        </p>
      )}

      {isAdding && (
        <div className="mb-4 flex flex-col gap-3 rounded-lg border border-border-strong p-4">
          {addError && (
            <p role="alert" className="text-[13px] text-danger-600">
              {addError}
            </p>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="First name"
              required
              value={draft.firstName}
              onChange={(e) => setDraft((d) => ({ ...d, firstName: e.target.value }))}
            />
            <Input
              label="Last name"
              required
              value={draft.lastName}
              onChange={(e) => setDraft((d) => ({ ...d, lastName: e.target.value }))}
            />
            <Select
              label="Relationship to patient"
              required
              options={RELATIONSHIP_OPTIONS}
              value={draft.relationship}
              onChange={(e) => setDraft((d) => ({ ...d, relationship: e.target.value as GuardianRelationship }))}
            />
            <Input
              label="Contact number"
              required
              placeholder="+27 82 123 4567"
              value={draft.contactNumber}
              onChange={(e) => setDraft((d) => ({ ...d, contactNumber: e.target.value }))}
            />
            <Input
              label="ID number"
              placeholder="Optional"
              inputMode="numeric"
              value={draft.idNumber}
              onChange={(e) => setDraft((d) => ({ ...d, idNumber: e.target.value }))}
            />
            <Input
              label="Email"
              type="email"
              placeholder="Optional"
              value={draft.email}
              onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
            />
          </div>
          <div>
            <span className="mb-1.5 block text-[13px] font-medium text-text-primary">
              Consent to act on the patient's behalf <span className="font-normal text-text-secondary">(optional)</span>
            </span>
            <SignaturePad onChange={(signature) => setDraft((d) => ({ ...d, signature }))} />
          </div>
          <div className="flex gap-2">
            <Button type="button" loading={addMutation.isPending} onClick={handleAdd}>
              Save guardian
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsAdding(false);
                setAddError(null);
                setDraft(EMPTY_GUARDIAN_DRAFT);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {guardiansQuery.isLoading ? (
        <div className="h-16 animate-pulse rounded-lg bg-surface-sunken" />
      ) : guardians.length === 0 && !isAdding ? (
        <p className="text-[13.5px] text-text-secondary">No guardians on file.</p>
      ) : (
        <ul className="divide-y divide-border-subtle">
          {guardians.map((g) => (
            <li key={g.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-medium text-text-primary">
                  {g.firstName} {g.lastName}
                  <span className="ml-2 font-normal text-text-secondary">{RELATIONSHIP_LABEL[g.relationship]}</span>
                </p>
                <p className="truncate text-[12.5px] text-text-secondary">
                  {g.contactNumber}
                  {g.email ? ` · ${g.email}` : ""}
                  {g.idNumber ? ` · ${g.idNumber}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {g.hasSignature && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    loading={viewingSignatureId === g.id}
                    icon={<PenLine className="size-3.5" aria-hidden />}
                    onClick={() => handleViewSignature(g)}
                  >
                    Signature
                  </Button>
                )}
                {!archived && (
                <button
                  type="button"
                  onClick={() => removeMutation.mutate(g.id)}
                  disabled={removingId === g.id}
                  aria-label={`Remove ${g.firstName} ${g.lastName}`}
                  className="flex size-9 items-center justify-center rounded-lg text-text-secondary transition-colors duration-150 hover:bg-danger-50 hover:text-danger-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
