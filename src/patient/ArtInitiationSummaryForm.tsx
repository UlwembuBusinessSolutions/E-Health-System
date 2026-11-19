import { useEffect, useId, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, RotateCcw } from "lucide-react";
import { ApiError } from "@/shared/api/client";
import {
  getArtInitiationSummary,
  saveArtInitiationSummary,
  type ArtPriorTherapy,
} from "@/shared/api/artInitiationSummary";
import { Button } from "@/shared/components/Button";
import { Modal } from "@/pharmacy/components/Modal";

interface ArtInitiationSummaryDraft {
  artStartDate: string;
  hivDiagnosisYear: string;
  priorTherapy: ArtPriorTherapy | "";
  details: string;
}

const EMPTY_DRAFT: ArtInitiationSummaryDraft = {
  artStartDate: "",
  hivDiagnosisYear: "",
  priorTherapy: "",
  details: "",
};

const PRIOR_THERAPY_OPTIONS: { value: ArtPriorTherapy; label: string }[] = [
  { value: "NONE", label: "NONE" },
  { value: "PMTCT", label: "PMTCT" },
  { value: "HAART", label: "HAART" },
  { value: "PEP", label: "PEP" },
];

const inputClass =
  "h-11 w-full rounded-lg border border-border-strong bg-surface-raised px-3 text-sm text-text-primary outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

export function ArtInitiationSummaryForm({ visitId }: { visitId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ArtInitiationSummaryDraft>(EMPTY_DRAFT);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const radioGroupName = useId();
  const currentYear = new Date().getFullYear();
  const hivYears = Array.from({ length: currentYear - 1980 + 1 }, (_, index) => 1980 + index);

  const summaryQuery = useQuery({
    queryKey: ["art-initiation-summary", visitId],
    queryFn: () => getArtInitiationSummary(visitId),
    enabled: open,
  });

  useEffect(() => {
    if (!open || summaryQuery.data === undefined) return;
    const saved = summaryQuery.data;
    setDraft(saved
      ? {
          artStartDate: saved.artStartDate ?? "",
          hivDiagnosisYear: saved.hivDiagnosisYear?.toString() ?? "",
          priorTherapy: saved.priorTherapy ?? "",
          details: saved.details ?? "",
        }
      : EMPTY_DRAFT);
  }, [open, summaryQuery.data]);

  const save = useMutation({
    mutationFn: () =>
      saveArtInitiationSummary(visitId, {
        artStartDate: draft.artStartDate || null,
        hivDiagnosisYear: draft.hivDiagnosisYear ? Number(draft.hivDiagnosisYear) : null,
        priorTherapy: draft.priorTherapy || null,
        details: draft.details.trim() || null,
      }),
    onSuccess: (summary) => {
      queryClient.setQueryData(["art-initiation-summary", visitId], summary);
      setSaveError(null);
      setSavedMessage("ART summary details saved.");
    },
    onError: (error) => {
      setSaveError(
        error instanceof ApiError ? error.message : "Couldn't save the ART summary details. Try again.",
      );
    },
  });

  function updateDraft(patch: Partial<ArtInitiationSummaryDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
    setSaveError(null);
    setSavedMessage(null);
  }

  function resetDraft() {
    setDraft(EMPTY_DRAFT);
    setSaveError(null);
    setSavedMessage(null);
  }

  return (
    <>
      <Button
        variant="secondary"
        size="md"
        icon={<ClipboardCheck className="size-4" aria-hidden />}
        onClick={() => {
          setSaveError(null);
          setSavedMessage(null);
          setOpen(true);
        }}
      >
        Capture ART Summary Details
      </Button>

      <Modal
        open={open}
        size="lg"
        title="Capture ART Summary Details"
        description="Record the patient's ART initiation summary for this visit. All fields are optional."
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
              disabled={summaryQuery.isLoading || summaryQuery.isError}
              onClick={() => save.mutate()}
            >
              Save details
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          {summaryQuery.isError && (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-danger-50 p-3">
              <p className="text-[13px] text-danger-700">Couldn’t load the saved ART summary details.</p>
              <Button variant="secondary" size="md" onClick={() => summaryQuery.refetch()}>
                Try again
              </Button>
            </div>
          )}

          {summaryQuery.isLoading ? (
            <p className="text-[13px] text-text-secondary">Loading saved summary…</p>
          ) : (
            <>
              {summaryQuery.data && (
                <p className="rounded-lg bg-brand-50 px-3.5 py-3 text-[12.5px] text-brand-800">
                  A summary is already saved for this visit. Saving changes will update it. Reset only clears
                  the form; saved data changes only when you save.
                  {summaryQuery.data.updatedByName && (
                    <span className="block mt-1 text-brand-700">
                      Last saved by {summaryQuery.data.updatedByName} ·{" "}
                      {new Date(summaryQuery.data.updatedAt).toLocaleString("en-ZA", {
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

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-text-primary">
                  ART Start Date
                  <input
                    type="date"
                    className={inputClass}
                    value={draft.artStartDate}
                    onChange={(event) => updateDraft({ artStartDate: event.target.value })}
                  />
                </label>

                <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-text-primary">
                  HIV Year (diagnosis year)
                  <select
                    className={inputClass}
                    value={draft.hivDiagnosisYear}
                    onChange={(event) => updateDraft({ hivDiagnosisYear: event.target.value })}
                  >
                    <option value="">Select year</option>
                    {hivYears.map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </label>

                <fieldset className="flex flex-col gap-2 sm:col-span-2">
                  <legend className="mb-1 text-[13px] font-medium text-text-primary">
                    HAART (Highly Active Anti-Retroviral Therapy) prior to ART Start Date?
                  </legend>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {PRIOR_THERAPY_OPTIONS.map((option) => (
                      <label
                        key={option.value}
                        className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-400 ${
                          draft.priorTherapy === option.value
                            ? "border-brand-500 bg-brand-50"
                            : "border-border-strong bg-surface-raised hover:bg-surface-sunken"
                        }`}
                      >
                        <input
                          type="radio"
                          name={radioGroupName}
                          value={option.value}
                          checked={draft.priorTherapy === option.value}
                          onChange={() => updateDraft({ priorTherapy: option.value })}
                          className="accent-brand-600"
                        />
                        <span className="text-[13px] font-medium text-text-primary">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-text-primary sm:col-span-2">
                  Details
                  <textarea
                    maxLength={10_000}
                    rows={4}
                    className="w-full rounded-lg border border-border-strong bg-surface-raised px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                    placeholder="Enter any relevant ART initiation details"
                    value={draft.details}
                    onChange={(event) => updateDraft({ details: event.target.value })}
                  />
                </label>
              </div>
            </>
          )}

          {saveError && <p role="alert" className="text-[13px] text-danger-600">{saveError}</p>}
          {savedMessage && <p role="status" className="text-[13px] text-success-700">{savedMessage}</p>}
        </div>
      </Modal>
    </>
  );
}
