import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, RotateCcw } from "lucide-react";
import { ApiError } from "@/shared/api/client";
import {
  getArtInitiationTbScreening,
  saveArtInitiationTbScreening,
  type ArtInitiationTbScreening,
  type SaveArtInitiationTbScreeningPayload,
} from "@/shared/api/artInitiationTbScreening";
import { Button } from "@/shared/components/Button";
import { useToast } from "@/shared/components/toast/ToastProvider";
import { Modal } from "@/pharmacy/components/Modal";

type TbScreeningDraft = Omit<SaveArtInitiationTbScreeningPayload, "smearDateResult" | "clinicalIndication"> & {
  smearDateResult: string;
  clinicalIndication: string;
};

const EMPTY_DRAFT: TbScreeningDraft = {
  previousTb: null,
  previousTbYear: null,
  previousTbExtraPulmonary: null,
  previousTbPulmonary: null,
  currentTb: null,
  currentTbExtraPulmonary: null,
  currentTbPulmonary: null,
  currentTbTreatmentStartDate: null,
  symptomCoughOverTwoWeeks: null,
  symptomWeightLoss: null,
  symptomFever: null,
  symptomNightSweats: null,
  symptomHaemoptysis: null,
  symptomFatigue: null,
  smearDateResult: "",
  cultureSensitivityDateResult: null,
  clinicalIndication: "",
};

const inputClass =
  "h-11 w-full rounded-lg border border-border-strong bg-surface-raised px-3 text-sm text-text-primary outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";
const textAreaClass =
  "min-h-24 w-full resize-y rounded-lg border border-border-strong bg-surface-raised px-3 py-2.5 text-sm text-text-primary outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

function YesNoField({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: boolean | null;
  onChange: (value: boolean) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-[12.5px] font-medium text-text-primary">{label}</legend>
      <div className="flex gap-5">
        {([true, false] as const).map((answer) => (
          <label key={String(answer)} className="flex items-center gap-2 text-[13px] text-text-primary">
            <input
              type="radio"
              name={name}
              checked={value === answer}
              onChange={() => onChange(answer)}
              className="size-4 accent-brand-600"
            />
            {answer ? "Yes" : "No"}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function formatUpdatedAt(value: string): string {
  return new Date(value).toLocaleString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ArtInitiationTbScreeningForm({ visitId }: { visitId: string }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<TbScreeningDraft>(EMPTY_DRAFT);
  const [saveError, setSaveError] = useState<string | null>(null);
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1980 + 1 }, (_, index) => currentYear - index);

  const screeningQuery = useQuery({
    queryKey: ["art-initiation-tb-screening", visitId],
    queryFn: () => getArtInitiationTbScreening(visitId),
    enabled: open,
  });

  useEffect(() => {
    if (!open || screeningQuery.data === undefined) return;
    const saved: ArtInitiationTbScreening | null = screeningQuery.data;
    if (!saved) {
      setDraft(EMPTY_DRAFT);
      return;
    }
    setDraft({
      previousTb: saved.previousTb,
      previousTbYear: saved.previousTbYear,
      previousTbExtraPulmonary: saved.previousTbExtraPulmonary,
      previousTbPulmonary: saved.previousTbPulmonary,
      currentTb: saved.currentTb,
      currentTbExtraPulmonary: saved.currentTbExtraPulmonary,
      currentTbPulmonary: saved.currentTbPulmonary,
      currentTbTreatmentStartDate: saved.currentTbTreatmentStartDate,
      symptomCoughOverTwoWeeks: saved.symptomCoughOverTwoWeeks,
      symptomWeightLoss: saved.symptomWeightLoss,
      symptomFever: saved.symptomFever,
      symptomNightSweats: saved.symptomNightSweats,
      symptomHaemoptysis: saved.symptomHaemoptysis,
      symptomFatigue: saved.symptomFatigue,
      smearDateResult: saved.smearDateResult ?? "",
      cultureSensitivityDateResult: saved.cultureSensitivityDateResult,
      clinicalIndication: saved.clinicalIndication ?? "",
    });
  }, [open, screeningQuery.data]);

  const save = useMutation({
    mutationFn: () => {
      const payload: SaveArtInitiationTbScreeningPayload = {
        ...draft,
        previousTbYear: draft.previousTb === true ? draft.previousTbYear : null,
        previousTbExtraPulmonary: draft.previousTb === true ? draft.previousTbExtraPulmonary : null,
        previousTbPulmonary: draft.previousTb === true ? draft.previousTbPulmonary : null,
        currentTbExtraPulmonary: draft.currentTb === true ? draft.currentTbExtraPulmonary : null,
        currentTbPulmonary: draft.currentTb === true ? draft.currentTbPulmonary : null,
        currentTbTreatmentStartDate: draft.currentTb === true ? draft.currentTbTreatmentStartDate : null,
        smearDateResult: draft.smearDateResult.trim() || null,
        clinicalIndication: draft.clinicalIndication.trim() || null,
      };
      return saveArtInitiationTbScreening(visitId, payload);
    },
    onSuccess: (screening) => {
      queryClient.setQueryData(["art-initiation-tb-screening", visitId], screening);
      setSaveError(null);
      setOpen(false);
      showToast("TB screening details saved.", "success");
    },
    onError: (error) => {
      setSaveError(error instanceof ApiError ? error.message : "Couldn't save TB screening details. Try again.");
    },
  });

  function updateDraft(patch: Partial<TbScreeningDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
    setSaveError(null);
  }

  function resetDraft() {
    setDraft(EMPTY_DRAFT);
    setSaveError(null);
  }

  const hasSavedRecord = screeningQuery.data !== null && screeningQuery.data !== undefined;

  return (
    <>
      <Button
        variant="secondary"
        size="md"
        icon={<ClipboardCheck className="size-4" aria-hidden />}
        onClick={() => {
          setSaveError(null);
          setOpen(true);
        }}
      >
        Capture TB Screening Details
      </Button>

      <Modal
        open={open}
        size="lg"
        title="Capture TB Screening Details"
        description="Record previous TB, current TB, and symptoms for this Adult ART Initiation visit."
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
              disabled={screeningQuery.isLoading || screeningQuery.isError}
              onClick={() => save.mutate()}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          {screeningQuery.isError && (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-danger-50 p-3">
              <p className="text-[13px] text-danger-700">Couldn't load saved TB screening details.</p>
              <Button variant="secondary" size="md" onClick={() => screeningQuery.refetch()}>
                Try again
              </Button>
            </div>
          )}
          {screeningQuery.isLoading ? (
            <p className="text-[13px] text-text-secondary">Loading saved TB screening details…</p>
          ) : (
            <>
              {hasSavedRecord ? (
                <p className="rounded-lg bg-brand-50 px-3.5 py-3 text-[12.5px] text-brand-800">
                  TB screening details are saved for this visit. Saving changes will update them. Reset clears the
                  form; saved details change only when you save.
                  {screeningQuery.data?.updatedByName && (
                    <span className="mt-1 block text-brand-700">
                      Last saved by {screeningQuery.data.updatedByName} · {formatUpdatedAt(screeningQuery.data.updatedAt)}
                    </span>
                  )}
                </p>
              ) : !screeningQuery.isError ? (
                <p role="status" className="rounded-lg bg-surface-sunken px-3.5 py-3 text-[13px] text-text-secondary">
                  No TB screening record exists for this visit yet. Enter the details and save them.
                </p>
              ) : null}

              <section className="flex flex-col gap-4 rounded-xl border border-border-subtle p-4">
                <h3 className="text-sm font-semibold text-text-primary">Previous TB</h3>
                <YesNoField
                  label="Has the patient ever had TB?"
                  name="previous-tb"
                  value={draft.previousTb}
                  onChange={(value) => updateDraft({
                    previousTb: value,
                    ...(value ? {} : { previousTbYear: null, previousTbExtraPulmonary: null, previousTbPulmonary: null }),
                  })}
                />
                {draft.previousTb === true && (
                  <div className="grid grid-cols-1 gap-4 border-l-2 border-brand-200 pl-4 sm:grid-cols-2">
                    <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-text-primary">
                      Year
                      <select
                        className={inputClass}
                        value={draft.previousTbYear ?? ""}
                        onChange={(event) => updateDraft({ previousTbYear: event.target.value ? Number(event.target.value) : null })}
                      >
                        <option value="">Select year</option>
                        {years.map((year) => <option key={year} value={year}>{year}</option>)}
                      </select>
                    </label>
                    <YesNoField
                      label="Extra-pulmonary"
                      name="previous-tb-extra-pulmonary"
                      value={draft.previousTbExtraPulmonary}
                      onChange={(value) => updateDraft({ previousTbExtraPulmonary: value })}
                    />
                    <YesNoField
                      label="Pulmonary"
                      name="previous-tb-pulmonary"
                      value={draft.previousTbPulmonary}
                      onChange={(value) => updateDraft({ previousTbPulmonary: value })}
                    />
                  </div>
                )}
              </section>

              <section className="flex flex-col gap-4 rounded-xl border border-border-subtle p-4">
                <h3 className="text-sm font-semibold text-text-primary">Current TB</h3>
                <YesNoField
                  label="Does the patient currently have TB?"
                  name="current-tb"
                  value={draft.currentTb}
                  onChange={(value) => updateDraft({
                    currentTb: value,
                    ...(value ? {} : {
                      currentTbExtraPulmonary: null,
                      currentTbPulmonary: null,
                      currentTbTreatmentStartDate: null,
                    }),
                  })}
                />
                {draft.currentTb === true && (
                  <div className="grid grid-cols-1 gap-4 border-l-2 border-brand-200 pl-4 sm:grid-cols-2">
                    <YesNoField
                      label="Extra-pulmonary"
                      name="current-tb-extra-pulmonary"
                      value={draft.currentTbExtraPulmonary}
                      onChange={(value) => updateDraft({ currentTbExtraPulmonary: value })}
                    />
                    <YesNoField
                      label="Pulmonary"
                      name="current-tb-pulmonary"
                      value={draft.currentTbPulmonary}
                      onChange={(value) => updateDraft({ currentTbPulmonary: value })}
                    />
                    <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-text-primary">
                      Date commenced treatment
                      <input
                        type="date"
                        className={inputClass}
                        value={draft.currentTbTreatmentStartDate ?? ""}
                        onChange={(event) => updateDraft({ currentTbTreatmentStartDate: event.target.value || null })}
                      />
                    </label>
                  </div>
                )}
              </section>

              <section className="flex flex-col gap-4 rounded-xl border border-border-subtle p-4">
                <h3 className="text-sm font-semibold text-text-primary">TB Symptoms Today</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <YesNoField label="Cough more than 2 weeks" name="symptom-cough" value={draft.symptomCoughOverTwoWeeks} onChange={(value) => updateDraft({ symptomCoughOverTwoWeeks: value })} />
                  <YesNoField label="Weight loss" name="symptom-weight-loss" value={draft.symptomWeightLoss} onChange={(value) => updateDraft({ symptomWeightLoss: value })} />
                  <YesNoField label="Fever" name="symptom-fever" value={draft.symptomFever} onChange={(value) => updateDraft({ symptomFever: value })} />
                  <YesNoField label="Night sweats" name="symptom-night-sweats" value={draft.symptomNightSweats} onChange={(value) => updateDraft({ symptomNightSweats: value })} />
                  <YesNoField label="Haemoptysis" name="symptom-haemoptysis" value={draft.symptomHaemoptysis} onChange={(value) => updateDraft({ symptomHaemoptysis: value })} />
                  <YesNoField label="Fatigue" name="symptom-fatigue" value={draft.symptomFatigue} onChange={(value) => updateDraft({ symptomFatigue: value })} />
                </div>
                <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-text-primary">
                  Smear Date Result
                  <textarea
                    className={textAreaClass}
                    maxLength={10_000}
                    value={draft.smearDateResult}
                    onChange={(event) => updateDraft({ smearDateResult: event.target.value })}
                    placeholder="Enter smear date and result details"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-text-primary">
                  Culture/Sensitivity Date Result
                  <input
                    type="date"
                    className={inputClass}
                    value={draft.cultureSensitivityDateResult ?? ""}
                    onChange={(event) => updateDraft({ cultureSensitivityDateResult: event.target.value || null })}
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-text-primary">
                  Clinical Indication of TB
                  <textarea
                    className={textAreaClass}
                    maxLength={10_000}
                    value={draft.clinicalIndication}
                    onChange={(event) => updateDraft({ clinicalIndication: event.target.value })}
                    placeholder="Enter clinical indication details"
                  />
                </label>
              </section>
              {saveError && <p role="alert" className="text-[13px] text-danger-700">{saveError}</p>}
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
