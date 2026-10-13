import { TriangleAlert } from "lucide-react";
import { Button } from "@/shared/components/Button";
import { Modal } from "../pharmacy/components/Modal";
import { sentenceOf, type Entry } from "./entries";

interface ReviewDialogProps {
  open: boolean;
  entries: Entry[];
  patientLabel: string;
  allergyNote: string | null;
  onClose: () => void;
}

function Group({ title, note, entries }: { title: string; note: string; entries: Entry[] }) {
  if (entries.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <div>
        <h3 className="text-[14.5px] font-semibold text-text-primary">{title}</h3>
        <p className="text-[12.5px] text-text-secondary">{note}</p>
      </div>
      <ol className="flex flex-col divide-y divide-border-subtle rounded-xl border border-border-subtle">
        {entries.map((entry, index) => (
          <li key={entry.key} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-4 py-3">
            <div className="min-w-0">
              <p className="text-[14.5px] font-semibold text-text-primary">
                <span className="mr-2 tabular-nums text-text-secondary">{index + 1}.</span>
                {entry.name} <span className="font-normal text-text-secondary">{entry.strengthForm}</span>
              </p>
              <p className="ml-6 text-[13.5px] text-text-secondary">{sentenceOf(entry)}</p>
            </div>
            <p className="text-[14px] font-semibold tabular-nums text-text-primary">
              {entry.quantity} <span className="font-normal text-text-secondary">{entry.unit}</span>
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

// A last read of the whole prescription before it is signed. Printing is available from the
// prescription once it is signed, because only then does it have its number.
export function ReviewDialog({ open, entries, patientLabel, allergyNote, onClose }: ReviewDialogProps) {
  return (
    <Modal
      open={open}
      size="lg"
      title="Review the prescription"
      description={patientLabel}
      onClose={onClose}
      footer={<Button onClick={onClose}>Back to editing</Button>}
    >
      <div className="flex flex-col gap-5">
        {allergyNote && (
          <p role="note" className="flex items-start gap-2 rounded-lg bg-danger-50 px-3.5 py-2.5 text-[13.5px] font-medium text-danger-600">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {allergyNote}
          </p>
        )}
        <Group title="From the pharmacy" note="The pharmacist hands over exactly these." entries={entries.filter((entry) => entry.supply === "PHARMACY")} />
        <Group title="For the patient to buy" note="Listed on the prescription. The pharmacy does not supply these." entries={entries.filter((entry) => entry.supply === "BUY")} />
        {entries.length === 0 && <p className="text-[13.5px] text-text-secondary">Nothing has been added yet.</p>}
      </div>
    </Modal>
  );
}
