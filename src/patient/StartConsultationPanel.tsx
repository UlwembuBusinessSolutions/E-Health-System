import { useState } from "react";
import { HeartPulse, Stethoscope, TriangleAlert } from "lucide-react";
import { Button } from "@/shared/components/Button";
import type { VitalsBypass, VitalsBypassReason } from "@/shared/api/consultations";
import { ReasonPicker, type ReasonOption } from "@/pharmacy/components/ReasonPicker";

interface StartConsultationPanelProps {
  /** True once the visit's vitals are known to be missing; false while loading or when they exist. */
  vitalsMissing: boolean;
  loading: boolean;
  error: string | null;
  onStart: (bypass?: VitalsBypass) => void;
  /** Takes the doctor to this patient's Vitals tab, where vitals are taken for the visit. */
  onTakeVitals?: () => void;
}

const MIN_NOTE_LENGTH = 3;

const REASON_OPTIONS: ReasonOption<VitalsBypassReason>[] = [
  { value: "EMERGENCY", label: "Emergency", description: "The patient needs the doctor now" },
  { value: "FOLLOW_UP_NO_CHANGE", label: "Follow-up, nothing has changed", description: "A repeat visit with no new readings needed" },
  { value: "OTHER", label: "Another reason", description: "Explain below" },
];

// Starting a consultation. A visit with vitals starts straight away. One without them
// asks why they are being skipped, and that reason stays on the consultation record, so a
// missing reading is never mistaken for a normal one.
export function StartConsultationPanel({ vitalsMissing, loading, error, onStart, onTakeVitals }: StartConsultationPanelProps) {
  const [reason, setReason] = useState<VitalsBypassReason | null>(null);
  const [note, setNote] = useState("");

  const needsNote = reason === "OTHER";
  const canStart = !vitalsMissing || (reason !== null && (!needsNote || note.trim().length >= MIN_NOTE_LENGTH));

  function start() {
    if (!vitalsMissing) return onStart();
    // The note box only shows for OTHER, so a note typed earlier must not follow another choice.
    if (reason) onStart({ reason, note: reason === "OTHER" ? note.trim() : undefined });
  }

  return (
    <div className="rounded-lg border border-border-default bg-surface-sunken p-4">
      <p className="text-[13.5px] text-text-secondary">No consultation recorded yet for this visit.</p>

      {vitalsMissing && (
        <div role="note" className="mt-3 flex flex-col gap-4 rounded-lg border border-amber-500/40 bg-amber-50 p-3.5">
          <p className="flex items-start gap-2 text-[13.5px] font-medium text-text-primary">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
            No vitals have been taken for this visit.
          </p>
          <div>
            <Button variant="secondary" icon={<HeartPulse className="size-4" aria-hidden />} onClick={onTakeVitals}>
              Take vitals first
            </Button>
          </div>
          <ReasonPicker
            legend="Or start without them. Why?"
            options={REASON_OPTIONS}
            value={reason}
            onChange={(value) => setReason(value as VitalsBypassReason)}
            note={note}
            onNoteChange={setNote}
            minNoteLength={MIN_NOTE_LENGTH}
          />
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 text-[13px] text-danger-600">
          {error}
        </p>
      )}
      <Button
        className="mt-3"
        variant="secondary"
        size="md"
        icon={<Stethoscope className="size-3.5" aria-hidden />}
        loading={loading}
        disabled={!canStart}
        onClick={start}
      >
        {vitalsMissing ? "Start without vitals" : "Start consultation"}
      </Button>
    </div>
  );
}
