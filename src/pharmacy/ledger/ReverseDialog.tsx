import { useState, type ReactNode } from "react";
import { Undo2 } from "lucide-react";
import { Button } from "@/shared/components/Button";
import { Modal } from "@/pharmacy/components/Modal";
import { ReasonPicker } from "@/pharmacy/components/ReasonPicker";
import type { ReversalReason, ReversePayload } from "@/shared/api/pharmacyLedger";
import { REVERSAL_REASONS } from "./lib/movementEvents";

const MIN_NOTE_LENGTH = 3;

interface ReverseDialogProps {
  title: string;
  /** What is being reversed, in the pharmacist's words. */
  summary: ReactNode;
  /** The consequence, e.g. "Stock of X goes from 90 to 60". */
  preview?: ReactNode;
  confirmLabel: string;
  pending: boolean;
  errorMessage: string | null;
  onConfirm: (payload: ReversePayload) => void;
  onClose: () => void;
}

// The one reversal form, shared by "reverse this line" and "reverse the whole
// receipt": same reasons, same note rule, same confirm wording. It is rendered
// only while open, so every opening starts with a blank form.
export function ReverseDialog({
  title,
  summary,
  preview,
  confirmLabel,
  pending,
  errorMessage,
  onConfirm,
  onClose,
}: ReverseDialogProps) {
  const [reason, setReason] = useState<ReversalReason | null>(null);
  const [note, setNote] = useState("");

  const noteIsValid = reason !== "OTHER" || note.trim().length >= MIN_NOTE_LENGTH;
  const canConfirm = reason !== null && noteIsValid;

  function confirm() {
    if (reason === null) return;
    const trimmed = note.trim();
    onConfirm({ reason, ...(trimmed ? { note: trimmed } : {}) });
  }

  return (
    <Modal
      open
      title={title}
      dismissible={!pending}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" disabled={pending} onClick={onClose}>
            Keep it
          </Button>
          <Button
            variant="danger"
            icon={<Undo2 className="size-4" aria-hidden />}
            loading={pending}
            disabled={!canConfirm}
            onClick={confirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-lg bg-surface-sunken px-3.5 py-3 text-[14px] text-text-primary">{summary}</div>
        {preview && <p className="text-[14px] font-medium text-text-primary">{preview}</p>}
        <p className="text-[13px] text-text-secondary">
          The original entry stays in the ledger and a linked reversal is added. Nothing is deleted.
        </p>
        <ReasonPicker
          legend="Why are you reversing this?"
          options={REVERSAL_REASONS}
          value={reason}
          onChange={setReason}
          note={note}
          onNoteChange={setNote}
          minNoteLength={MIN_NOTE_LENGTH}
        />
        {errorMessage && (
          <p role="alert" className="rounded-lg bg-danger-50 px-3.5 py-2.5 text-[13.5px] text-danger-600">
            {errorMessage}
          </p>
        )}
      </div>
    </Modal>
  );
}
