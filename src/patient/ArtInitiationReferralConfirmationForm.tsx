import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Forward, RotateCcw } from "lucide-react";
import { ApiError } from "@/shared/api/client";
import {
  getArtInitiationReferralConfirmation,
  saveArtInitiationReferralConfirmation,
} from "@/shared/api/artInitiationReferralConfirmation";
import { Button } from "@/shared/components/Button";
import { useToast } from "@/shared/components/toast/ToastProvider";
import { Modal } from "@/pharmacy/components/Modal";

const notesClass =
  "min-h-40 w-full resize-y rounded-lg border border-border-strong bg-surface-raised px-3 py-2.5 text-sm text-text-primary outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

function formatUpdatedAt(value: string): string {
  return new Date(value).toLocaleString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ArtInitiationReferralConfirmationForm({ visitId }: { visitId: string }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);

  const confirmationQuery = useQuery({
    queryKey: ["art-initiation-referral-confirmation", visitId],
    queryFn: () => getArtInitiationReferralConfirmation(visitId),
    enabled: open,
  });

  useEffect(() => {
    if (!open || confirmationQuery.data === undefined) return;
    setNotes(confirmationQuery.data?.notes ?? "");
  }, [open, confirmationQuery.data]);

  const save = useMutation({
    mutationFn: () => saveArtInitiationReferralConfirmation(visitId, notes),
    onSuccess: (confirmation) => {
      queryClient.setQueryData(["art-initiation-referral-confirmation", visitId], confirmation);
      setSaveError(null);
      setOpen(false);
      showToast("Referral confirmation notes saved.", "success");
    },
    onError: (error) => {
      setSaveError(error instanceof ApiError
        ? error.message
        : "Couldn't save the referral confirmation notes. Try again.");
    },
  });

  function resetDraft() {
    setNotes("");
    setSaveError(null);
  }

  return (
    <>
      <Button
        variant="secondary"
        size="md"
        icon={<Forward className="size-4" aria-hidden />}
        onClick={() => {
          setSaveError(null);
          setOpen(true);
        }}
      >
        Capture Referral Confirmation
      </Button>

      <Modal
        open={open}
        size="lg"
        title="Capture Referral Confirmation"
        description="Record referral confirmation notes for this Adult ART Initiation visit."
        dismissible={!save.isPending}
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="secondary" disabled={save.isPending} onClick={resetDraft}>
              <RotateCcw className="mr-1.5 size-3.5" aria-hidden />
              Reset
            </Button>
            <Button
              variant="primary"
              loading={save.isPending}
              disabled={confirmationQuery.isLoading || confirmationQuery.isError}
              onClick={() => save.mutate()}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {confirmationQuery.isError && (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-danger-50 p-3">
              <p className="text-[13px] text-danger-700">Couldn't load saved referral confirmation notes.</p>
              <Button variant="secondary" size="md" onClick={() => confirmationQuery.refetch()}>
                Try again
              </Button>
            </div>
          )}
          {confirmationQuery.isLoading ? (
            <p className="text-[13px] text-text-secondary">Loading saved notes…</p>
          ) : (
            <>
              {confirmationQuery.data ? (
                <p className="rounded-lg bg-brand-50 px-3.5 py-3 text-[12.5px] text-brand-800">
                  Referral confirmation notes are saved for this visit. Saving changes will update them. Reset clears
                  the form; saved notes change only when you save.
                  <span className="mt-1 block text-brand-700">
                    Last saved by {confirmationQuery.data.updatedByName ?? "Clinical staff"} · {formatUpdatedAt(confirmationQuery.data.updatedAt)}
                  </span>
                </p>
              ) : !confirmationQuery.isError ? (
                <p role="status" className="rounded-lg bg-surface-sunken px-3.5 py-3 text-[13px] text-text-secondary">
                  No referral confirmation notes are saved for this visit yet.
                </p>
              ) : null}
              <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-text-primary">
                Note
                <textarea
                  className={notesClass}
                  value={notes}
                  maxLength={10_000}
                  onChange={(event) => {
                    setNotes(event.target.value);
                    setSaveError(null);
                  }}
                  placeholder="Enter referral confirmation notes"
                />
                <span className="text-right text-[11px] font-normal text-text-secondary">
                  {notes.length}/10,000 characters
                </span>
              </label>
              {saveError && <p role="alert" className="text-[13px] text-danger-700">{saveError}</p>}
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
