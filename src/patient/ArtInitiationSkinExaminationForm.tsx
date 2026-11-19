import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fingerprint, RotateCcw } from "lucide-react";
import { ApiError } from "@/shared/api/client";
import {
  getArtInitiationSkinExamination,
  saveArtInitiationSkinExamination,
  type ArtInitiationSkinExamination,
  type SkinExaminationFinding,
} from "@/shared/api/artInitiationSkinExamination";
import { Button } from "@/shared/components/Button";
import { useToast } from "@/shared/components/toast/ToastProvider";
import { Modal } from "@/pharmacy/components/Modal";

const EMPTY_DRAFT = {
  finding: null as SkinExaminationFinding | null,
  normalComment: "",
  abnormalComment: "",
};
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

export function ArtInitiationSkinExaminationForm({ visitId }: { visitId: string }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [saveError, setSaveError] = useState<string | null>(null);

  const examinationQuery = useQuery({
    queryKey: ["art-initiation-skin-examination", visitId],
    queryFn: () => getArtInitiationSkinExamination(visitId),
    enabled: open,
  });

  useEffect(() => {
    if (!open || examinationQuery.data === undefined) return;
    const saved: ArtInitiationSkinExamination | null = examinationQuery.data;
    setDraft(saved ? {
      finding: saved.finding,
      normalComment: saved.normalComment ?? "",
      abnormalComment: saved.abnormalComment ?? "",
    } : EMPTY_DRAFT);
  }, [open, examinationQuery.data]);

  const save = useMutation({
    mutationFn: () => saveArtInitiationSkinExamination(visitId, {
      finding: draft.finding,
      normalComment: draft.finding === "NORMAL" ? draft.normalComment.trim() || null : null,
      abnormalComment: draft.finding === "ABNORMAL" ? draft.abnormalComment.trim() || null : null,
    }),
    onSuccess: (details) => {
      queryClient.setQueryData(["art-initiation-skin-examination", visitId], details);
      setSaveError(null);
      setOpen(false);
      showToast("Skin examination details saved.", "success");
    },
    onError: (error) => {
      setSaveError(error instanceof ApiError
        ? error.message
        : "Couldn't save the skin examination details. Try again.");
    },
  });

  function resetDraft() {
    setDraft(EMPTY_DRAFT);
    setSaveError(null);
  }

  function selectFinding(finding: SkinExaminationFinding) {
    setDraft((current) => ({
      finding,
      normalComment: finding === "NORMAL" ? current.normalComment : "",
      abnormalComment: finding === "ABNORMAL" ? current.abnormalComment : "",
    }));
    setSaveError(null);
  }

  return (
    <>
      <Button
        variant="secondary"
        size="md"
        icon={<Fingerprint className="size-4" aria-hidden />}
        onClick={() => {
          setSaveError(null);
          setOpen(true);
        }}
      >
        Capture Skin Examination
      </Button>

      <Modal
        open={open}
        size="lg"
        title="Capture Skin Examination"
        description="Record the skin examination finding and related comments for this Adult ART Initiation visit."
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
              disabled={examinationQuery.isLoading || examinationQuery.isError}
              onClick={() => save.mutate()}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {examinationQuery.isError && (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-danger-50 p-3">
              <p className="text-[13px] text-danger-700">Couldn't load saved skin examination details.</p>
              <Button variant="secondary" size="md" onClick={() => examinationQuery.refetch()}>
                Try again
              </Button>
            </div>
          )}
          {examinationQuery.isLoading ? (
            <p className="text-[13px] text-text-secondary">Loading saved examination…</p>
          ) : (
            <>
              {examinationQuery.data ? (
                <p className="rounded-lg bg-brand-50 px-3.5 py-3 text-[12.5px] text-brand-800">
                  Skin examination details are saved for this visit. Saving changes will update them. Reset clears
                  the form; saved details change only when you save.
                  <span className="mt-1 block text-brand-700">
                    Last saved by {examinationQuery.data.updatedByName ?? "Clinical staff"} · {formatUpdatedAt(examinationQuery.data.updatedAt)}
                  </span>
                </p>
              ) : !examinationQuery.isError ? (
                <p role="status" className="rounded-lg bg-surface-sunken px-3.5 py-3 text-[13px] text-text-secondary">
                  No skin examination record exists for this visit yet.
                </p>
              ) : null}

              <fieldset className="flex flex-col gap-3">
                <legend className="text-[13px] font-semibold text-text-primary">Skin examination finding</legend>
                <div className="flex flex-wrap gap-5">
                  {(["NORMAL", "ABNORMAL"] as const).map((finding) => (
                    <label key={finding} className="flex items-center gap-2 text-[13px] text-text-primary">
                      <input
                        type="radio"
                        name="skin-examination-finding"
                        checked={draft.finding === finding}
                        onChange={() => selectFinding(finding)}
                        className="size-4 accent-brand-600"
                      />
                      {finding === "NORMAL" ? "Normal" : "Abnormal"}
                    </label>
                  ))}
                </div>
              </fieldset>

              {draft.finding === "NORMAL" && (
                <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-text-primary">
                  Normal comment
                  <textarea
                    className={textareaClass}
                    maxLength={10_000}
                    value={draft.normalComment}
                    onChange={(event) => {
                      setDraft((current) => ({ ...current, normalComment: event.target.value }));
                      setSaveError(null);
                    }}
                    placeholder="Enter details for the normal finding"
                  />
                </label>
              )}
              {draft.finding === "ABNORMAL" && (
                <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-text-primary">
                  Abnormal comment
                  <textarea
                    className={textareaClass}
                    maxLength={10_000}
                    value={draft.abnormalComment}
                    onChange={(event) => {
                      setDraft((current) => ({ ...current, abnormalComment: event.target.value }));
                      setSaveError(null);
                    }}
                    placeholder="Enter details for the abnormal finding"
                  />
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
