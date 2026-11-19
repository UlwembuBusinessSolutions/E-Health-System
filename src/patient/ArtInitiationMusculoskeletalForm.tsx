import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bone, RotateCcw } from "lucide-react";
import { ApiError } from "@/shared/api/client";
import {
  getArtInitiationMusculoskeletal,
  saveArtInitiationMusculoskeletal,
  type ArtInitiationMusculoskeletal,
  type MusculoskeletalFinding,
} from "@/shared/api/artInitiationMusculoskeletal";
import { Button } from "@/shared/components/Button";
import { useToast } from "@/shared/components/toast/ToastProvider";
import { Modal } from "@/pharmacy/components/Modal";

const EMPTY_DRAFT = { finding: null as MusculoskeletalFinding | null, comment: "" };
const textareaClass =
  "min-h-28 w-full resize-y rounded-lg border border-border-strong bg-surface-raised px-3 py-2.5 text-sm text-text-primary outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

function formatUpdatedAt(value: string): string {
  return new Date(value).toLocaleString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ArtInitiationMusculoskeletalForm({ visitId }: { visitId: string }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [saveError, setSaveError] = useState<string | null>(null);

  const detailsQuery = useQuery({
    queryKey: ["art-initiation-musculoskeletal", visitId],
    queryFn: () => getArtInitiationMusculoskeletal(visitId),
    enabled: open,
  });

  useEffect(() => {
    if (!open || detailsQuery.data === undefined) return;
    const saved: ArtInitiationMusculoskeletal | null = detailsQuery.data;
    setDraft(saved ? { finding: saved.finding, comment: saved.comment ?? "" } : EMPTY_DRAFT);
  }, [open, detailsQuery.data]);

  const save = useMutation({
    mutationFn: () => saveArtInitiationMusculoskeletal(
      visitId,
      draft.finding,
      draft.finding ? draft.comment.trim() || null : null,
    ),
    onSuccess: (details) => {
      queryClient.setQueryData(["art-initiation-musculoskeletal", visitId], details);
      setSaveError(null);
      setOpen(false);
      showToast("Musculoskeletal findings saved.", "success");
    },
    onError: (error) => {
      setSaveError(error instanceof ApiError ? error.message : "Couldn't save musculoskeletal findings. Try again.");
    },
  });

  function resetDraft() {
    setDraft(EMPTY_DRAFT);
    setSaveError(null);
  }

  return (
    <>
      <Button
        variant="secondary"
        size="md"
        icon={<Bone className="size-4" aria-hidden />}
        onClick={() => {
          setSaveError(null);
          setOpen(true);
        }}
      >
        Capture Musculoskeletal
      </Button>

      <Modal
        open={open}
        size="lg"
        title="Capture Musculoskeletal"
        description="Record the musculoskeletal examination finding for this Adult ART Initiation visit."
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
              disabled={detailsQuery.isLoading || detailsQuery.isError}
              onClick={() => save.mutate()}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {detailsQuery.isError && (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-danger-50 p-3">
              <p className="text-[13px] text-danger-700">Couldn't load saved musculoskeletal findings.</p>
              <Button variant="secondary" size="md" onClick={() => detailsQuery.refetch()}>
                Try again
              </Button>
            </div>
          )}
          {detailsQuery.isLoading ? (
            <p className="text-[13px] text-text-secondary">Loading saved findings…</p>
          ) : (
            <>
              {detailsQuery.data ? (
                <p className="rounded-lg bg-brand-50 px-3.5 py-3 text-[12.5px] text-brand-800">
                  Musculoskeletal findings are saved for this visit. Saving changes will update them. Reset clears the
                  form; saved details change only when you save.
                  <span className="mt-1 block text-brand-700">
                    Last saved by {detailsQuery.data.updatedByName ?? "Clinical staff"} · {formatUpdatedAt(detailsQuery.data.updatedAt)}
                  </span>
                </p>
              ) : !detailsQuery.isError ? (
                <p role="status" className="rounded-lg bg-surface-sunken px-3.5 py-3 text-[13px] text-text-secondary">
                  No musculoskeletal findings are saved for this visit yet.
                </p>
              ) : null}
              <fieldset className="flex flex-col gap-3">
                <legend className="text-[13px] font-semibold text-text-primary">Musculoskeletal finding</legend>
                <div className="flex flex-wrap gap-5">
                  {(["NORMAL", "ABNORMAL"] as const).map((finding) => (
                    <label key={finding} className="flex items-center gap-2 text-[13px] text-text-primary">
                      <input
                        type="radio"
                        name="musculoskeletal-finding"
                        checked={draft.finding === finding}
                        onChange={() => {
                          setDraft((current) => ({ ...current, finding }));
                          setSaveError(null);
                        }}
                        className="size-4 accent-brand-600"
                      />
                      {finding === "NORMAL" ? "Normal" : "Abnormal"}
                    </label>
                  ))}
                </div>
              </fieldset>
              {draft.finding && (
                <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-text-primary">
                  Comment
                  <textarea
                    className={textareaClass}
                    maxLength={10_000}
                    value={draft.comment}
                    onChange={(event) => {
                      setDraft((current) => ({ ...current, comment: event.target.value }));
                      setSaveError(null);
                    }}
                    placeholder="Enter musculoskeletal examination comments"
                  />
                  <span className="text-right text-[11px] font-normal text-text-secondary">
                    {draft.comment.length}/10,000 characters
                  </span>
                </label>
              )}
              {saveError && <p role="alert" className="text-[13px] text-danger-700">{saveError}</p>}
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
