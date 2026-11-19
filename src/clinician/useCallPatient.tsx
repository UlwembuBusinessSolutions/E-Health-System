import { useId, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/shared/api/client";
import type { WaitingPatient } from "@/shared/api/clinicianDashboard";
import { callToken, type QueueActionReason, type QueueReason } from "@/shared/api/queue";
import { Button } from "@/shared/components/Button";
import { Select } from "@/shared/components/Select";
import { useToast } from "@/shared/components/toast/ToastProvider";
import { Modal } from "@/pharmacy/components/Modal";
import { plural } from "@/shared/lib/chartFormat";
import { queueHead, suggestedNote, suggestedReason } from "./clinicianModel";

// The same vocabulary the Queue page offers for boosting and reactivating;
// the backend validates all of them alike.
const REASON_OPTIONS: Array<{ value: QueueActionReason; label: string }> = [
  { value: "CLINICAL_CONCERN", label: "Clinical concern" },
  { value: "ELDERLY_PATIENT", label: "Elderly patient" },
  { value: "PREGNANCY", label: "Pregnancy" },
  { value: "DISABILITY_OR_MOBILITY", label: "Disability or mobility assistance" },
  { value: "YOUNG_CHILD", label: "Young child" },
  { value: "RETURNED_AFTER_MISSED_CALL", label: "Returned after missed call" },
  { value: "CLINICIAN_REQUEST", label: "Clinician request" },
  { value: "OTHER", label: "Other" },
];

interface PendingCall {
  patient: WaitingPatient;
  /** Shown when the queue changed under the user, so they know why they are asked. */
  queueChanged: boolean;
}

/**
 * Calling a patient from the Dashboard. The patient the queue itself would
 * call next is called straight away; anyone else is a call out of turn, which
 * the queue records with a reason, so a dialog asks for one first.
 *
 * The server re-checks the queue at the moment of the call, so every way it
 * can have changed since the list was drawn ends in a clear message and a
 * fresh list, never a silent failure: the patient was already called or left
 * (409), or someone joined ahead and a reason is now needed (400).
 */
export function useCallPatient(patients: WaitingPatient[], onCalled: () => void) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [pending, setPending] = useState<PendingCall | null>(null);

  const mutation = useMutation({
    mutationFn: ({ patient, reason }: { patient: WaitingPatient; reason?: QueueReason }) => callToken(patient.tokenId, reason),
    onSuccess: (_, { patient }) => {
      setPending(null);
      showToast(`Called ${patient.patientName}, ticket ${patient.ticketNumber}.`, "success");
    },
    onError: (error, { patient, reason }) => {
      if (error instanceof ApiError && error.status === 400 && !reason) {
        setPending({ patient, queueChanged: true });
      } else if (error instanceof ApiError && error.status === 409) {
        setPending(null);
        showToast(`${patient.patientName} was already called or is no longer waiting. The list has been refreshed.`, "error");
      } else if (error instanceof ApiError && error.status === 403) {
        setPending(null);
        showToast("Your role can't call patients from the queue.", "error");
      } else {
        showToast(error instanceof ApiError && error.status < 500 && error.message ? error.message : "Couldn't call the patient. Try again.", "error");
      }
    },
    onSettled: () => {
      onCalled();
      void queryClient.invalidateQueries({ queryKey: ["queue"] });
    },
  });

  function call(patient: WaitingPatient) {
    if (mutation.isPending) return;
    if (patient.queuePosition === 0) {
      mutation.mutate({ patient });
    } else {
      setPending({ patient, queueChanged: false });
    }
  }

  const dialog = pending && (
    <CallOutOfTurnDialog
      key={pending.patient.tokenId}
      patient={pending.patient}
      head={queueHead(patients)}
      queueChanged={pending.queueChanged}
      saving={mutation.isPending}
      onCancel={() => setPending(null)}
      onConfirm={(reason) => mutation.mutate({ patient: pending.patient, reason })}
    />
  );

  return { call, callingTokenId: mutation.isPending ? mutation.variables?.patient.tokenId : undefined, dialog };
}

interface DialogProps {
  patient: WaitingPatient;
  head: WaitingPatient | undefined;
  queueChanged: boolean;
  saving: boolean;
  onCancel: () => void;
  onConfirm: (reason: QueueReason) => void;
}

function CallOutOfTurnDialog({ patient, head, queueChanged, saving, onCancel, onConfirm }: DialogProps) {
  const [reasonCode, setReasonCode] = useState<QueueActionReason>(() => suggestedReason(patient, head));
  const [note, setNote] = useState(() => suggestedNote(patient));
  const [tried, setTried] = useState(false);
  const noteId = useId();
  const noteMissing = reasonCode === "OTHER" && note.trim() === "";
  const skipped = patient.queuePosition;

  function submit() {
    setTried(true);
    if (noteMissing) return;
    onConfirm({ reasonCode, reasonNote: note.trim() || undefined });
  }

  return (
    <Modal
      open
      size="sm"
      title={`Call ${patient.patientName} out of turn?`}
      onClose={onCancel}
      dismissible={!saving}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving}>
            Call {patient.patientName.split(" ")[0]}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 text-[14px] text-text-primary">
        {queueChanged && (
          <p role="alert" className="rounded-lg bg-warning-50 px-3 py-2 text-[13px] text-warning-600">
            The queue changed since this list was loaded, so this call now skips other patients.
          </p>
        )}
        <p className="leading-relaxed text-text-secondary">
          {head && head.tokenId !== patient.tokenId ? (
            <>
              By ticket order, <strong className="text-text-primary">{head.patientName}</strong> is next. Calling{" "}
              {patient.patientName} now skips {plural(skipped, "patient")}, so the queue records why.
            </>
          ) : (
            <>Calling {patient.patientName} now skips {plural(skipped, "patient")} in ticket order, so the queue records why.</>
          )}
        </p>
        <Select
          label="Reason"
          value={reasonCode}
          options={REASON_OPTIONS}
          onChange={(event) => setReasonCode(event.target.value as QueueActionReason)}
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor={noteId} className="text-[13px] font-semibold text-text-primary">
            Note {reasonCode === "OTHER" ? "(required)" : "(optional)"}
          </label>
          <textarea
            id={noteId}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            maxLength={500}
            aria-invalid={tried && noteMissing}
            aria-describedby={tried && noteMissing ? `${noteId}-error` : undefined}
            className="w-full resize-none rounded-lg border border-border-strong bg-surface-raised px-3 py-2 text-[14px] text-text-primary outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
          {tried && noteMissing && (
            <p id={`${noteId}-error`} className="text-[12.5px] text-critical-600">
              Explain the reason when you choose Other.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
