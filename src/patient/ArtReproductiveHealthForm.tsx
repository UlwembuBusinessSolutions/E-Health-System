import { useEffect, useId, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HeartPulse, RotateCcw } from "lucide-react";
import { ApiError } from "@/shared/api/client";
import {
  getArtReproductiveHealthDetails,
  saveArtReproductiveHealthDetails,
  type ContraceptionMethod,
} from "@/shared/api/artReproductiveHealth";
import { Button } from "@/shared/components/Button";
import { Modal } from "@/pharmacy/components/Modal";

type YesNo = "YES" | "NO" | "";

type Draft = {
  pregnant: YesNo;
  trimester: string;
  gravida: string;
  para: string;
  contraceptionMethod: ContraceptionMethod | "";
  contraceptionOtherSpecify: string;
  urethralDischarge: YesNo;
  urethralDischargeComment: string;
  vaginalDischarge: YesNo;
  vaginalDischargeComment: string;
  genitalUlcers: YesNo;
  genitalUlcersComment: string;
  genitalWarts: YesNo;
  genitalWartsComment: string;
  lowerAbdominalPain: YesNo;
  lowerAbdominalPainComment: string;
  papSmearResult: string;
  papSmearDate: string;
  rprDate: string;
  results: string;
  specifyTreatmentCompleted: string;
};

const EMPTY_DRAFT: Draft = {
  pregnant: "",
  trimester: "",
  gravida: "",
  para: "",
  contraceptionMethod: "",
  contraceptionOtherSpecify: "",
  urethralDischarge: "",
  urethralDischargeComment: "",
  vaginalDischarge: "",
  vaginalDischargeComment: "",
  genitalUlcers: "",
  genitalUlcersComment: "",
  genitalWarts: "",
  genitalWartsComment: "",
  lowerAbdominalPain: "",
  lowerAbdominalPainComment: "",
  papSmearResult: "",
  papSmearDate: "",
  rprDate: "",
  results: "",
  specifyTreatmentCompleted: "",
};

const inputClass =
  "h-11 w-full rounded-lg border border-border-strong bg-surface-raised px-3 text-sm text-text-primary outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";
const yesNoOptions: { value: YesNo; label: string }[] = [
  { value: "YES", label: "Yes" },
  { value: "NO", label: "No" },
];
const contraceptionOptions: { value: ContraceptionMethod; label: string }[] = [
  { value: "NONE", label: "None" },
  { value: "CONDOM", label: "Condom" },
  { value: "INJECTION", label: "Injection" },
  { value: "PILL", label: "Pill" },
  { value: "OTHER", label: "Other" },
];

function toYesNo(value: boolean | null): YesNo {
  if (value === null) return "";
  return value ? "YES" : "NO";
}

function toNullableBoolean(value: YesNo): boolean | null {
  if (value === "") return null;
  return value === "YES";
}

function YesNoGroup({
  label,
  value,
  onChange,
}: {
  label: string;
  value: YesNo;
  onChange: (next: YesNo) => void;
}) {
  const radioName = useId();

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[13px] font-medium text-text-primary">{label}</p>
      <div className="flex gap-3">
        {yesNoOptions.map((option) => (
          <label
            key={option.value}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-medium transition-colors ${
              value === option.value
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : "border-border-strong bg-surface-raised text-text-primary"
            }`}
          >
            <input
              type="radio"
              name={radioName}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="accent-brand-600"
            />
            {option.label}
          </label>
        ))}
      </div>
    </div>
  );
}

export function ArtReproductiveHealthForm({ visitId }: { visitId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const detailQuery = useQuery({
    queryKey: ["art-reproductive-health", visitId],
    queryFn: () => getArtReproductiveHealthDetails(visitId),
    enabled: open,
  });

  useEffect(() => {
    if (!open || detailQuery.data === undefined) return;
    const saved = detailQuery.data;
    setDraft(
      saved
        ? {
            pregnant: toYesNo(saved.pregnant),
            trimester: saved.trimester?.toString() ?? "",
            gravida: saved.gravida ?? "",
            para: saved.para ?? "",
            contraceptionMethod: saved.contraceptionMethod ?? "",
            contraceptionOtherSpecify: saved.contraceptionOtherSpecify ?? "",
            urethralDischarge: toYesNo(saved.urethralDischarge),
            urethralDischargeComment: saved.urethralDischargeComment ?? "",
            vaginalDischarge: toYesNo(saved.vaginalDischarge),
            vaginalDischargeComment: saved.vaginalDischargeComment ?? "",
            genitalUlcers: toYesNo(saved.genitalUlcers),
            genitalUlcersComment: saved.genitalUlcersComment ?? "",
            genitalWarts: toYesNo(saved.genitalWarts),
            genitalWartsComment: saved.genitalWartsComment ?? "",
            lowerAbdominalPain: toYesNo(saved.lowerAbdominalPain),
            lowerAbdominalPainComment: saved.lowerAbdominalPainComment ?? "",
            papSmearResult: saved.papSmearResult ?? "",
            papSmearDate: saved.papSmearDate ?? "",
            rprDate: saved.rprDate ?? "",
            results: saved.results ?? "",
            specifyTreatmentCompleted: saved.specifyTreatmentCompleted ?? "",
          }
        : EMPTY_DRAFT,
    );
  }, [open, detailQuery.data]);

  const save = useMutation({
    mutationFn: () =>
      saveArtReproductiveHealthDetails(visitId, {
        pregnant: draft.pregnant === "" ? null : draft.pregnant === "YES",
        trimester: draft.trimester ? Number(draft.trimester) : null,
        gravida: draft.gravida.trim() || null,
        para: draft.para.trim() || null,
        contraceptionMethod: draft.contraceptionMethod || null,
        contraceptionOtherSpecify: draft.contraceptionOtherSpecify.trim() || null,
        urethralDischarge: toNullableBoolean(draft.urethralDischarge),
        urethralDischargeComment: draft.urethralDischargeComment.trim() || null,
        vaginalDischarge: toNullableBoolean(draft.vaginalDischarge),
        vaginalDischargeComment: draft.vaginalDischargeComment.trim() || null,
        genitalUlcers: toNullableBoolean(draft.genitalUlcers),
        genitalUlcersComment: draft.genitalUlcersComment.trim() || null,
        genitalWarts: toNullableBoolean(draft.genitalWarts),
        genitalWartsComment: draft.genitalWartsComment.trim() || null,
        lowerAbdominalPain: toNullableBoolean(draft.lowerAbdominalPain),
        lowerAbdominalPainComment: draft.lowerAbdominalPainComment.trim() || null,
        papSmearResult: draft.papSmearResult.trim() || null,
        papSmearDate: draft.papSmearDate || null,
        rprDate: draft.rprDate || null,
        results: draft.results.trim() || null,
        specifyTreatmentCompleted: draft.specifyTreatmentCompleted.trim() || null,
      }),
    onSuccess: (details) => {
      queryClient.setQueryData(["art-reproductive-health", visitId], details);
      setSaveError(null);
      setSavedMessage("Reproductive health details saved.");
    },
    onError: (error) => {
      setSaveError(
        error instanceof ApiError ? error.message : "Couldn't save the reproductive health details. Try again.",
      );
    },
  });

  function updateDraft(patch: Partial<Draft>) {
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
        icon={<HeartPulse className="size-4" aria-hidden />}
        onClick={() => {
          setSaveError(null);
          setSavedMessage(null);
          setOpen(true);
        }}
      >
        Capture Reproductive Health Details
      </Button>

      <Modal
        open={open}
        size="lg"
        title="Capture Reproductive Health Details"
        description="Record reproductive and STI details for this ART initiation visit. Optional fields stay optional unless a yes/no question requires follow-up notes."
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
              disabled={detailQuery.isLoading || detailQuery.isError}
              onClick={() => save.mutate()}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          {detailQuery.isError && (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-danger-50 p-3">
              <p className="text-[13px] text-danger-700">Couldn’t load the saved reproductive health details.</p>
              <Button variant="secondary" size="md" onClick={() => detailQuery.refetch()}>
                Try again
              </Button>
            </div>
          )}

          {detailQuery.isLoading ? (
            <p className="text-[13px] text-text-secondary">Loading saved details…</p>
          ) : (
            <>
              {detailQuery.data && (
                <p className="rounded-lg bg-brand-50 px-3.5 py-3 text-[12.5px] text-brand-800">
                  Details already exist for this visit. Saving will update them. Reset clears only this form.
                  {detailQuery.data.updatedByName && (
                    <span className="mt-1 block text-brand-700">
                      Last saved by {detailQuery.data.updatedByName} ·{" "}
                      {new Date(detailQuery.data.updatedAt).toLocaleString("en-ZA", {
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

              <div className="rounded-lg border border-border-subtle bg-surface-sunken/50 p-4">
                <YesNoGroup
                  label="Confirm pregnant"
                  value={draft.pregnant}
                  onChange={(value) => updateDraft({ pregnant: value })}
                />

                {draft.pregnant === "YES" && (
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-text-primary">
                      Trimester
                      <select
                        className={inputClass}
                        value={draft.trimester}
                        onChange={(event) => updateDraft({ trimester: event.target.value })}
                      >
                        <option value="">Select</option>
                        {[1, 2, 3].map((value) => (
                          <option key={value} value={value}>{value}</option>
                        ))}
                      </select>
                    </label>

                    <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-text-primary">
                      Gravida
                      <input
                        className={inputClass}
                        value={draft.gravida}
                        onChange={(event) => updateDraft({ gravida: event.target.value })}
                        placeholder="e.g. G2"
                      />
                    </label>

                    <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-text-primary">
                      Para
                      <input
                        className={inputClass}
                        value={draft.para}
                        onChange={(event) => updateDraft({ para: event.target.value })}
                        placeholder="e.g. P1"
                      />
                    </label>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-text-primary">
                  Contraception
                  <select
                    className={inputClass}
                    value={draft.contraceptionMethod}
                    onChange={(event) =>
                      updateDraft({
                        contraceptionMethod: event.target.value as ContraceptionMethod | "",
                        contraceptionOtherSpecify: event.target.value === "OTHER" ? draft.contraceptionOtherSpecify : "",
                      })
                    }
                  >
                    <option value="">Select</option>
                    {contraceptionOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>

                {draft.contraceptionMethod === "OTHER" && (
                  <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-text-primary">
                    Specify
                    <input
                      className={inputClass}
                      value={draft.contraceptionOtherSpecify}
                      onChange={(event) => updateDraft({ contraceptionOtherSpecify: event.target.value })}
                      placeholder="Describe the method"
                    />
                  </label>
                )}
              </div>

              <div className="rounded-lg border border-border-subtle bg-surface-sunken/50 p-4">
                <p className="mb-3 text-[13px] font-semibold text-text-primary">Confirm signs and symptoms of STI today</p>
                <div className="space-y-4">
                  {[
                    { key: "urethralDischarge", label: "Urethral discharge / dysuria", commentKey: "urethralDischargeComment" },
                    { key: "vaginalDischarge", label: "Vaginal discharge", commentKey: "vaginalDischargeComment" },
                    { key: "genitalUlcers", label: "Genital ulcers", commentKey: "genitalUlcersComment" },
                    { key: "genitalWarts", label: "Genital warts", commentKey: "genitalWartsComment" },
                    { key: "lowerAbdominalPain", label: "Lower abdominal pain", commentKey: "lowerAbdominalPainComment" },
                  ].map((question) =>
                    <div key={question.key} className="rounded-lg border border-border-subtle bg-surface-raised p-3">
                      <YesNoGroup
                        label={question.label}
                        value={draft[question.key as keyof Draft] as YesNo}
                        onChange={(value) => updateDraft({ [question.key]: value } as Partial<Draft>)}
                      />
                      {(draft[question.key as keyof Draft] as YesNo) === "YES" && (
                        <label className="mt-3 flex flex-col gap-1.5 text-[12.5px] font-medium text-text-primary">
                          Comment
                          <textarea
                            rows={3}
                            className="w-full rounded-lg border border-border-strong bg-surface-raised px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                            value={draft[question.commentKey as keyof Draft] as string}
                            onChange={(event) =>
                              updateDraft({ [question.commentKey]: event.target.value } as Partial<Draft>)
                            }
                            placeholder={`Add details for ${question.label.toLowerCase()}`}
                          />
                        </label>
                      )}
                    </div>,
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-text-primary sm:col-span-2">
                  Pap smear result
                  <textarea
                    rows={3}
                    className="w-full rounded-lg border border-border-strong bg-surface-raised px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                    value={draft.papSmearResult}
                    onChange={(event) => updateDraft({ papSmearResult: event.target.value })}
                    placeholder="Enter pap smear details"
                  />
                </label>

                <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-text-primary">
                  Result date
                  <input
                    type="date"
                    className={inputClass}
                    value={draft.papSmearDate}
                    onChange={(event) => updateDraft({ papSmearDate: event.target.value })}
                  />
                </label>

                <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-text-primary">
                  RPR date
                  <input
                    type="date"
                    className={inputClass}
                    value={draft.rprDate}
                    onChange={(event) => updateDraft({ rprDate: event.target.value })}
                  />
                </label>

                <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-text-primary sm:col-span-2">
                  Results
                  <textarea
                    rows={3}
                    className="w-full rounded-lg border border-border-strong bg-surface-raised px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                    value={draft.results}
                    onChange={(event) => updateDraft({ results: event.target.value })}
                    placeholder="Capture additional findings"
                  />
                </label>

                <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-text-primary sm:col-span-2">
                  Specify treatment completed
                  <textarea
                    rows={3}
                    className="w-full rounded-lg border border-border-strong bg-surface-raised px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                    value={draft.specifyTreatmentCompleted}
                    onChange={(event) => updateDraft({ specifyTreatmentCompleted: event.target.value })}
                    placeholder="Describe treatment completion details"
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
