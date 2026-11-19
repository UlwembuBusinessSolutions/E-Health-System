import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookHeart, RotateCcw } from "lucide-react";
import { ApiError } from "@/shared/api/client";
import {
  getArtInitiationMedicalHistory,
  saveArtInitiationMedicalHistory,
} from "@/shared/api/artInitiationMedicalHistory";
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

export function ArtInitiationMedicalHistoryForm({ visitId }: { visitId: string }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);

  const historyQuery = useQuery({
    queryKey: ["art-initiation-medical-history", visitId],
    queryFn: () => getArtInitiationMedicalHistory(visitId),
    enabled: open,
  });

  useEffect(() => {
    if (!open || historyQuery.data === undefined) return;
    setNotes(historyQuery.data?.notes ?? "");
  }, [open, historyQuery.data]);

  const save = useMutation({
    mutationFn: () => saveArtInitiationMedicalHistory(visitId, notes),
    onSuccess: (history) => {
      queryClient.setQueryData(["art-initiation-medical-history", visitId], history);
      setSaveError(null);
      setOpen(false);
      showToast("Medical history saved.", "success");
    },
    onError: (error) => {
      setSaveError(error instanceof ApiError ? error.message : "Couldn't save medical history. Try again.");
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
        icon={<BookHeart className="size-4" aria-hidden />}
        onClick={() => {
          setSaveError(null);
          setOpen(true);
        }}
      >
        Capture Medical History
      </Button>

      <Modal
        open={open}
        size="lg"
        title="Capture Medical History"
        description="Record medical history notes for this Adult ART Initiation visit."
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
              disabled={historyQuery.isLoading || historyQuery.isError}
              onClick={() => save.mutate()}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {historyQuery.isError && (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-danger-50 p-3">
              <p className="text-[13px] text-danger-700">Couldn't load saved medical history notes.</p>
              <Button variant="secondary" size="md" onClick={() => historyQuery.refetch()}>
                Try again
              </Button>
            </div>
          )}

          {historyQuery.isLoading ? (
            <p className="text-[13px] text-text-secondary">Loading saved notes…</p>
          ) : (
            <>
              {historyQuery.data ? (
                <p className="rounded-lg bg-brand-50 px-3.5 py-3 text-[12.5px] text-brand-800">
                  Medical history notes are saved for this visit. Saving changes will update them. Reset clears the
                  form; saved notes change only when you save.
                  <span className="mt-1 block text-brand-700">
                    Last saved by {historyQuery.data.updatedByName ?? "Clinical staff"} · {formatUpdatedAt(historyQuery.data.updatedAt)}
                  </span>
                </p>
              ) : !historyQuery.isError ? (
                <p role="status" className="rounded-lg bg-surface-sunken px-3.5 py-3 text-[13px] text-text-secondary">
                  No medical history notes are saved for this visit yet.
                </p>
              ) : null}
              <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-text-primary">
                Notes
                <textarea
                  className={notesClass}
                  value={notes}
                  maxLength={10_000}
                  onChange={(event) => {
                    setNotes(event.target.value);
                    setSaveError(null);
                  }}
                  placeholder="Enter medical history details"
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
