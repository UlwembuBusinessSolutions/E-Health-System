import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, StickyNote } from "lucide-react";
import { ApiError } from "@/shared/api/client";
import {
  getArtInitiationAdditionalClinicalNotes,
  saveArtInitiationAdditionalClinicalNotes,
} from "@/shared/api/artInitiationAdditionalClinicalNotes";
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

export function ArtInitiationAdditionalClinicalNotesForm({ visitId }: { visitId: string }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);

  const notesQuery = useQuery({
    queryKey: ["art-initiation-additional-clinical-notes", visitId],
    queryFn: () => getArtInitiationAdditionalClinicalNotes(visitId),
    enabled: open,
  });

  useEffect(() => {
    if (!open || notesQuery.data === undefined) return;
    setNotes(notesQuery.data?.notes ?? "");
  }, [open, notesQuery.data]);

  const save = useMutation({
    mutationFn: () => saveArtInitiationAdditionalClinicalNotes(visitId, notes),
    onSuccess: (details) => {
      queryClient.setQueryData(["art-initiation-additional-clinical-notes", visitId], details);
      setSaveError(null);
      setOpen(false);
      showToast("Additional clinical notes saved.", "success");
    },
    onError: (error) => {
      setSaveError(error instanceof ApiError
        ? error.message
        : "Couldn't save the additional clinical notes. Try again.");
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
        icon={<StickyNote className="size-4" aria-hidden />}
        onClick={() => {
          setSaveError(null);
          setOpen(true);
        }}
      >
        Additional Clinical Notes
      </Button>

      <Modal
        open={open}
        size="lg"
        title="Additional Clinical Notes"
        description="Record additional clinical notes for this Adult ART Initiation visit."
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
              disabled={notesQuery.isLoading || notesQuery.isError}
              onClick={() => save.mutate()}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {notesQuery.isError && (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-danger-50 p-3">
              <p className="text-[13px] text-danger-700">Couldn't load saved additional clinical notes.</p>
              <Button variant="secondary" size="md" onClick={() => notesQuery.refetch()}>
                Try again
              </Button>
            </div>
          )}
          {notesQuery.isLoading ? (
            <p className="text-[13px] text-text-secondary">Loading saved notes…</p>
          ) : (
            <>
              {notesQuery.data ? (
                <p className="rounded-lg bg-brand-50 px-3.5 py-3 text-[12.5px] text-brand-800">
                  Additional clinical notes are saved for this visit. Saving changes will update them. Reset clears
                  the form; saved notes change only when you save.
                  <span className="mt-1 block text-brand-700">
                    Last saved by {notesQuery.data.updatedByName ?? "Clinical staff"} · {formatUpdatedAt(notesQuery.data.updatedAt)}
                  </span>
                </p>
              ) : !notesQuery.isError ? (
                <p role="status" className="rounded-lg bg-surface-sunken px-3.5 py-3 text-[13px] text-text-secondary">
                  No additional clinical notes are saved for this visit yet.
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
                  placeholder="Enter additional clinical notes"
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
