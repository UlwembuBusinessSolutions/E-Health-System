import { useEffect, useId, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, RotateCcw } from "lucide-react";
import { ApiError } from "@/shared/api/client";
import {
  getArtEyesExamination,
  saveArtEyesExamination,
  type EyeExaminationResult,
} from "@/shared/api/artEyesExamination";
import { Button } from "@/shared/components/Button";
import { Modal } from "@/pharmacy/components/Modal";

const OPTIONS: { value: EyeExaminationResult; label: string }[] = [
  { value: "NORMAL", label: "Normal" },
  { value: "ABNORMAL", label: "Abnormal" },
];

export function ArtEyesExaminationForm({ visitId }: { visitId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<EyeExaminationResult | "">("");
  const [comments, setComments] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const radioGroupName = useId();

  const examinationQuery = useQuery({
    queryKey: ["art-eyes-examination", visitId],
    queryFn: () => getArtEyesExamination(visitId),
    enabled: open,
  });

  useEffect(() => {
    if (!open || examinationQuery.data === undefined) return;
    setResult(examinationQuery.data?.result ?? "");
    setComments(examinationQuery.data?.comments ?? "");
  }, [open, examinationQuery.data]);

  const save = useMutation({
    mutationFn: (values: { result: EyeExaminationResult; comments: string }) =>
      saveArtEyesExamination(visitId, values.result, values.comments),
    onSuccess: (examination) => {
      queryClient.setQueryData(["art-eyes-examination", visitId], examination);
      setSaveError(null);
      setSavedMessage("Eyes examination saved.");
    },
    onError: (error) => {
      setSaveError(
        error instanceof ApiError ? error.message : "Couldn't save the eyes examination. Try again.",
      );
    },
  });

  function resetForm() {
    setResult("");
    setComments("");
    setSaveError(null);
    setSavedMessage(null);
  }

  return (
    <>
      <Button
        variant="secondary"
        size="md"
        icon={<Eye className="size-4" aria-hidden />}
        onClick={() => {
          setSaveError(null);
          setSavedMessage(null);
          setOpen(true);
        }}
      >
        Capture Eyes Examination
      </Button>

      <Modal
        open={open}
        size="md"
        title="Capture Eyes Examination"
        description="Select the examination result. A saved result can be updated for this visit."
        dismissible={!save.isPending}
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="secondary" disabled={save.isPending} onClick={resetForm}>
              <RotateCcw className="mr-1.5 size-3.5" aria-hidden />
              Reset
            </Button>
            <Button
              variant="primary"
              loading={save.isPending}
              disabled={!result || examinationQuery.isLoading || examinationQuery.isError}
              onClick={() => {
                if (result) save.mutate({ result, comments });
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {examinationQuery.isError && (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-danger-50 p-3">
              <p className="text-[13px] text-danger-700">Couldn’t load the saved eyes examination.</p>
              <Button variant="secondary" size="md" onClick={() => examinationQuery.refetch()}>
                Try again
              </Button>
            </div>
          )}

          {examinationQuery.isLoading ? (
            <p className="text-[13px] text-text-secondary">Loading saved examination…</p>
          ) : (
            <>
              {examinationQuery.data && (
                <p className="rounded-lg bg-brand-50 px-3.5 py-3 text-[12.5px] text-brand-800">
                  A result is saved for this visit. Saving a new selection will update it; Reset only clears
                  the current form.
                  {examinationQuery.data.recordedByName && (
                    <span className="mt-1 block text-brand-700">
                      Last saved by {examinationQuery.data.recordedByName} ·{" "}
                      {new Date(examinationQuery.data.updatedAt).toLocaleString("en-ZA", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </p>
              )}

              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-[13px] font-medium text-text-primary">
                  Eyes Examination <span className="text-danger-600" aria-hidden="true">*</span>
                </legend>
                {OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3.5 py-2.5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-400 ${
                      result === option.value
                        ? "border-brand-500 bg-brand-50"
                        : "border-border-strong bg-surface-raised hover:bg-surface-sunken"
                    }`}
                  >
                    <input
                      type="radio"
                      name={radioGroupName}
                      value={option.value}
                      checked={result === option.value}
                      onChange={() => {
                        setResult(option.value);
                        setSaveError(null);
                        setSavedMessage(null);
                      }}
                      className="accent-brand-600"
                    />
                    <span className="text-[13px] font-medium text-text-primary">{option.label}</span>
                  </label>
                ))}
              </fieldset>

              {result && (
                <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-text-primary">
                  Comments <span className="font-normal text-text-secondary">(optional)</span>
                  <textarea
                    maxLength={10_000}
                    rows={4}
                    className="w-full rounded-lg border border-border-strong bg-surface-raised px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                    placeholder="Add any relevant examination details"
                    value={comments}
                    onChange={(event) => {
                      setComments(event.target.value);
                      setSaveError(null);
                      setSavedMessage(null);
                    }}
                  />
                </label>
              )}
            </>
          )}

          {saveError && <p role="alert" className="text-[13px] text-danger-600">{saveError}</p>}
          {savedMessage && <p role="status" className="text-[13px] text-success-700">{savedMessage}</p>}
        </div>
      </Modal>
    </>
  );
}
