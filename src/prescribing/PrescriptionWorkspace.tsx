import { useState } from "react";
import { ClipboardList, Flag } from "lucide-react";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { EntriesTable } from "./EntriesTable";
import { MedicineForm } from "./MedicineForm";
import { ReviewDialog } from "./ReviewDialog";
import { problemsOf, type Entry, type PrescriptionState } from "./entries";

interface PrescriptionWorkspaceProps {
  state: PrescriptionState;
  onChange: (state: PrescriptionState) => void;
  /** One line about the patient's recorded allergies, or null when none are recorded. */
  allergyNote: string | null;
  patientLabel: string;
}

// The doctor's prescribing area on the consultation: a switch to prescribe at all, a form to enter one
// medicine with every direction, and a table of what has been entered so far. The prescription is
// part of the draft, so it is kept when the record is closed.
export function PrescriptionWorkspace({ state, onChange, allergyNote, patientLabel }: PrescriptionWorkspaceProps) {
  const [editing, setEditing] = useState<Entry | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [pharmacyName, setPharmacyName] = useState("");

  const problems = problemsOf(state);
  const pharmacyCount = state.entries.filter((entry) => entry.supply === "PHARMACY").length;
  const buyCount = state.entries.length - pharmacyCount;

  function save(saved: Entry[], replacingKey: string | null) {
    const kept = replacingKey ? state.entries.filter((entry) => entry.key !== replacingKey) : state.entries;
    const position = replacingKey ? state.entries.findIndex((entry) => entry.key === replacingKey) : -1;
    const next = position >= 0 ? [...kept.slice(0, position), ...saved, ...kept.slice(position)] : [...kept, ...saved];
    onChange({ ...state, entries: next });
    setEditing(null);
  }

  return (
    <Card className="flex flex-col gap-5 p-5 sm:p-6" aria-labelledby="rx-heading">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-[22px] text-brand-600" aria-hidden>℞</span>
          <div>
            <h2 id="rx-heading" className="text-[17px] font-semibold text-text-primary">Prescription</h2>
            <p className="text-[13px] text-text-secondary">
              {pharmacyName ? `Stock is checked live at ${pharmacyName}.` : "Enter each medicine, then review them together."}
            </p>
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            role="switch"
            className="peer sr-only"
            checked={state.prescribe}
            aria-describedby="prescribe-status"
            onChange={(event) => onChange({ ...state, prescribe: event.target.checked })}
          />
          <span className="flex flex-col text-right">
            <span className="text-[14px] font-semibold text-text-primary">Prescribe for this visit</span>
            <span id="prescribe-status" className="text-[12.5px] text-text-secondary">
              {state.prescribe ? "On. Add medicines below." : "Off. Nothing will be prescribed."}
            </span>
          </span>
          <span
            aria-hidden
            className={`flex h-[34px] w-14 items-center rounded-full p-[3px] transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-brand-400 peer-focus-visible:ring-offset-2 ${state.prescribe ? "justify-end bg-brand-500" : "justify-start bg-ink-300"}`}
          >
            <span className="size-7 rounded-full bg-white shadow" />
          </span>
        </label>
      </div>

      {!state.prescribe ? (
        <div className="rounded-xl border border-dashed border-border-strong bg-surface-sunken/50 px-5 py-6">
          <p className="text-[14.5px] font-semibold text-text-primary">No prescription for this visit</p>
          <p className="mt-1 text-[13.5px] text-text-secondary">
            Switch prescribing on when the patient needs medicine, from the pharmacy or to buy themselves.
            {state.entries.length > 0 ? " What you already entered is kept." : ""}
          </p>
        </div>
      ) : (
        <>
          {allergyNote && (
            <p role="note" className="flex items-start gap-2 rounded-lg bg-danger-50 px-3.5 py-2.5 text-[13.5px] text-danger-600">
              <Flag className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span><strong>{allergyNote}</strong> Check it before adding medicines.</span>
            </p>
          )}

          <MedicineForm
            key={editing?.key ?? "new"}
            entries={state.entries}
            editing={editing}
            onSave={save}
            onPharmacyKnown={setPharmacyName}
            onCancelEdit={() => setEditing(null)}
          />

          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="flex items-center gap-2.5 text-[15px] font-semibold text-text-primary">
              <span className="grid size-6 place-items-center rounded-full bg-brand-500 text-[12px] font-bold text-white">2</span>
              Entered medicines <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[12px] tabular-nums text-text-secondary">{state.entries.length}</span>
            </h3>
            <p className="text-[12.5px] text-text-secondary">One row per medicine. Edit before reviewing.</p>
          </div>

          <EntriesTable
            entries={state.entries}
            editingKey={editing?.key ?? null}
            onEdit={setEditing}
            onRemove={(entry) => {
              onChange({ ...state, entries: state.entries.filter((candidate) => candidate.key !== entry.key) });
              if (editing?.key === entry.key) setEditing(null);
            }}
          />

          {problems.length > 0 && state.entries.length > 0 && (
            <ul role="status" className="rounded-lg bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-600">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-brand-50 px-4 py-3">
            <p className="text-[13.5px] text-brand-700">
              <strong>{state.entries.length} {state.entries.length === 1 ? "medicine" : "medicines"}</strong>
              {state.entries.length > 0 && <> · {pharmacyCount} from the pharmacy · {buyCount} for the patient to buy</>}
            </p>
            <Button variant="secondary" icon={<ClipboardList className="size-4" aria-hidden />} disabled={state.entries.length === 0} onClick={() => setReviewing(true)}>
              Review prescription
            </Button>
          </div>
        </>
      )}

      <ReviewDialog open={reviewing} entries={state.entries} patientLabel={patientLabel} allergyNote={allergyNote} onClose={() => setReviewing(false)} />
    </Card>
  );
}
