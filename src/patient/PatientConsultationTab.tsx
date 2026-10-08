import { StartConsultationPanel } from "./StartConsultationPanel";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { ChevronDown, ClipboardCheck, FlaskConical, Pill, Plus, Stethoscope, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { Input } from "@/shared/components/Input";
import { Select } from "@/shared/components/Select";
import { StatusPill } from "@/shared/components/StatusPill";
import { ApiError } from "@/shared/api/client";
import { getLatestTriage } from "@/shared/api/triage";
import { getFacilities } from "@/shared/api/facilities";
import {
  addConsultationDiagnosis,
  amendConsultation,
  createConsultationDraft,
  getConsultationHistory,
  getCurrentConsultation,
  markConsultationEnteredInError,
  removeConsultationDiagnosis,
  signConsultation,
  updateConsultationDraft,
  type AllergyStatus,
  type Consultation,
  type ConsultationDiagnosis,
  type ConsultationOutcome,
  type DiagnosisCertainty,
  type PharmacyItemPayload,
  type PurchaseItemPayload,
  type VitalsBypass,
} from "@/shared/api/consultations";
import { DiagnosisSearchInput, type DiagnosisChoice } from "./DiagnosisSearchInput";
import { PrescriptionWorkspace } from "@/prescribing/PrescriptionWorkspace";
import {
  EMPTY_PRESCRIPTION,
  parse as parsePrescription,
  problemsOf,
  serialise as serialisePrescription,
  toPayload,
  type PrescriptionState,
} from "@/prescribing/entries";

const CERTAINTY_OPTIONS: { value: DiagnosisCertainty; label: string }[] = [
  { value: "PROVISIONAL", label: "Provisional" },
  { value: "CONFIRMED", label: "Confirmed" },
];

// What "send to pharmacy" carries: medicines the pharmacy hands over, and ones the patient buys.
interface PrescribedMedicines {
  pharmacyItems: PharmacyItemPayload[];
  purchaseItems: PurchaseItemPayload[];
}

const OUTCOME_CHOICES: { value: ConsultationOutcome; label: string; description: string; icon: typeof Pill }[] = [
  {
    value: "SEND_TO_PHARMACY",
    label: "Send to pharmacy",
    description: "Release signed prescription(s); create pharmacy work.",
    icon: Pill,
  },
  {
    value: "CONTINUE_INVESTIGATION",
    label: "Continue investigation",
    description: "Keep the visit open and note the next task.",
    icon: FlaskConical,
  },
  {
    value: "FINISH_NO_MEDICATION",
    label: "Finish without medication",
    description: "Move to completion review if nothing else is pending.",
    icon: ClipboardCheck,
  },
  {
    value: "REFER_OR_TRANSFER",
    label: "Refer / transfer",
    description: "Move this visit to another facility you choose.",
    icon: TriangleAlert,
  },
];

function outcomeLabel(outcome: ConsultationOutcome | null): string {
  return OUTCOME_CHOICES.find((o) => o.value === outcome)?.label ?? "—";
}

export function PatientConsultationTab({ visitId, onTakeVitals }: { visitId: string | null; onTakeVitals?: () => void }) {
  const queryClient = useQueryClient();

  const currentQuery = useQuery({
    queryKey: ["consultation-current", visitId],
    queryFn: () => getCurrentConsultation(visitId as string),
    enabled: !!visitId,
  });
  const historyQuery = useQuery({
    queryKey: ["consultation-history", visitId],
    queryFn: () => getConsultationHistory(visitId as string),
    enabled: !!visitId,
  });
  const triageQuery = useQuery({
    queryKey: ["triage-latest", visitId],
    queryFn: () => getLatestTriage(visitId as string),
    enabled: !!visitId,
  });

  const [startError, setStartError] = useState<string | null>(null);
  const startConsultation = useMutation({
    mutationFn: (bypass?: VitalsBypass) => createConsultationDraft(visitId as string, bypass),
    onSuccess: () => {
      setStartError(null);
      queryClient.invalidateQueries({ queryKey: ["consultation-current", visitId] });
      queryClient.invalidateQueries({ queryKey: ["consultation-history", visitId] });
    },
    onError: (error) => {
      setStartError(error instanceof ApiError ? error.message : "Couldn't start a consultation. Try again.");
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["consultation-current", visitId] });
    queryClient.invalidateQueries({ queryKey: ["consultation-history", visitId] });
  };

  if (!visitId) {
    return (
      <Card className="mb-6 p-6">
        <h2 className="mb-3 text-[14.5px] font-semibold text-text-primary">Consultation</h2>
        <div className="rounded-lg border border-border-default bg-surface-sunken p-4">
          <p className="text-[13.5px] text-text-secondary">
            Start a visit from the Overview tab before beginning a consultation.
          </p>
        </div>
      </Card>
    );
  }

  const current = currentQuery.data ?? null;
  const history = (historyQuery.data ?? []).filter((c) => c.id !== current?.id);

  return (
    <Card className="mb-6 p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Stethoscope className="size-4 text-text-secondary" aria-hidden />
          <h2 className="text-[14.5px] font-semibold text-text-primary">Consultation</h2>
        </div>
        {current?.status === "SIGNED" && <StatusPill tone="success">Signed</StatusPill>}
        {current?.status === "DRAFT" && <StatusPill tone="warning">Draft</StatusPill>}
      </div>

      {currentQuery.isLoading ? (
        <p className="text-[13.5px] text-text-secondary">Loading…</p>
      ) : !current ? (
        <StartConsultationPanel
          vitalsMissing={triageQuery.isSuccess && triageQuery.data === null}
          loading={startConsultation.isPending}
          error={startError}
          onStart={(bypass) => startConsultation.mutate(bypass)}
          onTakeVitals={onTakeVitals}
        />
      ) : (
        <>
          {current.vitalsBypassReason && <VitalsSkippedNote consultation={current} />}
          <ConsultationRecord
            key={current.id}
            consultation={current}
            presentingComplaint={triageQuery.data?.presentingComplaint ?? null}
            onChanged={invalidate}
          />
        </>
      )}

      {history.length > 0 && <ConsultationHistorySection entries={history} />}
    </Card>
  );
}

function ConsultationRecord({
  consultation,
  presentingComplaint,
  onChanged,
}: {
  consultation: Consultation;
  presentingComplaint: string | null;
  onChanged: () => void;
}) {
  if (consultation.status === "DRAFT") {
    return <DraftView consultation={consultation} presentingComplaint={presentingComplaint} onChanged={onChanged} />;
  }
  return <SignedView consultation={consultation} presentingComplaint={presentingComplaint} onChanged={onChanged} />;
}

const BYPASS_LABELS: Record<NonNullable<Consultation["vitalsBypassReason"]>, string> = {
  EMERGENCY: "Emergency",
  FOLLOW_UP_NO_CHANGE: "Follow-up, nothing has changed",
  OTHER: "Another reason",
};

// Stays on the record even if vitals are taken later: it says the consultation began without them.
function VitalsSkippedNote({ consultation }: { consultation: Consultation }) {
  if (!consultation.vitalsBypassReason) return null;
  return (
    <div role="note" className="mb-4 rounded-lg border border-amber-500/40 bg-amber-50 px-3.5 py-2.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-amber-600">Started without vitals</p>
      <p className="mt-0.5 text-[13.5px] text-text-primary">
        {BYPASS_LABELS[consultation.vitalsBypassReason]}
        {consultation.vitalsBypassNote ? `: ${consultation.vitalsBypassNote}` : ""}
      </p>
    </div>
  );
}

function PresentingComplaint({ value }: { value: string | null }) {
  if (!value) return null;
  return (
    <div className="mb-4 rounded-lg border border-border-subtle bg-surface-sunken/40 px-3.5 py-2.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-text-secondary">Presenting complaint</p>
      <p className="mt-0.5 text-[13.5px] text-text-primary">{value}</p>
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-text-primary">{label}</span>
      {disabled ? (
        <p className="min-h-[44px] rounded-lg border border-border-subtle bg-surface-sunken/40 px-3 py-2 text-[13.5px] text-text-primary">
          {value || <span className="text-text-secondary">Not recorded.</span>}
        </p>
      ) : (
        <textarea
          className="min-h-[70px] rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-[13.5px] text-text-primary outline-none focus:border-brand-500"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange?.(e.target.value)}
        />
      )}
    </label>
  );
}

const ALLERGY_OPTIONS: { value: AllergyStatus; label: string }[] = [
  { value: "UNKNOWN", label: "Unknown" },
  { value: "NONE_KNOWN", label: "No known allergies" },
  { value: "KNOWN", label: "Known allergies" },
];

function AllergyStatusPicker({
  value,
  detail,
  onChangeStatus,
  onChangeDetail,
  disabled,
}: {
  value: AllergyStatus;
  detail: string;
  onChangeStatus?: (value: AllergyStatus) => void;
  onChangeDetail?: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-text-primary">Allergies</span>
      <div className="flex flex-wrap gap-2">
        {ALLERGY_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            onClick={() => onChangeStatus?.(option.value)}
            className={clsx(
              "rounded-lg border px-3 py-2 text-[13px] font-medium transition-colors duration-150 disabled:cursor-default",
              value === option.value
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : "border-border-strong bg-surface-raised text-text-secondary hover:text-text-primary",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      {value === "UNKNOWN" && (
        <p className="text-[12px] text-text-secondary">
          Distinct from "No known allergies" — this patient hasn't been asked yet.
        </p>
      )}
      {value === "KNOWN" && (
        <TextAreaField label="Allergy detail" value={detail} onChange={onChangeDetail} disabled={disabled} />
      )}
    </div>
  );
}

function EnteredInErrorAction({ consultationId, onChanged }: { consultationId: string; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => markConsultationEnteredInError(consultationId, reason.trim()),
    onSuccess: () => {
      setOpen(false);
      setReason("");
      onChanged();
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Couldn't mark this entered-in-error. Try again.");
    },
  });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[12.5px] font-medium text-text-secondary hover:text-danger-600"
      >
        Mark entered in error
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-danger-500/25 bg-danger-50 p-3">
      {error && (
        <p role="alert" className="mb-2 text-[13px] text-danger-600">
          {error}
        </p>
      )}
      <Input
        label="Reason"
        placeholder="e.g. Recorded against the wrong patient"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <div className="mt-3 flex gap-2">
        <Button
          size="md"
          className="bg-danger-600 hover:bg-danger-700"
          loading={mutation.isPending}
          disabled={!reason.trim()}
          onClick={() => mutation.mutate()}
        >
          Confirm
        </Button>
        <Button variant="secondary" size="md" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function OutcomePicker({
  outcomeNotes,
  onChangeNotes,
  onChoose,
  loading,
  onCancel,
  prescription,
}: {
  outcomeNotes: string;
  onChangeNotes: (v: string) => void;
  onChoose: (outcome: ConsultationOutcome, medicines?: PrescribedMedicines, destinationFacilityId?: string) => void;
  loading: boolean;
  onCancel: () => void;
  /** The prescription written in the Prescription section above; it travels with "Send to pharmacy". */
  prescription: PrescriptionState;
}) {
  // Send to pharmacy needs a real prescription — that is what shows up in the pharmacy's dispensing
  // queue; the queue-token transfer alone moves the patient's ticket but leaves nothing to dispense.
  const prescribed = prescription.prescribe && prescription.entries.length > 0;
  const prescriptionProblems = problemsOf(prescription);
  const pharmacyReady = prescribed && prescriptionProblems.length === 0;
  const pharmacyHint = !prescription.prescribe
    ? "Switch on Prescribe above and add the medicines first."
    : prescription.entries.length === 0
      ? "Add at least one medicine in the Prescription section above."
      : prescriptionProblems[0] ?? null;

  // Refer/transfer is the other outcome that needs more than a click — a
  // real destination facility, picked from whatever this org has actually
  // set up (Facility management), not hardcoded to pharmacy the way
  // SEND_TO_PHARMACY is. The facility list only loads once this section
  // expands — no reason to fetch it for every consultation sign-off.
  const [expandTransfer, setExpandTransfer] = useState(false);
  const [destinationFacilityId, setDestinationFacilityId] = useState("");
  const facilitiesQuery = useQuery({
    queryKey: ["facilities"],
    queryFn: getFacilities,
    enabled: expandTransfer,
  });
  const facilityOptions = (facilitiesQuery.data ?? []).map((f) => ({ value: f.id, label: f.name }));

  return (
    <div className="rounded-xl border border-brand-500 bg-brand-50 p-4">
      <p className="mb-3 text-[13.5px] font-semibold text-text-primary">Choose next step</p>
      <TextAreaField label="Notes for this outcome (optional)" value={outcomeNotes} onChange={onChangeNotes} />
      {prescribed && (
        <p role="note" className="mt-3 rounded-lg bg-surface-raised px-3.5 py-2.5 text-[12.5px] text-text-secondary">
          You wrote a prescription. It is only sent when you choose <strong>Send to pharmacy</strong>.
        </p>
      )}
      <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {OUTCOME_CHOICES.map((choice) => {
          const Icon = choice.icon;
          const isPharmacy = choice.value === "SEND_TO_PHARMACY";
          const isTransfer = choice.value === "REFER_OR_TRANSFER";
          return (
            <div
              key={choice.value}
              className={clsx(
                "flex flex-col gap-2 rounded-lg border border-border-subtle bg-surface-raised p-3.5",
                isTransfer && expandTransfer && "sm:col-span-2",
              )}
            >
              <div className="flex items-center gap-2 text-brand-600">
                <Icon className="size-4" aria-hidden />
                <span className="text-[13px] font-semibold text-text-primary">{choice.label}</span>
              </div>
              <p className="flex-1 text-[12px] text-text-secondary">{choice.description}</p>

              {isTransfer && expandTransfer ? (
                <div className="flex flex-col gap-2">
                  <Select
                    label="Destination facility"
                    required
                    options={facilityOptions}
                    value={destinationFacilityId}
                    onChange={(e) => setDestinationFacilityId(e.target.value)}
                    disabled={facilitiesQuery.isLoading}
                    hint={facilitiesQuery.isLoading ? "Loading facilities…" : undefined}
                  />
                  <div className="mt-1 flex gap-2">
                    <Button
                      size="md"
                      loading={loading}
                      disabled={!destinationFacilityId}
                      onClick={() => onChoose("REFER_OR_TRANSFER", undefined, destinationFacilityId)}
                    >
                      Confirm & transfer
                    </Button>
                    <Button variant="secondary" size="md" onClick={() => setExpandTransfer(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <Button
                    variant={isPharmacy ? "primary" : "secondary"}
                    size="md"
                    loading={loading}
                    disabled={isPharmacy && !pharmacyReady}
                    onClick={() => {
                      if (isPharmacy) onChoose("SEND_TO_PHARMACY", toPayload(prescription));
                      else if (isTransfer) setExpandTransfer(true);
                      else onChoose(choice.value);
                    }}
                  >
                    {choice.label}
                  </Button>
                  {isPharmacy && !pharmacyReady && pharmacyHint && <p className="text-[12px] text-text-secondary">{pharmacyHint}</p>}
                </>
              )}
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="mt-3 text-[12.5px] font-medium text-text-secondary hover:text-text-primary"
      >
        Back to editing
      </button>
    </div>
  );
}

// How long after the last change the draft is saved by itself.
const AUTOSAVE_DELAY_MS = 1500;

/** One line about a recorded allergy for the prescribing area, or null when none is recorded. */
function allergyNoteOf(fields: { allergyStatus: AllergyStatus; allergyDetail: string }): string | null {
  if (fields.allergyStatus !== "KNOWN") return null;
  return fields.allergyDetail.trim() ? `Allergy recorded: ${fields.allergyDetail.trim()}.` : "An allergy is recorded.";
}

interface ConsultationFieldsState {
  relevantHistory: string;
  currentMedications: string;
  allergyStatus: AllergyStatus;
  allergyDetail: string;
  examinationNotes: string;
  investigationsNotes: string;
  treatmentPlan: string;
}

function toFieldsState(consultation: Consultation): ConsultationFieldsState {
  return {
    relevantHistory: consultation.relevantHistory ?? "",
    currentMedications: consultation.currentMedications ?? "",
    allergyStatus: consultation.allergyStatus,
    allergyDetail: consultation.allergyDetail ?? "",
    examinationNotes: consultation.examinationNotes ?? "",
    investigationsNotes: consultation.investigationsNotes ?? "",
    treatmentPlan: consultation.treatmentPlan ?? "",
  };
}

function DraftView({
  consultation,
  presentingComplaint,
  onChanged,
}: {
  consultation: Consultation;
  presentingComplaint: string | null;
  onChanged: () => void;
}) {
  const navigate = useNavigate();
  const [fields, setFields] = useState<ConsultationFieldsState>(() => toFieldsState(consultation));
  const [prescription, setPrescription] = useState<PrescriptionState>(() => parsePrescription(consultation.prescriptionDraft));
  const [showOutcomePicker, setShowOutcomePicker] = useState(false);
  const [outcomeNotes, setOutcomeNotes] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const saveErrorRef = useRef<HTMLParagraphElement>(null);
  // Set by any edit, so autosave only runs after the doctor changed something.
  const unsaved = useRef(false);

  // The error banner renders at the top of a long form, but a sign failure
  // (e.g. "no pharmacy facility configured yet") happens while the doctor
  // is looking at the outcome picker at the bottom — without this, nothing
  // visibly happens and it looks like the button just didn't work.
  useEffect(() => {
    if (saveError) saveErrorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [saveError]);

  const set = <K extends keyof ConsultationFieldsState>(key: K, value: ConsultationFieldsState[K]) => {
    setFields((f) => ({ ...f, [key]: value }));
    unsaved.current = true;
  };

  const changePrescription = (next: PrescriptionState) => {
    setPrescription(next);
    unsaved.current = true;
  };

  // Everything the doctor has written, notes and prescription together, so one save keeps it all.
  const draftPayload = () => ({
    relevantHistory: fields.relevantHistory || undefined,
    currentMedications: fields.currentMedications || undefined,
    allergyStatus: fields.allergyStatus,
    allergyDetail: fields.allergyStatus === "KNOWN" ? fields.allergyDetail || undefined : undefined,
    examinationNotes: fields.examinationNotes || undefined,
    investigationsNotes: fields.investigationsNotes || undefined,
    treatmentPlan: fields.treatmentPlan || undefined,
    prescriptionDraft: serialisePrescription(prescription),
  });

  const saveDraft = useMutation({
    mutationFn: () => updateConsultationDraft(consultation.id, draftPayload()),
    onSuccess: () => {
      unsaved.current = false;
      setSaveError(null);
      setSavedAt(new Date());
    },
    onError: (error) => {
      setSaveError(error instanceof ApiError ? error.message : "Couldn't save this draft. Try again.");
    },
  });

  // Autosave: a moment after the doctor stops typing, the draft is saved, so closing the record
  // never loses work.
  useEffect(() => {
    if (!unsaved.current) return;
    const timer = window.setTimeout(() => saveDraft.mutate(), AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields, prescription]);

  const sign = useMutation({
    // Signing must not silently drop whatever's currently in the form —
    // going straight from typing into these fields to "Sign & choose next
    // step" (without a separate "Save draft" click first) is the natural
    // path, and this backend's sign() only finalizes whatever is already
    // persisted. So sign here always saves the current fields (and any
    // diagnosis text typed but not yet explicitly added) immediately
    // before transitioning to SIGNED, rather than requiring an explicit
    // save step the UI never actually demanded.
    mutationFn: async ({
      outcome,
      medicines,
      destinationFacilityId,
    }: {
      outcome: ConsultationOutcome;
      medicines?: PrescribedMedicines;
      destinationFacilityId?: string;
    }) => {
      await updateConsultationDraft(consultation.id, draftPayload());
      if (newDiagnosisText.trim()) {
        await addConsultationDiagnosis(consultation.id, {
          diagnosisText: newDiagnosisText.trim(),
          isPrimary: newDiagnosisPrimary,
          certainty: newDiagnosisCertainty,
        });
      }
      return signConsultation(consultation.id, {
        outcome,
        outcomeNotes: outcomeNotes.trim() || undefined,
        pharmacyItems: medicines?.pharmacyItems,
        purchaseItems: medicines?.purchaseItems,
        destinationFacilityId,
      });
    },
    onSuccess: () => {
      setSaveError(null);
      onChanged();
    },
    onError: (error) => {
      setSaveError(error instanceof ApiError ? error.message : "Couldn't sign this consultation. Try again.");
    },
  });

  const [newDiagnosisText, setNewDiagnosisText] = useState("");
  const [newDiagnosisPrimary, setNewDiagnosisPrimary] = useState(consultation.diagnoses.length === 0);
  const [newDiagnosisCertainty, setNewDiagnosisCertainty] = useState<DiagnosisCertainty>("PROVISIONAL");

  const addDiagnosis = useMutation({
    mutationFn: (choice: DiagnosisChoice) =>
      addConsultationDiagnosis(consultation.id, {
        ...("diagnosisId" in choice ? { diagnosisId: choice.diagnosisId } : { diagnosisText: choice.diagnosisText }),
        isPrimary: newDiagnosisPrimary,
        certainty: newDiagnosisCertainty,
      }),
    onSuccess: () => {
      setNewDiagnosisText("");
      setNewDiagnosisPrimary(false);
      setNewDiagnosisCertainty("PROVISIONAL");
      onChanged();
    },
    onError: (error) => {
      setSaveError(error instanceof ApiError ? error.message : "Couldn't add that diagnosis. Try again.");
    },
  });

  const removeDiagnosis = useMutation({
    mutationFn: (diagnosisId: string) => removeConsultationDiagnosis(consultation.id, diagnosisId),
    onSuccess: onChanged,
    onError: (error) => {
      setSaveError(error instanceof ApiError ? error.message : "Couldn't remove that diagnosis. Try again.");
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <PresentingComplaint value={presentingComplaint} />

      {saveError && (
        <p ref={saveErrorRef} role="alert" className="text-[13.5px] text-danger-600">
          {saveError}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextAreaField
          label="History & current medicines"
          value={fields.relevantHistory}
          onChange={(v) => set("relevantHistory", v)}
        />
        <TextAreaField
          label="Current medications"
          value={fields.currentMedications}
          onChange={(v) => set("currentMedications", v)}
        />
      </div>

      <AllergyStatusPicker
        value={fields.allergyStatus}
        detail={fields.allergyDetail}
        onChangeStatus={(v) => set("allergyStatus", v)}
        onChangeDetail={(v) => set("allergyDetail", v)}
      />

      <TextAreaField
        label="Examination & clinical notes"
        value={fields.examinationNotes}
        onChange={(v) => set("examinationNotes", v)}
      />

      <div>
        <p className="mb-2 text-[13px] font-medium text-text-primary">Diagnoses</p>
        <div className="flex flex-col gap-2">
          {consultation.diagnoses.length === 0 ? (
            <p className="text-[13px] text-text-secondary">
              No diagnosis recorded yet — a symptom-based assessment is fine if nothing definitive is available.
            </p>
          ) : (
            consultation.diagnoses.map((d) => (
              <DiagnosisRow key={d.id} diagnosis={d} onRemove={() => removeDiagnosis.mutate(d.id)} />
            ))
          )}
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[2fr_auto_auto_auto] sm:items-end">
          <DiagnosisSearchInput
            label="Add diagnosis"
            placeholder="Search by name or ICD-10 code, e.g. bronchitis or J20"
            value={newDiagnosisText}
            onChangeText={setNewDiagnosisText}
            onChoose={(choice) => addDiagnosis.mutate(choice)}
          />
          <label className="flex items-center gap-1.5 pb-3 text-[12.5px] text-text-secondary">
            <input
              type="checkbox"
              checked={newDiagnosisPrimary}
              onChange={(e) => setNewDiagnosisPrimary(e.target.checked)}
            />
            Primary
          </label>
          <Select
            label="Certainty"
            options={CERTAINTY_OPTIONS}
            value={newDiagnosisCertainty}
            onChange={(e) => setNewDiagnosisCertainty(e.target.value as DiagnosisCertainty)}
          />
          <Button
            variant="secondary"
            size="md"
            icon={<Plus className="size-3.5" aria-hidden />}
            loading={addDiagnosis.isPending}
            disabled={!newDiagnosisText.trim()}
            onClick={() => addDiagnosis.mutate({ diagnosisText: newDiagnosisText.trim() })}
          >
            Add
          </Button>
        </div>
      </div>

      <TextAreaField
        label="Investigations"
        value={fields.investigationsNotes}
        onChange={(v) => set("investigationsNotes", v)}
      />
      <TextAreaField
        label="Treatment plan & patient instructions"
        value={fields.treatmentPlan}
        onChange={(v) => set("treatmentPlan", v)}
      />

      <PrescriptionWorkspace
        state={prescription}
        onChange={changePrescription}
        allergyNote={allergyNoteOf(fields)}
        patientLabel="Prescription for this visit"
      />

      {showOutcomePicker ? (
        <OutcomePicker
          prescription={prescription}
          outcomeNotes={outcomeNotes}
          onChangeNotes={setOutcomeNotes}
          loading={sign.isPending}
          onChoose={(outcome, medicines, destinationFacilityId) =>
            sign.mutate({ outcome, medicines, destinationFacilityId })
          }
          onCancel={() => setShowOutcomePicker(false)}
        />
      ) : (
        <div className="flex items-center gap-3">
          <Button size="md" onClick={() => setShowOutcomePicker(true)}>
            Sign & choose next step
          </Button>
          <Button variant="secondary" size="md" loading={saveDraft.isPending} onClick={() => saveDraft.mutate()}>
            Save draft
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={() => saveDraft.mutate(undefined, { onSuccess: () => navigate("/app/patients") })}
          >
            Close and continue later
          </Button>
          <span role="status" className="text-[12.5px] text-text-secondary">
            {saveDraft.isPending ? "Saving…" : savedAt ? `Draft saved at ${savedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}. It saves as you type.` : "It saves as you type."}
          </span>
          <div className="ml-auto">
            <EnteredInErrorAction consultationId={consultation.id} onChanged={onChanged} />
          </div>
        </div>
      )}
    </div>
  );
}

function DiagnosisRow({ diagnosis, onRemove }: { diagnosis: ConsultationDiagnosis; onRemove?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface-sunken/40 px-3.5 py-2.5">
      <span className="flex min-w-0 items-center gap-2 text-[13.5px] text-text-primary">
        {diagnosis.code && (
          <span className="shrink-0 rounded bg-brand-50 px-1.5 py-0.5 font-mono text-[11.5px] font-semibold text-brand-600">
            {diagnosis.code}
          </span>
        )}
        <span className="min-w-0">{diagnosis.diagnosisText}</span>
      </span>
      <div className="flex items-center gap-2">
        <span
          className={clsx(
            "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
            diagnosis.isPrimary ? "bg-brand-50 text-brand-600" : "bg-ink-100 text-ink-600",
          )}
        >
          {diagnosis.isPrimary ? "Primary" : "Secondary"}
        </span>
        <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-[11px] font-semibold text-ink-600">
          {diagnosis.certainty === "CONFIRMED" ? "Confirmed" : "Provisional"}
        </span>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove diagnosis"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary hover:bg-danger-50 hover:text-danger-600"
          >
            <Trash2 className="size-3.5" aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}

function SignedView({
  consultation,
  presentingComplaint,
  onChanged,
}: {
  consultation: Consultation;
  presentingComplaint: string | null;
  onChanged: () => void;
}) {
  const [amending, setAmending] = useState(false);

  if (amending) {
    return (
      <AmendForm consultation={consultation} onCancel={() => setAmending(false)} onChanged={onChanged} />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PresentingComplaint value={presentingComplaint} />

      <div className="rounded-lg border border-success-500/25 bg-success-50 px-3.5 py-3">
        <p className="text-[13.5px] font-medium text-success-700">
          Signed — {outcomeLabel(consultation.outcome)}
        </p>
        {consultation.outcomeNotes && <p className="mt-1 text-[13px] text-success-700">{consultation.outcomeNotes}</p>}
        <p className="mt-1.5 text-[12.5px] text-success-700/80">
          {consultation.authorName ?? "Unknown staff"}
          {consultation.signedByName && consultation.signedByName !== consultation.authorName
            ? ` · signed by ${consultation.signedByName}`
            : ""}
          {" · "}
          Started {new Date(consultation.createdAt).toLocaleString()}
          {consultation.signedAt && ` · Signed off ${new Date(consultation.signedAt).toLocaleString()}`}
        </p>
      </div>

      <TextAreaField label="History & current medicines" value={consultation.relevantHistory ?? ""} disabled />
      <TextAreaField label="Current medications" value={consultation.currentMedications ?? ""} disabled />
      <AllergyStatusPicker value={consultation.allergyStatus} detail={consultation.allergyDetail ?? ""} disabled />
      <TextAreaField label="Examination & clinical notes" value={consultation.examinationNotes ?? ""} disabled />

      <div>
        <p className="mb-2 text-[13px] font-medium text-text-primary">Diagnoses</p>
        <div className="flex flex-col gap-2">
          {consultation.diagnoses.length === 0 ? (
            <p className="text-[13px] text-text-secondary">No diagnosis was recorded.</p>
          ) : (
            consultation.diagnoses.map((d) => <DiagnosisRow key={d.id} diagnosis={d} />)
          )}
        </div>
      </div>

      <TextAreaField label="Investigations" value={consultation.investigationsNotes ?? ""} disabled />
      <TextAreaField label="Treatment plan & patient instructions" value={consultation.treatmentPlan ?? ""} disabled />

      <div className="flex items-center gap-3">
        <Button variant="secondary" size="md" onClick={() => setAmending(true)}>
          Amend
        </Button>
        <div className="ml-auto">
          <EnteredInErrorAction consultationId={consultation.id} onChanged={onChanged} />
        </div>
      </div>
    </div>
  );
}

function AmendForm({
  consultation,
  onCancel,
  onChanged,
}: {
  consultation: Consultation;
  onCancel: () => void;
  onChanged: () => void;
}) {
  const [fields, setFields] = useState<ConsultationFieldsState>(() => toFieldsState(consultation));
  const [diagnoses, setDiagnoses] = useState(
    () => consultation.diagnoses.map((d) => ({
      diagnosisText: d.diagnosisText,
      diagnosisId: d.diagnosisId ?? undefined,
      isPrimary: d.isPrimary,
      certainty: d.certainty,
    })),
  );
  const [amendmentReason, setAmendmentReason] = useState("");
  const [prescription, setPrescription] = useState<PrescriptionState>(EMPTY_PRESCRIPTION);
  const [showOutcomePicker, setShowOutcomePicker] = useState(false);
  const [outcomeNotes, setOutcomeNotes] = useState(consultation.outcomeNotes ?? "");
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  // Same reasoning as DraftConsultationForm's saveErrorRef — an amend
  // failure happens while the doctor is at the outcome picker, well below
  // where this error renders.
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [error]);

  const set = <K extends keyof ConsultationFieldsState>(key: K, value: ConsultationFieldsState[K]) => {
    setFields((f) => ({ ...f, [key]: value }));
  };

  const amend = useMutation({
    mutationFn: ({
      outcome,
      medicines,
      destinationFacilityId,
    }: {
      outcome: ConsultationOutcome;
      medicines?: PrescribedMedicines;
      destinationFacilityId?: string;
    }) =>
      amendConsultation(consultation.id, {
        relevantHistory: fields.relevantHistory || undefined,
        currentMedications: fields.currentMedications || undefined,
        allergyStatus: fields.allergyStatus,
        allergyDetail: fields.allergyStatus === "KNOWN" ? fields.allergyDetail || undefined : undefined,
        examinationNotes: fields.examinationNotes || undefined,
        investigationsNotes: fields.investigationsNotes || undefined,
        treatmentPlan: fields.treatmentPlan || undefined,
        diagnoses,
        outcome,
        outcomeNotes: outcomeNotes.trim() || undefined,
        amendmentReason: amendmentReason.trim(),
        pharmacyItems: medicines?.pharmacyItems,
        purchaseItems: medicines?.purchaseItems,
        destinationFacilityId,
      }),
    onSuccess: onChanged,
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Couldn't save this amendment. Try again.");
    },
  });

  const updateDiagnosis = (index: number, patch: Partial<(typeof diagnoses)[number]>) => {
    setDiagnoses((items) => items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-amber-500/25 bg-amber-50 px-3.5 py-3">
        <p className="text-[13.5px] font-medium text-amber-700">
          Amending a signed consultation creates a new, linked record — the original stays in history, unchanged.
        </p>
      </div>

      {error && (
        <p ref={errorRef} role="alert" className="text-[13.5px] text-danger-600">
          {error}
        </p>
      )}

      <Input
        label="Reason for amendment"
        required
        placeholder="e.g. Corrected diagnosis after lab result"
        value={amendmentReason}
        onChange={(e) => setAmendmentReason(e.target.value)}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextAreaField label="History & current medicines" value={fields.relevantHistory} onChange={(v) => set("relevantHistory", v)} />
        <TextAreaField label="Current medications" value={fields.currentMedications} onChange={(v) => set("currentMedications", v)} />
      </div>

      <AllergyStatusPicker
        value={fields.allergyStatus}
        detail={fields.allergyDetail}
        onChangeStatus={(v) => set("allergyStatus", v)}
        onChangeDetail={(v) => set("allergyDetail", v)}
      />

      <TextAreaField label="Examination & clinical notes" value={fields.examinationNotes} onChange={(v) => set("examinationNotes", v)} />

      <div>
        <p className="mb-2 text-[13px] font-medium text-text-primary">Diagnoses</p>
        <div className="flex flex-col gap-2">
          {diagnoses.map((d, index) => (
            <div key={index} className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_auto_auto_auto] sm:items-end">
              <DiagnosisSearchInput
                label="Diagnosis"
                placeholder="Search by name or ICD-10 code"
                value={d.diagnosisText}
                // Typing again means it is no longer the catalogue entry that was picked.
                onChangeText={(text) => updateDiagnosis(index, { diagnosisText: text, diagnosisId: undefined })}
                onChoose={(choice) =>
                  updateDiagnosis(
                    index,
                    "diagnosisId" in choice
                      ? { diagnosisText: choice.name, diagnosisId: choice.diagnosisId }
                      : { diagnosisText: choice.diagnosisText, diagnosisId: undefined },
                  )
                }
              />
              <label className="flex items-center gap-1.5 pb-3 text-[12.5px] text-text-secondary">
                <input type="checkbox" checked={d.isPrimary} onChange={(e) => updateDiagnosis(index, { isPrimary: e.target.checked })} />
                Primary
              </label>
              <Select
                label="Certainty"
                options={CERTAINTY_OPTIONS}
                value={d.certainty}
                onChange={(e) => updateDiagnosis(index, { certainty: e.target.value as DiagnosisCertainty })}
              />
              <button
                type="button"
                onClick={() => setDiagnoses((items) => items.filter((_, i) => i !== index))}
                aria-label="Remove diagnosis"
                className="flex h-11 w-11 items-center justify-center rounded-lg text-text-secondary hover:bg-danger-50 hover:text-danger-600"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setDiagnoses((items) => [...items, { diagnosisText: "", diagnosisId: undefined, isPrimary: false, certainty: "PROVISIONAL" }])}
          className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-600 hover:text-brand-700"
        >
          <Plus className="size-3.5" aria-hidden />
          Add another diagnosis
        </button>
      </div>

      <TextAreaField label="Investigations" value={fields.investigationsNotes} onChange={(v) => set("investigationsNotes", v)} />
      <TextAreaField label="Treatment plan & patient instructions" value={fields.treatmentPlan} onChange={(v) => set("treatmentPlan", v)} />

      <PrescriptionWorkspace
        state={prescription}
        onChange={setPrescription}
        allergyNote={allergyNoteOf(fields)}
        patientLabel="Prescription for this amendment"
      />

      {showOutcomePicker ? (
        <OutcomePicker
          prescription={prescription}
          outcomeNotes={outcomeNotes}
          onChangeNotes={setOutcomeNotes}
          loading={amend.isPending}
          onChoose={(outcome, medicines, destinationFacilityId) =>
            amend.mutate({ outcome, medicines, destinationFacilityId })
          }
          onCancel={() => setShowOutcomePicker(false)}
        />
      ) : (
        <div className="flex gap-3">
          <Button size="md" disabled={!amendmentReason.trim()} onClick={() => setShowOutcomePicker(true)}>
            Sign amendment & choose next step
          </Button>
          <Button variant="secondary" size="md" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

function ConsultationHistorySection({ entries }: { entries: Consultation[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-5 border-t border-border-subtle pt-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-[12.5px] font-medium text-text-secondary hover:text-text-primary"
      >
        <ChevronDown className={clsx("size-3.5 transition-transform duration-150", open && "rotate-180")} aria-hidden />
        {open ? "Hide" : "Show"} consultation history ({entries.length})
      </button>
      {open && (
        <div className="mt-3 flex flex-col gap-2">
          {entries
            .slice()
            .reverse()
            .map((entry) => (
              <div key={entry.id} className="rounded-lg border border-border-subtle bg-surface-sunken/40 px-3.5 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12.5px] font-medium text-text-primary">
                    {entry.status === "ENTERED_IN_ERROR" ? "Entered in error" : "Superseded"}
                    {entry.outcome && ` — ${outcomeLabel(entry.outcome)}`}
                  </span>
                  <span className="text-[12px] text-text-secondary">
                    Started {new Date(entry.createdAt).toLocaleString()}
                    {entry.signedAt && ` · Signed off ${new Date(entry.signedAt).toLocaleString()}`}
                  </span>
                </div>
                <p className="mt-1 text-[12.5px] text-text-secondary">
                  {entry.authorName ?? "Unknown staff"}
                  {entry.signedByName && entry.signedByName !== entry.authorName
                    ? ` · signed by ${entry.signedByName}`
                    : ""}
                </p>
                {entry.diagnoses.length > 0 && (
                  <p className="mt-1 text-[12.5px] text-text-secondary">
                    Diagnoses: {entry.diagnoses.map((d) => d.diagnosisText).join(", ")}
                  </p>
                )}
                {entry.amendmentReason && <p className="mt-1 text-[12.5px] text-text-secondary">{entry.amendmentReason}</p>}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
