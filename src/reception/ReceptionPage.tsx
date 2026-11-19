import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardList,
  HeartPulse,
  PhoneCall,
  Printer,
  Search,
  ShieldCheck,
  Ticket,
  UserPlus,
} from "lucide-react";
import { ApiError } from "@/shared/api/client";
import { getTenantSlug } from "@/shared/api/auth";
import { getFacilities } from "@/shared/api/facilities";
import { callToken, updateTokenPriority, type QueueActionReason, type TokenPriority } from "@/shared/api/queue";
import { getPatient, searchPatients, type Patient } from "@/shared/api/patients";
import {
  createVisit,
  createWalkInVisit,
  SERVICE_STREAM_DETAILS,
  type ServiceStream,
  type VisitType,
  type VisitWithToken,
} from "@/shared/api/visits";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { Input } from "@/shared/components/Input";
import { Select } from "@/shared/components/Select";
import { printQueueTicket } from "@/shared/lib/printTicket";

type ReceptionStep = "clinic" | "arrival" | "identify" | "visit";

interface ReceptionLocationState {
  facilityId?: string;
  registeredPatientId?: string;
  fromReception?: boolean;
}

interface ReceptionDraft {
  step: ReceptionStep;
  facilityId: string;
  patientId: string | null;
  walkInCheckIn: boolean;
  visitType: VisitType;
  serviceStream: ServiceStream;
  priority: TokenPriority;
  priorityReason: QueueActionReason | "";
  priorityNote: string;
  visitResult: VisitWithToken | null;
}

function isVisitWithToken(value: unknown): value is VisitWithToken {
  if (typeof value !== "object" || value === null || !("visit" in value) || !("token" in value)) return false;
  const visit = value.visit as Record<string, unknown> | null;
  const token = value.token as Record<string, unknown> | null;
  return (
    typeof visit === "object" &&
    visit !== null &&
    typeof visit.id === "string" &&
    (typeof visit.patientId === "string" || visit.patientId === null) &&
    typeof visit.facilityId === "string" &&
    (visit.visitType === "NEW" || visit.visitType === "FOLLOW_UP") &&
    SERVICE_STREAM_OPTIONS.some((option) => option.value === visit.serviceStream) &&
    typeof visit.visitDateTime === "string" &&
    typeof token === "object" &&
    token !== null &&
    typeof token.id === "string" &&
    typeof token.visitId === "string" &&
    typeof token.facilityId === "string" &&
    typeof token.tokenNumber === "number" &&
    (token.priority === "NORMAL" || token.priority === "PRIORITY") &&
    ["ISSUED", "CALLED", "MISSED", "COMPLETED", "CANCELLED"].includes(String(token.status)) &&
    typeof token.manual === "boolean" &&
    typeof token.issuedAt === "string" &&
    (typeof token.calledAt === "string" || token.calledAt === null) &&
    (typeof token.missedAt === "string" || token.missedAt === null) &&
    (typeof token.completedAt === "string" || token.completedAt === null) &&
    (typeof token.cancelledAt === "string" || token.cancelledAt === null) &&
    (typeof token.cancelReason === "string" || token.cancelReason === null)
  );
}

const RECEPTION_DRAFT_KEY = `reception.check-in.${getTenantSlug() ?? "default"}`;
const RECEPTION_STEPS: ReceptionStep[] = ["clinic", "arrival", "identify", "visit"];

function readReceptionDraft(): ReceptionDraft | null {
  const raw = sessionStorage.getItem(RECEPTION_DRAFT_KEY);
  if (!raw) return null;

  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;
    const draft = value as Partial<ReceptionDraft>;
    if (
      typeof draft.step !== "string" ||
      !RECEPTION_STEPS.includes(draft.step as ReceptionStep) ||
      typeof draft.facilityId !== "string"
    ) return null;
    return {
      step: draft.step as ReceptionStep,
      facilityId: draft.facilityId,
      patientId: typeof draft.patientId === "string" ? draft.patientId : null,
      walkInCheckIn: draft.walkInCheckIn === true,
      visitType: draft.visitType === "FOLLOW_UP" ? "FOLLOW_UP" : "NEW",
      serviceStream: SERVICE_STREAM_OPTIONS.some((option) => option.value === draft.serviceStream)
        ? draft.serviceStream!
        : "GENERAL",
      priority: draft.priority === "PRIORITY" ? "PRIORITY" : "NORMAL",
      priorityReason: PRIORITY_REASON_OPTIONS.some((option) => option.value === draft.priorityReason)
        ? draft.priorityReason!
        : "",
      priorityNote: typeof draft.priorityNote === "string" ? draft.priorityNote : "",
      visitResult: isVisitWithToken(draft.visitResult) ? draft.visitResult : null,
    };
  } catch (error) {
    console.error("Couldn't restore the reception check-in draft.", error);
    return null;
  }
}

const VISIT_TYPE_OPTIONS: { value: VisitType; label: string }[] = [
  { value: "NEW", label: "New visit" },
  { value: "FOLLOW_UP", label: "Follow-up visit" },
];

const SERVICE_STREAM_OPTIONS: { value: ServiceStream; label: string }[] = [
  { value: "GENERAL", label: SERVICE_STREAM_DETAILS.GENERAL.label },
  { value: "CHRONIC_CARE", label: SERVICE_STREAM_DETAILS.CHRONIC_CARE.label },
  { value: "MATERNAL_CHILD", label: SERVICE_STREAM_DETAILS.MATERNAL_CHILD.label },
  { value: "OCCUPATIONAL_HEALTH", label: SERVICE_STREAM_DETAILS.OCCUPATIONAL_HEALTH.label },
];

const PRIORITY_REASON_OPTIONS: { value: QueueActionReason; label: string }[] = [
  { value: "CLINICAL_CONCERN", label: "Clinical concern" },
  { value: "ELDERLY_PATIENT", label: "Elderly patient" },
  { value: "PREGNANCY", label: "Pregnancy" },
  { value: "DISABILITY_OR_MOBILITY", label: "Disability or mobility assistance" },
  { value: "YOUNG_CHILD", label: "Young child" },
  { value: "CLINICIAN_REQUEST", label: "Clinician request" },
  { value: "OTHER", label: "Other" },
];

const STEPS: { id: ReceptionStep; label: string }[] = [
  { id: "clinic", label: "Clinic" },
  { id: "arrival", label: "Reception" },
  { id: "identify", label: "Patient" },
  { id: "visit", label: "Visit & token" },
];

function stepNumber(step: ReceptionStep): number {
  return STEPS.findIndex((item) => item.id === step) + 1;
}

function previousStep(step: ReceptionStep): ReceptionStep | null {
  const index = STEPS.findIndex((item) => item.id === step);
  return index > 0 ? STEPS[index - 1].id : null;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function patientRegistrationLink(tokenId: string): string {
  return `/app/patients/new?queueTokenId=${encodeURIComponent(tokenId)}`;
}

function PatientSummary({ patient }: { patient: Patient }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border-subtle bg-surface-sunken p-4">
      <div>
        <p className="font-semibold text-text-primary">
          {patient.firstName} {patient.lastName}
        </p>
        <p className="mt-1 text-[13px] text-text-secondary">
          MPI: <span className="font-mono">{patient.mpiNumber}</span>
          {patient.idNumber ? ` · ID ${patient.idNumber}` : " · No ID number recorded"}
        </p>
        <p className="mt-1 text-[13px] text-text-secondary">
          Date of birth: {patient.dateOfBirth || "Not recorded"} · Contact: {patient.contactNumber || "Not recorded"}
        </p>
      </div>
      <Link
        to={`/app/patients/${patient.id}`}
        state={{ fromReception: true }}
        className="text-[13px] font-medium text-brand-600 hover:underline"
      >
        Open patient record
      </Link>
    </div>
  );
}

export function ReceptionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const returnState = location.state as ReceptionLocationState | null;
  const [initialDraft] = useState(readReceptionDraft);
  const [step, setStep] = useState<ReceptionStep>(
    returnState?.registeredPatientId ? "visit" : initialDraft?.step ?? "clinic",
  );
  const [facilityId, setFacilityId] = useState(returnState?.facilityId ?? initialDraft?.facilityId ?? "");
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [walkInCheckIn, setWalkInCheckIn] = useState(initialDraft?.walkInCheckIn === true);
  const [visitType, setVisitType] = useState<VisitType>(initialDraft?.visitType ?? "NEW");
  const [serviceStream, setServiceStream] = useState<ServiceStream>(initialDraft?.serviceStream ?? "GENERAL");
  const [priority, setPriority] = useState<TokenPriority>(initialDraft?.priority ?? "NORMAL");
  const [priorityReason, setPriorityReason] = useState<QueueActionReason | "">(initialDraft?.priorityReason ?? "");
  const [priorityNote, setPriorityNote] = useState(initialDraft?.priorityNote ?? "");
  const [visitResult, setVisitResult] = useState<VisitWithToken | null>(
    returnState?.registeredPatientId ? null : initialDraft?.visitResult ?? null,
  );
  const [priorityError, setPriorityError] = useState<string | null>(null);
  const [callError, setCallError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const facilitiesQuery = useQuery({ queryKey: ["facilities"], queryFn: getFacilities });
  const registrationReturnQuery = useQuery({
    queryKey: ["reception-registered-patient", returnState?.registeredPatientId],
    queryFn: () => getPatient(returnState!.registeredPatientId!),
    enabled: !!returnState?.registeredPatientId,
  });
  const resumedPatientQuery = useQuery({
    queryKey: ["reception-resumed-patient", initialDraft?.patientId],
    queryFn: () => getPatient(initialDraft!.patientId!),
    enabled: !returnState?.registeredPatientId && !!initialDraft?.patientId,
  });

  useEffect(() => {
    const draft: ReceptionDraft = {
      step,
      facilityId,
      patientId: selectedPatient?.id ?? null,
      walkInCheckIn,
      visitType,
      serviceStream,
      priority,
      priorityReason,
      priorityNote,
      visitResult,
    };
    sessionStorage.setItem(RECEPTION_DRAFT_KEY, JSON.stringify(draft));
  }, [step, facilityId, selectedPatient, walkInCheckIn, visitType, serviceStream, priority, priorityReason, priorityNote, visitResult]);

  useEffect(() => {
    if (!facilityId && facilitiesQuery.data?.length) setFacilityId(facilitiesQuery.data[0].id);
  }, [facilityId, facilitiesQuery.data]);

  useEffect(() => {
    const timeout = setTimeout(() => setSearchTerm(searchInput.trim()), 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const patientSearchQuery = useQuery({
    queryKey: ["reception-patient-search", searchTerm],
    queryFn: () => searchPatients(searchTerm),
    enabled: step === "identify" && searchTerm.length >= 2,
  });

  useEffect(() => {
    if (registrationReturnQuery.data) {
      setSelectedPatient(registrationReturnQuery.data);
      setStep("visit");
    }
  }, [registrationReturnQuery.data]);

  useEffect(() => {
    if (resumedPatientQuery.data) setSelectedPatient(resumedPatientQuery.data);
  }, [resumedPatientQuery.data]);

  const priorityMutation = useMutation({
    mutationFn: ({ tokenId, reasonCode, reasonNote }: { tokenId: string; reasonCode: QueueActionReason; reasonNote?: string }) =>
      updateTokenPriority(tokenId, "PRIORITY", { reasonCode, reasonNote }),
    onSuccess: (entry) => {
      setVisitResult((current) => (current ? { ...current, token: entry.token } : current));
      setPriorityError(null);
    },
    onError: (error) => {
      setPriorityError(errorMessage(error, "The visit was registered, but priority could not be updated. Retry below."));
    },
  });

  const callMutation = useMutation({
    mutationFn: (tokenId: string) => callToken(tokenId),
    onSuccess: (entry) => {
      setVisitResult((current) => (current ? { ...current, token: entry.token } : current));
      setCallError(null);
    },
    onError: (error) => setCallError(errorMessage(error, "Couldn't call this patient. Try again.")),
  });

  const createVisitMutation = useMutation({
    mutationFn: (input: {
      patientId: string;
      facilityId: string;
      visitType: VisitType;
      serviceStream: ServiceStream;
    }) => createVisit(input),
    onSuccess: (result) => {
      setVisitResult(result);
      setFormError(null);
      if (priority === "PRIORITY" && priorityReason) {
        setPriorityError(null);
        priorityMutation.mutate({
          tokenId: result.token.id,
          reasonCode: priorityReason,
          reasonNote: priorityReason === "OTHER" ? priorityNote.trim() : undefined,
        });
      }
    },
    onError: (error) => setFormError(errorMessage(error, "Couldn't register this visit. Try again.")),
  });

  const walkInMutation = useMutation({
    mutationFn: createWalkInVisit,
    onSuccess: (result) => {
      setVisitResult(result);
      setFormError(null);
      if (priority === "PRIORITY" && priorityReason) {
        setPriorityError(null);
        priorityMutation.mutate({
          tokenId: result.token.id,
          reasonCode: priorityReason,
          reasonNote: priorityReason === "OTHER" ? priorityNote.trim() : undefined,
        });
      }
    },
    onError: (error) => setFormError(errorMessage(error, "Couldn't issue a walk-in token. Try again.")),
  });

  const facilities = facilitiesQuery.data ?? [];
  const selectedFacility = facilities.find((facility) => facility.id === facilityId);
  const returnedPatientError = registrationReturnQuery.isError
    ? errorMessage(registrationReturnQuery.error, "Couldn't load the newly registered patient.")
    : null;
  const registrationLink = walkInCheckIn && visitResult
    ? patientRegistrationLink(visitResult.token.id)
    : null;

  function choosePatient(patient: Patient) {
    setSelectedPatient(patient);
    setWalkInCheckIn(false);
    setStep("visit");
    setFormError(null);
  }

  function issueWalkInToken() {
    if (!facilityId) {
      setFormError("Select a clinic before issuing a walk-in token.");
      return;
    }
    setSelectedPatient(null);
    setWalkInCheckIn(true);
    setVisitResult(null);
    setFormError(null);
    walkInMutation.reset();
    setStep("visit");
  }

  function openRegistration() {
    navigate("/app/patients/new", {
      state: { reception: { facilityId } },
    });
  }

  function startVisit() {
    setFormError(null);
    setPriorityError(null);
    setCallError(null);
    if (!facilityId) {
      setFormError(walkInCheckIn ? "Select a clinic before issuing the walk-in token." : "Select a clinic before registering the visit.");
      return;
    }
    if (priority === "PRIORITY" && !priorityReason) {
      setFormError("Select a reason for the priority queue.");
      return;
    }
    if (priority === "PRIORITY" && priorityReason === "OTHER" && priorityNote.trim().length < 3) {
      setFormError("Add a short explanation for the priority request.");
      return;
    }
    setVisitResult(null);
    if (walkInCheckIn) {
      walkInMutation.mutate({ facilityId, visitType, serviceStream });
      return;
    }
    if (!selectedPatient) {
      setFormError("Select a patient before registering the visit.");
      return;
    }
    createVisitMutation.mutate({
      patientId: selectedPatient.id,
      facilityId,
      visitType,
      serviceStream,
    });
  }

  function startNextCheckIn() {
    setVisitResult(null);
    setSelectedPatient(null);
    setWalkInCheckIn(false);
    setSearchInput("");
    setSearchTerm("");
    setPriority("NORMAL");
    setPriorityReason("");
    setPriorityNote("");
    setPriorityError(null);
    setCallError(null);
    setFormError(null);
    setStep("identify");
  }

  return (
    <div className="space-y-5">
      <header className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-brand-800 via-brand-700 to-brand-500 px-5 py-6 text-white shadow-card sm:px-8 sm:py-8">
        <div aria-hidden className="pointer-events-none absolute -right-12 -top-20 size-64 rounded-full border border-white/10" />
        <div aria-hidden className="pointer-events-none absolute -right-2 -top-10 size-44 rounded-full border border-white/10" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[12px] font-medium text-white/90">
              <HeartPulse className="size-3.5" aria-hidden />
              Clinic check-in
            </span>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Patient reception</h1>
            <p className="mt-2 max-w-xl text-[14px] leading-6 text-white/80 sm:text-[15px]">
              A simple, guided check-in — find the right record, register today&apos;s visit, and give every patient a clear next step.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {selectedFacility && (
              <div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2.5">
                <Building2 className="size-4 shrink-0 text-white/80" aria-hidden />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-white/65">Selected clinic</p>
                  <p className="max-w-48 truncate text-[13px] font-semibold">{selectedFacility.name}</p>
                </div>
              </div>
            )}
            <Link
              to="/app/patients"
              state={{ fromReception: true }}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/25 px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-white/10"
            >
              <ArrowLeft className="size-4" aria-hidden />
              Patient roster
            </Link>
          </div>
        </div>
      </header>

      <section aria-label="Reception progress" className="rounded-2xl border border-border-subtle bg-surface-raised p-3 shadow-card sm:p-4">
        <div className="mb-3 flex items-center justify-between px-1">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-text-secondary">Check-in progress</p>
          <p className="text-[12px] font-medium text-text-secondary">Step {stepNumber(step)} of {STEPS.length}</p>
        </div>
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {STEPS.map((item, index) => {
            const current = step === item.id;
            const complete = index < stepNumber(step) - 1 || (step === "visit" && !!visitResult);
            return (
              <li
                key={item.id}
                aria-current={current ? "step" : undefined}
                className={`flex min-h-12 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-[13px] transition-colors ${
                  current ? "border-brand-400 bg-brand-50 text-brand-700 shadow-sm" : complete ? "border-success-200 bg-success-50/70 text-success-700" : "border-border-subtle bg-surface text-text-secondary"
                }`}
              >
                <span className={`flex size-7 shrink-0 items-center justify-center rounded-full ${
                  current ? "bg-brand-600 text-white" : complete ? "bg-success-500 text-white" : "bg-surface-sunken text-text-secondary"
                }`}>
                  {complete ? <CheckCircle2 className="size-4" aria-hidden /> : <span className="font-mono text-[12px]">{index + 1}</span>}
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold">{item.label}</span>
                  <span className="mt-0.5 block text-[11px] opacity-75">{current ? "In progress" : complete ? "Complete" : "Up next"}</span>
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="flex">
        {previousStep(step) ? (
          <Button
            variant="secondary"
            icon={<ArrowLeft className="size-4" aria-hidden />}
            onClick={() => setStep(previousStep(step)!)}
          >
            Back to {STEPS[stepNumber(step) - 2].label.toLowerCase()}
          </Button>
        ) : (
          <Button
            variant="secondary"
            icon={<ArrowLeft className="size-4" aria-hidden />}
            onClick={() => navigate("/app")}
          >
            Back to dashboard
          </Button>
        )}
      </div>

      {step === "clinic" && (
        <Card className="space-y-5 p-5 sm:p-7">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Building2 className="size-5" aria-hidden />
            </span>
            <div>
              <h2 className="text-[17px] font-semibold text-text-primary">Confirm the clinic</h2>
              <p className="mt-1 text-[13px] leading-5 text-text-secondary">Choose where this patient is being seen today. Their visit and queue token will be linked to this clinic.</p>
            </div>
          </div>
          {facilitiesQuery.isError ? (
            <p role="alert" className="text-[13px] text-danger-600">
              {errorMessage(facilitiesQuery.error, "Couldn't load clinics. Try again.")}{" "}
              <button type="button" className="font-semibold underline" onClick={() => void facilitiesQuery.refetch()}>
                Retry
              </button>
            </p>
          ) : (
            <>
              <Select
                label="Clinic"
                required
                options={facilities.map((facility) => ({ value: facility.id, label: facility.name }))}
                value={facilityId}
                onChange={(event) => setFacilityId(event.target.value)}
                disabled={facilitiesQuery.isPending || facilities.length === 0}
                placeholder={facilitiesQuery.isPending ? "Loading clinics…" : "Select clinic"}
              />
              {facilities.length === 0 && !facilitiesQuery.isPending && (
                <p role="alert" className="text-[13px] text-danger-600">No clinic is available to this account.</p>
              )}
              <Button disabled={!facilityId || facilities.length === 0} onClick={() => setStep("arrival")}>
                Confirm clinic
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            </>
          )}
        </Card>
      )}

      {step === "arrival" && (
        <Card className="space-y-5 p-5 sm:p-7">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <CheckCircle2 className="size-5" aria-hidden />
            </span>
            <div>
              <h2 className="text-[17px] font-semibold text-text-primary">Welcome the patient</h2>
              <p className="mt-1 text-[13px] leading-5 text-text-secondary">
                Confirm the patient has arrived at <span className="font-semibold text-text-primary">{selectedFacility?.name ?? "the selected clinic"}</span> before searching or registering.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 border-t border-border-subtle pt-4">
            <Button onClick={() => setStep("identify")}>
              Patient is at reception
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          </div>
        </Card>
      )}

      {step === "identify" && (
        <Card className="space-y-5 p-5 sm:p-7">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Search className="size-5" aria-hidden />
            </span>
            <div>
              <h2 className="text-[17px] font-semibold text-text-primary">Find the patient</h2>
              <p className="mt-1 text-[13px] leading-5 text-text-secondary">
                Search by name, MPI, or ID number. Patients without identity documents can still be found by name.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-brand-200 bg-brand-50/60 p-4 sm:p-5">
            <Input
              label="Search patient records"
              placeholder="Try a name, MPI, or ID number"
              icon={<Search className="size-4" aria-hidden />}
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              autoFocus
            />
            <p className="mt-2 flex items-center gap-1.5 text-[12px] text-text-secondary">
              <ShieldCheck className="size-3.5 text-brand-600" aria-hidden />
              Search existing records first to help prevent duplicate patient profiles.
            </p>
          </div>

          {searchTerm.length > 0 && searchTerm.length < 2 && (
            <p className="text-[13px] text-text-secondary">Enter at least 2 characters to search.</p>
          )}
          {patientSearchQuery.isError && (
            <p role="alert" className="text-[13px] text-danger-600">
              {errorMessage(patientSearchQuery.error, "Couldn't search patient records. Try again.")}{" "}
              <button type="button" className="font-semibold underline" onClick={() => void patientSearchQuery.refetch()}>
                Retry
              </button>
            </p>
          )}
          {patientSearchQuery.isFetching && <p role="status" className="text-[13px] text-text-secondary">Searching records…</p>}

          {patientSearchQuery.data && patientSearchQuery.data.length > 0 && (
            <ul aria-label="Matching patients" className="divide-y divide-border-subtle overflow-hidden rounded-2xl border border-border-subtle">
              {patientSearchQuery.data.map((patient) => (
                <li key={patient.id} className="flex flex-wrap items-center justify-between gap-3 p-4 transition-colors hover:bg-surface">
                  <div>
                    <p className="text-[14px] font-medium text-text-primary">{patient.firstName} {patient.lastName}</p>
                    <p className="mt-0.5 text-[12.5px] text-text-secondary">
                      MPI {patient.mpiNumber} · {patient.idNumber ? `ID ${patient.idNumber}` : "No ID number"} · DOB {patient.dateOfBirth}
                    </p>
                    {patient.archived && <p className="mt-1 text-[12px] text-amber-700">Archived record — open it to review; do not register a duplicate.</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <Link to={`/app/patients/${patient.id}`} className="text-[12.5px] font-medium text-brand-600 hover:underline">
                      Open record
                    </Link>
                    <Button size="md" variant="secondary" disabled={patient.archived} onClick={() => choosePatient(patient)}>
                      Use this record
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {patientSearchQuery.data && patientSearchQuery.data.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={openRegistration}>
                None of these match — register new patient
              </Button>
              <Button variant="ghost" onClick={issueWalkInToken} loading={walkInMutation.isPending}>
                <Ticket className="size-4" aria-hidden />
                Issue walk-in token
              </Button>
            </div>
          )}

          {patientSearchQuery.data?.length === 0 && searchTerm.length >= 2 && !patientSearchQuery.isFetching && (
            <div className="rounded-2xl border border-border-subtle bg-surface p-5">
              <span className="mb-3 flex size-9 items-center justify-center rounded-full bg-surface-sunken text-text-secondary">
                <Search className="size-4" aria-hidden />
              </span>
              <p className="text-[14px] font-semibold text-text-primary">No matching record found</p>
              <p className="mt-1 text-[13px] text-text-secondary">
                Check the spelling or search for an MPI/ID number before creating a new record.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="secondary" onClick={openRegistration}>
                  <UserPlus className="size-4" aria-hidden />
                  Register new patient
                </Button>
                <Button variant="ghost" onClick={issueWalkInToken} loading={walkInMutation.isPending}>
                  <Ticket className="size-4" aria-hidden />
                  Issue walk-in token
                </Button>
              </div>
              <p className="mt-3 text-[12px] leading-5 text-text-secondary">
                A walk-in check-in records the visit type and care stream without creating a patient record. Register the patient before starting vitals or a consultation.
              </p>
            </div>
          )}

          {!searchTerm && <p className="text-[13px] text-text-secondary">Search first to check for an existing patient record.</p>}
        </Card>
      )}

      {step === "visit" && (
        <div className="space-y-4">
          {returnedPatientError && (
            <div role="alert" className="rounded-lg border border-danger-500/30 bg-danger-50 p-3 text-[13px] text-danger-600">
              <p>{returnedPatientError}</p>
              <Button className="mt-2" size="md" variant="secondary" onClick={() => setStep("identify")}>
                Return to patient search
              </Button>
            </div>
          )}
          {registrationReturnQuery.isPending && returnState?.registeredPatientId && (
            <p role="status" className="text-[13px] text-text-secondary">Loading the newly registered patient…</p>
          )}
          {(selectedPatient || walkInCheckIn) && (
            <>
              <Card className="space-y-5 p-5 sm:p-7">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    {walkInCheckIn ? <Ticket className="size-5" aria-hidden /> : <ClipboardList className="size-5" aria-hidden />}
                  </span>
                  <div>
                    <h2 className="text-[17px] font-semibold text-text-primary">
                      {walkInCheckIn ? "Issue a walk-in token" : "Register today's visit"}
                    </h2>
                    <p className="mt-1 text-[13px] leading-5 text-text-secondary">
                      {walkInCheckIn
                        ? "Choose the visit type and care stream for this check-in. It will not create or link a patient record."
                        : "The visit and queue token are created together and linked to this patient."}
                    </p>
                  </div>
                </div>

                {selectedPatient && <PatientSummary patient={selectedPatient} />}

                {visitResult ? (
                  <div className="space-y-4">
                    <div className="overflow-hidden rounded-2xl border border-success-200 bg-success-50">
                      <div className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
                        <div>
                          <p className="flex items-center gap-2 text-[14px] font-semibold text-success-700">
                            <CheckCircle2 className="size-4" aria-hidden />
                            {walkInCheckIn ? "Walk-in token issued" : "Visit registered successfully"}
                          </p>
                          <p className="mt-1 text-[13px] text-text-secondary">
                            {selectedFacility?.name ?? "Clinic"} · {visitResult.token.priority === "PRIORITY" ? "Priority" : "Normal"} queue
                          </p>
                        </div>
                        <div className="rounded-xl border border-success-200 bg-surface-raised px-4 py-2 text-center shadow-sm">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Queue token</p>
                          <p className="font-mono text-2xl font-bold tracking-tight text-success-700">
                            {SERVICE_STREAM_DETAILS[serviceStream].code}-#{visitResult.token.tokenNumber}
                          </p>
                        </div>
                      </div>
                      {priorityMutation.isPending && (
                        <p role="status" className="mt-2 text-[12.5px] text-text-secondary">Applying priority to the token…</p>
                      )}
                    </div>

                    {priorityError && (
                      <div role="alert" className="rounded-lg border border-danger-500/30 bg-danger-50 p-3 text-[13px] text-danger-600">
                        <p>{priorityError}</p>
                        <Button
                          className="mt-2"
                          size="md"
                          variant="secondary"
                          loading={priorityMutation.isPending}
                          onClick={() => {
                            if (!priorityReason) return;
                            priorityMutation.mutate({
                              tokenId: visitResult.token.id,
                              reasonCode: priorityReason,
                              reasonNote: priorityReason === "OTHER" ? priorityNote.trim() : undefined,
                            });
                          }}
                        >
                          Retry priority update
                        </Button>
                      </div>
                    )}

                    {callError && (
                      <p role="alert" className="rounded-lg border border-danger-500/30 bg-danger-50 p-3 text-[13px] text-danger-600">
                        {callError}
                      </p>
                    )}

                    {walkInCheckIn && (
                      <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-4">
                        <p className="text-[13.5px] font-semibold text-text-primary">Link this check-in to a patient record</p>
                        <p className="mt-1 text-[12.5px] leading-5 text-text-secondary">
                          Share this link with the patient. After they verify their email, their patient record and MPI will be connected to this check-in.
                        </p>
                        {registrationLink ? (
                          <div className="mt-3">
                            <Link to={registrationLink} className="text-[13px] font-medium text-brand-700 hover:underline">
                              Open patient registration
                            </Link>
                          </div>
                        ) : null}
                      </div>
                    )}

                    <div>
                      {walkInCheckIn ? (
                        <p className="text-[13px] leading-5 text-text-secondary">
                          This check-in includes the selected visit type and care stream. Register the patient before starting vitals or a consultation.
                        </p>
                      ) : (
                        <>
                          <h3 className="text-[14px] font-semibold text-text-primary">5. Direct the patient</h3>
                          <p className="mt-1 text-[13px] text-text-secondary">
                            Continue to the visit record for vitals or consultation. Medication collection is appropriate after a prescription is issued.
                          </p>
                        </>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        icon={<Printer className="size-4" aria-hidden />}
                        onClick={() => printQueueTicket(visitResult.token.id, serviceStream)}
                      >
                        Print token
                      </Button>
                      <Button
                        variant="secondary"
                        icon={<PhoneCall className="size-4" aria-hidden />}
                        loading={callMutation.isPending}
                        disabled={visitResult.token.status === "CALLED"}
                        onClick={() => callMutation.mutate(visitResult.token.id)}
                      >
                        {visitResult.token.status === "CALLED" ? "Patient called" : "Call patient"}
                      </Button>
                      {selectedPatient && (
                        <>
                          <Link
                            to={`/app/patients/${selectedPatient.id}?visitId=${visitResult.visit.id}&tab=vitals`}
                            className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand-500 px-4 text-[14px] font-semibold text-white hover:bg-brand-600"
                          >
                            <HeartPulse className="size-4" aria-hidden />
                            Open vitals
                          </Link>
                          <Link
                            to={`/app/patients/${selectedPatient.id}?visitId=${visitResult.visit.id}&tab=consultation`}
                            className="inline-flex h-11 items-center gap-2 rounded-lg border border-border-strong bg-surface-raised px-4 text-[14px] font-semibold text-text-primary hover:bg-surface-sunken"
                          >
                            <ClipboardList className="size-4" aria-hidden />
                            Open consultation
                          </Link>
                          <Link
                            to="/app/pharmacy/dispensing"
                            className="inline-flex h-11 items-center gap-2 rounded-lg border border-border-strong bg-surface-raised px-4 text-[14px] font-semibold text-text-primary hover:bg-surface-sunken"
                          >
                            Medication collection queue
                          </Link>
                        </>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 border-t border-border-subtle pt-4">
                      <Button variant="ghost" onClick={startNextCheckIn}>Start next check-in</Button>
                      <Link to="/app/queue" className="inline-flex h-11 items-center px-3 text-[13px] font-medium text-brand-600 hover:underline">
                        View queue
                      </Link>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Select
                        label="Visit type"
                        required
                        options={VISIT_TYPE_OPTIONS}
                        value={visitType}
                        onChange={(event) => setVisitType(event.target.value as VisitType)}
                      />
                      <Select
                        label="Care stream"
                        required
                        options={SERVICE_STREAM_OPTIONS}
                        value={serviceStream}
                        onChange={(event) => setServiceStream(event.target.value as ServiceStream)}
                      />
                    </div>
                    <Select
                      label="Queue priority"
                      required
                      options={[
                        { value: "NORMAL", label: "Normal" },
                        { value: "PRIORITY", label: "Priority" },
                      ]}
                      value={priority}
                      onChange={(event) => {
                        setPriority(event.target.value as TokenPriority);
                        setFormError(null);
                      }}
                    />
                    {priority === "PRIORITY" && (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Select
                          label="Reason for priority"
                          required
                          options={PRIORITY_REASON_OPTIONS}
                          value={priorityReason}
                          onChange={(event) => setPriorityReason(event.target.value as QueueActionReason)}
                        />
                        {priorityReason === "OTHER" && (
                          <Input
                            label="Priority explanation"
                            required
                            value={priorityNote}
                            onChange={(event) => setPriorityNote(event.target.value)}
                            placeholder="Briefly explain"
                            maxLength={300}
                          />
                        )}
                      </div>
                    )}
                    {formError && (
                      <p role="alert" className="rounded-lg border border-danger-500/30 bg-danger-50 p-3 text-[13px] text-danger-600">
                        {formError}
                      </p>
                    )}
                    {(walkInMutation.isPending || createVisitMutation.isPending) && (
                      <p role="status" className="text-[13px] text-text-secondary">
                        {walkInCheckIn ? "Issuing the walk-in token…" : "Registering the visit…"}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        loading={walkInCheckIn ? walkInMutation.isPending : createVisitMutation.isPending}
                        onClick={startVisit}
                        icon={<ArrowRight className="size-4" aria-hidden />}
                      >
                        {walkInCheckIn ? "Issue walk-in token" : "Register visit and issue token"}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setWalkInCheckIn(false);
                          setFormError(null);
                          setStep("identify");
                        }}
                      >
                        {walkInCheckIn ? "Back to patient search" : "Choose another patient"}
                      </Button>
                    </div>
                  </>
                )}
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  );
}
