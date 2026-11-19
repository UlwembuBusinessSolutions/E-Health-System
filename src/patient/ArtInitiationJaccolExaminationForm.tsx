import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Stethoscope } from "lucide-react";
import { ApiError } from "@/shared/api/client";
import {
  getArtInitiationJaccolExamination,
  saveArtInitiationJaccolExamination,
  type ArtInitiationJaccolExamination,
  type JaccolStatus,
  type SaveArtInitiationJaccolExaminationPayload,
} from "@/shared/api/artInitiationJaccolExamination";
import { Button } from "@/shared/components/Button";
import { useToast } from "@/shared/components/toast/ToastProvider";
import { Modal } from "@/pharmacy/components/Modal";

type JaccolDraft = Omit<SaveArtInitiationJaccolExaminationPayload,
  "jComment" | "aComment" | "c1Comment" | "c2Comment" | "oComment" | "lComment" | "otherComment" | "notes"> & {
  jComment: string;
  aComment: string;
  c1Comment: string;
  c2Comment: string;
  oComment: string;
  lComment: string;
  otherComment: string;
  notes: string;
};

const EMPTY_DRAFT: JaccolDraft = {
  jStatus: null, jComment: "",
  aStatus: null, aComment: "",
  c1Status: null, c1Comment: "",
  c2Status: null, c2Comment: "",
  oStatus: null, oComment: "",
  lStatus: null, lComment: "",
  otherComment: "",
  notes: "",
};

const textareaClass =
  "min-h-24 w-full resize-y rounded-lg border border-border-strong bg-surface-raised px-3 py-2.5 text-sm text-text-primary outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

const JACCOL_ITEMS = [
  { key: "j", label: "J", statusKey: "jStatus", commentKey: "jComment" },
  { key: "a", label: "A", statusKey: "aStatus", commentKey: "aComment" },
  { key: "c1", label: "C", statusKey: "c1Status", commentKey: "c1Comment" },
  { key: "c2", label: "C", statusKey: "c2Status", commentKey: "c2Comment" },
  { key: "o", label: "O", statusKey: "oStatus", commentKey: "oComment" },
  { key: "l", label: "L", statusKey: "lStatus", commentKey: "lComment" },
] as const;

function formatUpdatedAt(value: string): string {
  return new Date(value).toLocaleString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ArtInitiationJaccolExaminationForm({ visitId }: { visitId: string }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<JaccolDraft>(EMPTY_DRAFT);
  const [saveError, setSaveError] = useState<string | null>(null);

  const examinationQuery = useQuery({
    queryKey: ["art-initiation-jaccol-examination", visitId],
    queryFn: () => getArtInitiationJaccolExamination(visitId),
    enabled: open,
  });

  useEffect(() => {
    if (!open || examinationQuery.data === undefined) return;
    const saved: ArtInitiationJaccolExamination | null = examinationQuery.data;
    if (!saved) {
      setDraft(EMPTY_DRAFT);
      return;
    }
    setDraft({
      jStatus: saved.jStatus, jComment: saved.jComment ?? "",
      aStatus: saved.aStatus, aComment: saved.aComment ?? "",
      c1Status: saved.c1Status, c1Comment: saved.c1Comment ?? "",
      c2Status: saved.c2Status, c2Comment: saved.c2Comment ?? "",
      oStatus: saved.oStatus, oComment: saved.oComment ?? "",
      lStatus: saved.lStatus, lComment: saved.lComment ?? "",
      otherComment: saved.otherComment ?? "",
      notes: saved.notes ?? "",
    });
  }, [open, examinationQuery.data]);

  const save = useMutation({
    mutationFn: () => {
      const payload: SaveArtInitiationJaccolExaminationPayload = {
        ...draft,
        jComment: draft.jStatus === "PRESENT" ? draft.jComment.trim() || null : null,
        aComment: draft.aStatus === "PRESENT" ? draft.aComment.trim() || null : null,
        c1Comment: draft.c1Status === "PRESENT" ? draft.c1Comment.trim() || null : null,
        c2Comment: draft.c2Status === "PRESENT" ? draft.c2Comment.trim() || null : null,
        oComment: draft.oStatus === "PRESENT" ? draft.oComment.trim() || null : null,
        lComment: draft.lStatus === "PRESENT" ? draft.lComment.trim() || null : null,
        otherComment: draft.otherComment.trim() || null,
        notes: draft.notes.trim() || null,
      };
      return saveArtInitiationJaccolExamination(visitId, payload);
    },
    onSuccess: (examination) => {
      queryClient.setQueryData(["art-initiation-jaccol-examination", visitId], examination);
      setSaveError(null);
      setOpen(false);
      showToast("JACCOL examination saved.", "success");
    },
    onError: (error) => {
      setSaveError(error instanceof ApiError ? error.message : "Couldn't save the JACCOL examination. Try again.");
    },
  });

  function updateStatus(statusKey: keyof JaccolDraft, commentKey: keyof JaccolDraft, status: JaccolStatus) {
    setDraft((current) => ({
      ...current,
      [statusKey]: status,
      [commentKey]: status === "PRESENT" ? current[commentKey] : "",
    }));
    setSaveError(null);
  }

  function resetDraft() {
    setDraft(EMPTY_DRAFT);
    setSaveError(null);
  }

  return (
    <>
      <Button
        variant="secondary"
        size="md"
        icon={<Stethoscope className="size-4" aria-hidden />}
        onClick={() => {
          setSaveError(null);
          setOpen(true);
        }}
      >
        Capture JACCOL Examination
      </Button>

      <Modal
        open={open}
        size="lg"
        title="Capture JACCOL Examination"
        description="Record Present or Absent findings and comments for this Adult ART Initiation visit."
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
        <div className="flex flex-col gap-5">
          {examinationQuery.isError && (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-danger-50 p-3">
              <p className="text-[13px] text-danger-700">Couldn't load saved JACCOL examination details.</p>
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
                  JACCOL examination details are saved for this visit. Saving changes will update them. Reset clears
                  the form; saved details change only when you save.
                  <span className="mt-1 block text-brand-700">
                    Last saved by {examinationQuery.data.updatedByName ?? "Clinical staff"} · {formatUpdatedAt(examinationQuery.data.updatedAt)}
                  </span>
                </p>
              ) : !examinationQuery.isError ? (
                <p role="status" className="rounded-lg bg-surface-sunken px-3.5 py-3 text-[13px] text-text-secondary">
                  No JACCOL examination record exists for this visit yet.
                </p>
              ) : null}

              <div className="flex flex-col gap-4">
                {JACCOL_ITEMS.map((item) => {
                  const status = draft[item.statusKey] as JaccolStatus | null;
                  const comment = draft[item.commentKey] as string;
                  return (
                    <section key={item.key} className="flex flex-col gap-3 rounded-xl border border-border-subtle p-4">
                      <h3 className="text-sm font-semibold text-text-primary">{item.label}</h3>
                      <fieldset>
                        <legend className="sr-only">{item.label} finding</legend>
                        <div className="flex gap-5">
                          {(["PRESENT", "ABSENT"] as const).map((value) => (
                            <label key={value} className="flex items-center gap-2 text-[13px] text-text-primary">
                              <input
                                type="radio"
                                name={`jaccol-${item.key}`}
                                checked={status === value}
                                onChange={() => updateStatus(item.statusKey, item.commentKey, value)}
                                className="size-4 accent-brand-600"
                              />
                              {value === "PRESENT" ? "Present" : "Absent"}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                      {status === "PRESENT" && (
                        <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-text-primary">
                          Comment
                          <textarea
                            className={textareaClass}
                            maxLength={10_000}
                            value={comment}
                            onChange={(event) => {
                              setDraft((current) => ({ ...current, [item.commentKey]: event.target.value }));
                              setSaveError(null);
                            }}
                            placeholder={`Enter comments for ${item.label}`}
                          />
                        </label>
                      )}
                    </section>
                  );
                })}
              </div>

              <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-text-primary">
                Other, Comment
                <textarea
                  className={textareaClass}
                  maxLength={10_000}
                  value={draft.otherComment ?? ""}
                  onChange={(event) => {
                    setDraft((current) => ({ ...current, otherComment: event.target.value }));
                    setSaveError(null);
                  }}
                  placeholder="Enter other examination findings"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-text-primary">
                Notes
                <textarea
                  className={textareaClass}
                  maxLength={10_000}
                  value={draft.notes ?? ""}
                  onChange={(event) => {
                    setDraft((current) => ({ ...current, notes: event.target.value }));
                    setSaveError(null);
                  }}
                  placeholder="Enter additional notes"
                />
              </label>
              {saveError && <p role="alert" className="text-[13px] text-danger-700">{saveError}</p>}
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
