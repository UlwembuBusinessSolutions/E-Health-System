import { useState, type ReactNode } from "react";
import { History, Stethoscope } from "lucide-react";
import { Button } from "@/shared/components/Button";
import { OUTCOME_TEXT } from "./outcomeText";
import type { EarlierConsultation } from "@/shared/api/consultations";
import type { TriageAssessment } from "@/shared/api/triage";

function whenOf(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("en-ZA", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
}

function DiagnosisChips({ earlier }: { earlier: EarlierConsultation }) {
  if (earlier.diagnoses.length === 0) return <span className="text-text-secondary">No diagnosis recorded</span>;
  return (
    <span className="flex flex-wrap gap-1.5">
      {earlier.diagnoses.map((d) => (
        <span key={d.id} className="inline-flex items-center gap-1.5 rounded-full bg-surface-raised px-2.5 py-0.5 text-[12.5px] text-text-primary ring-1 ring-border-subtle">
          {d.code && <span className="font-mono text-[11.5px] font-semibold text-brand-600">{d.code}</span>}
          {d.diagnosisText}
        </span>
      ))}
    </span>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <dt className="w-24 shrink-0 text-[12px] font-medium uppercase tracking-wide text-text-secondary">{label}</dt>
      <dd className="text-[13.5px] text-text-primary">{children}</dd>
    </div>
  );
}

function summaryLine(earlier: EarlierConsultation): string {
  const outcome = earlier.outcome ? OUTCOME_TEXT[earlier.outcome] : "Signed";
  return [earlier.facilityName, whenOf(earlier.signedAt), earlier.signedByName, outcome].filter(Boolean).join(" · ");
}

interface ContinueConsultationProps {
  earlier: EarlierConsultation;
  /** Shown instead when the doctor says this visit is a new problem. */
  newProblem: ReactNode;
  loading: boolean;
  error: string | null;
  onContinue: (consultationId: string) => void;
}

// The patient has been here for this episode of care before, and was sent elsewhere and came back. The doctor
// either carries on from that consultation, with its notes, diagnoses and vitals, or says this is a new problem.
export function ContinueConsultation({ earlier, newProblem, loading, error, onContinue }: ContinueConsultationProps) {
  const [startingNew, setStartingNew] = useState(false);

  if (startingNew) {
    return (
      <div className="flex flex-col gap-3">
        <button type="button" onClick={() => setStartingNew(false)} className="self-start text-[13px] font-medium text-brand-600 hover:text-brand-700">
          Back to the earlier consultation
        </button>
        {newProblem}
      </div>
    );
  }

  return (
    <section aria-label="Earlier consultation" className="rounded-xl border border-brand-500/40 bg-brand-50 p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-500 text-white">
          <History className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-text-primary">This patient was already seen for this</h3>
          <p className="text-[13px] text-text-secondary">{summaryLine(earlier)}</p>
        </div>
      </div>

      <dl className="mt-3 flex flex-col gap-1.5">
        <Fact label="Diagnoses">
          <DiagnosisChips earlier={earlier} />
        </Fact>
        <Fact label="Vitals">{earlier.vitalsVisitId ? "On record. They carry over." : "None were taken."}</Fact>
      </dl>

      {error && (
        <p role="alert" className="mt-2 text-[13px] text-danger-600">
          {error}
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button size="md" icon={<Stethoscope className="size-3.5" aria-hidden />} loading={loading} onClick={() => onContinue(earlier.consultationId)}>
          Continue this consultation
        </Button>
        <Button variant="secondary" size="md" disabled={loading} onClick={() => setStartingNew(true)}>
          Start a new problem
        </Button>
      </div>
      <p className="mt-2 text-[12px] text-text-secondary">
        Continuing copies the notes and diagnoses into a new draft for you to update. The earlier record stays as it was signed.
      </p>
    </section>
  );
}

function vitalsLine(triage: TriageAssessment): string {
  const bp = triage.systolicBp !== null && triage.diastolicBp !== null ? `BP ${triage.systolicBp}/${triage.diastolicBp}` : null;
  return [
    triage.heartRate !== null && `HR ${triage.heartRate}`,
    bp,
    triage.temperatureCelsius !== null && `Temp ${triage.temperatureCelsius} °C`,
    triage.spo2Percent !== null && `SpO₂ ${triage.spo2Percent}%`,
    triage.respiratoryRate !== null && `RR ${triage.respiratoryRate}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

// On the continued record: where it carries on from, and the vitals taken on the earlier visit.
export function ContinuedFromNote({ earlier, vitals }: { earlier: EarlierConsultation; vitals: TriageAssessment | null }) {
  return (
    <div role="note" className="mb-4 rounded-lg border border-brand-500/30 bg-brand-50 px-3.5 py-2.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-brand-600">Continued from an earlier consultation</p>
      <p className="mt-0.5 text-[13.5px] text-text-primary">{summaryLine(earlier)}</p>
      {vitals && vitalsLine(vitals) && (
        <p className="mt-0.5 text-[13px] text-text-secondary">
          Vitals taken {whenOf(vitals.observedAt)}: {vitalsLine(vitals)}
        </p>
      )}
    </div>
  );
}
