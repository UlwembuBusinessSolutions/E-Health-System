import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Search } from "lucide-react";
import { Button } from "@/shared/components/Button";
import { OUTCOME_TEXT } from "./outcomeText";
import { Card } from "@/shared/components/Card";
import { StatusPill } from "@/shared/components/StatusPill";
import { getPatientConsultations, type PatientConsultation } from "@/shared/api/consultations";

const MAX_DIAGNOSES_SHOWN = 3;

function dateOf(iso: string): string {
  return new Date(iso).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" });
}

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
}

function matches(entry: PatientConsultation, search: string): boolean {
  const text = search.trim().toLowerCase();
  if (!text) return true;
  return entry.consultation.diagnoses.some(
    (d) => d.diagnosisText.toLowerCase().includes(text) || (d.code ?? "").toLowerCase().includes(text),
  );
}

interface PatientConsultationListProps {
  patientId: string;
  /** The visit whose consultation is on screen now, so its row says so. */
  shownVisitId: string | null;
  onOpen: (entry: PatientConsultation) => void;
}

// Every consultation the patient has had, whichever visit it was on, with its diagnoses. A draft can be carried
// on from here; a signed one opens with Amend available.
export function PatientConsultationList({ patientId, shownVisitId, onOpen }: PatientConsultationListProps) {
  const [search, setSearch] = useState("");
  const query = useQuery({
    queryKey: ["patient-consultations", patientId],
    queryFn: () => getPatientConsultations(patientId),
  });
  const entries = query.data ?? [];
  const shown = entries.filter((entry) => matches(entry, search));

  return (
    <Card className="mb-6 p-6" role="region" aria-labelledby="all-consultations-heading">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="size-4 text-text-secondary" aria-hidden />
          <h2 id="all-consultations-heading" className="text-[14.5px] font-semibold text-text-primary">
            All consultations{query.isSuccess && entries.length > 0 ? ` (${entries.length})` : ""}
          </h2>
        </div>
        {entries.length > 1 && (
          <label className="relative block w-full sm:w-72">
            <span className="sr-only">Search by diagnosis</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary" aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by diagnosis or code"
              className="h-10 w-full rounded-lg border border-border-strong bg-surface-raised pl-9 pr-3 text-[14px] text-text-primary outline-none placeholder:text-text-secondary/70 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </label>
        )}
      </div>

      {query.isLoading ? (
        <p className="text-[13.5px] text-text-secondary">Loading…</p>
      ) : query.isError ? (
        <p role="alert" className="text-[13.5px] text-danger-600">
          Couldn&apos;t load the consultations.{" "}
          <button type="button" className="font-medium underline" onClick={() => void query.refetch()}>
            Try again
          </button>
        </p>
      ) : entries.length === 0 ? (
        <p className="text-[13.5px] text-text-secondary">No consultation has been recorded for this patient yet.</p>
      ) : shown.length === 0 ? (
        <p className="text-[13.5px] text-text-secondary">No consultation has that diagnosis.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {shown.map((entry) => (
            <ConsultationRow key={entry.consultation.id} entry={entry} isShown={entry.consultation.visitId === shownVisitId} onOpen={onOpen} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function ConsultationRow({ entry, isShown, onOpen }: { entry: PatientConsultation; isShown: boolean; onOpen: (entry: PatientConsultation) => void }) {
  const c = entry.consultation;
  const isDraft = c.status === "DRAFT";
  const doctor = c.signedByName ?? c.authorName ?? "Unknown staff";
  const diagnoses = c.diagnoses.slice(0, MAX_DIAGNOSES_SHOWN);
  const hidden = c.diagnoses.length - diagnoses.length;

  return (
    <li className="grid grid-cols-1 gap-3 rounded-lg border border-border-subtle bg-surface-sunken/40 px-4 py-3 sm:grid-cols-[9rem_1fr_auto] sm:items-center">
      <div>
        <p className="text-[13.5px] font-semibold text-text-primary">{dateOf(entry.visitDateTime)}</p>
        <p className="text-[12.5px] text-text-secondary">{timeOf(entry.visitDateTime)}</p>
      </div>

      <div className="min-w-0">
        <p className="text-[13px] text-text-secondary">
          {entry.facilityName} · {doctor}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-1.5">
          {c.diagnoses.length === 0 ? (
            <span className="text-[13px] text-text-secondary">No diagnosis recorded</span>
          ) : (
            <>
              {diagnoses.map((d) => (
                <span key={d.id} className="inline-flex items-center gap-1.5 rounded-full bg-surface-raised px-2.5 py-0.5 text-[12.5px] text-text-primary ring-1 ring-border-subtle">
                  {d.code && <span className="font-mono text-[11.5px] font-semibold text-brand-600">{d.code}</span>}
                  {d.diagnosisText}
                  {d.isPrimary && <span className="text-[10.5px] font-semibold uppercase text-brand-600">Primary</span>}
                </span>
              ))}
              {hidden > 0 && <span className="text-[12.5px] text-text-secondary">+{hidden} more</span>}
            </>
          )}
        </p>
        <p className="mt-1.5 flex flex-wrap items-center gap-2">
          {isDraft ? <StatusPill tone="warning">In progress</StatusPill> : <StatusPill tone="success">Signed</StatusPill>}
          {c.supersedesConsultationId && <StatusPill tone="neutral">Amended</StatusPill>}
          {c.outcome && !isDraft && <span className="text-[12.5px] text-text-secondary">{OUTCOME_TEXT[c.outcome]}</span>}
        </p>
      </div>

      <div>
        {isShown ? (
          <span className="text-[12.5px] font-medium text-brand-600">Open now</span>
        ) : (
          <Button variant="secondary" size="md" onClick={() => onOpen(entry)}>
            {isDraft ? "Continue editing" : "Open"}
          </Button>
        )}
      </div>
    </li>
  );
}
