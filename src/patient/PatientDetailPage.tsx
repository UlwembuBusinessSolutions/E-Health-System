import { useRef, useState, type ComponentType, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import {
  Archive,
  ArrowLeft,
  ChevronDown,
  CreditCard,
  Download,
  FileText,
  HeartPulse,
  History,
  Image as ImageIcon,
  Loader2,
  Pencil,
  PenLine,
  Pill,
  Plus,
  Ticket,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import {
  addGuardian,
  archivePatient,
  getPatient,
  getPatientDocumentDownloadUrl,
  getPatientFieldHistory,
  getGuardianSignatureDownloadUrl,
  listGuardians,
  listPatientDocuments,
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
import { createVisit, type ServiceStream, type VisitType, type VisitWithToken } from "@/shared/api/visits";
import { createPrescription, type Prescription, type PrescriptionItem } from "@/shared/api/pharmacy";
import { getFacilities } from "@/shared/api/facilities";
import { ApiError } from "@/shared/api/client";
import { useAuth } from "@/auth/AuthContext";
import { Card } from "@/shared/components/Card";
import { Button } from "@/shared/components/Button";
import { Input } from "@/shared/components/Input";
import { Select } from "@/shared/components/Select";
import { SignaturePad } from "@/shared/components/SignaturePad";

const EMPTY_ITEM: PrescriptionItem = { drugName: "", dosage: "", quantity: 1 };

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
  const [isStartingVisit, setIsStartingVisit] = useState(false);
  const [facilityId, setFacilityId] = useState("");
  const [visitType, setVisitType] = useState<VisitType | "">("");
  const [serviceStream, setServiceStream] = useState<ServiceStream | "">("");
  const [visitError, setVisitError] = useState<string | null>(null);
  const [startedVisit, setStartedVisit] = useState<VisitWithToken | null>(null);
  const [isPrescribing, setIsPrescribing] = useState(false);
  const [prescriptionItems, setPrescriptionItems] = useState<PrescriptionItem[]>([{ ...EMPTY_ITEM }]);
  const [prescriptionError, setPrescriptionError] = useState<string | null>(null);
  const [createdPrescription, setCreatedPrescription] = useState<Prescription | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [archiveReason, setArchiveReason] = useState("");
  const [archiveDeceasedDate, setArchiveDeceasedDate] = useState("");
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const queryClient = useQueryClient();

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

  const updateItem = (index: number, patch: Partial<PrescriptionItem>) => {
    setPrescriptionItems((items) => items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const patient = patientQuery.data;

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
            {patient.archived && (
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
            )}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3.5">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-brand-500/25 bg-brand-50 text-[14px] font-semibold text-brand-600">
                  {initials(patient.firstName, patient.lastName)}
                </span>
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
          </Card>

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
    </div>
  );
}

interface PatientDraft {
  firstName: string;
  lastName: string;
  address: string;
  contactNumber: string;
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="h-28 animate-pulse rounded-xl bg-surface-sunken" />
          <div className="h-28 animate-pulse rounded-xl bg-surface-sunken" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
