import { useEffect, useId, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HeartPulse, RotateCcw } from "lucide-react";
import { ApiError } from "@/shared/api/client";
import {
  getArtStage1Conditions,
  saveArtStage1Conditions,
  type ArtStage1ConditionKey,
  type ArtStage1ConditionsPayload,
} from "@/shared/api/artStage1Conditions";
import { Button } from "@/shared/components/Button";
import { useToast } from "@/shared/components/toast/ToastProvider";
import { Modal } from "@/pharmacy/components/Modal";

type YesNo = "YES" | "NO" | "";
type Draft = Record<ArtStage1ConditionKey, YesNo> & {
  stage1OtherSpecify: string;
  stage2OtherSpecify: string;
  stage3OtherSpecify: string;
  cd4Result: string;
};

const conditionKeys: ArtStage1ConditionKey[] = [
  "persistentGeneralizedLymphadenopathy", "stage1Other", "stage2WeightLossUnder10Percent", "stage2MinorMucocutaneousConditions",
  "stage2RecurrentUrti", "stage2Other", "stage3WeightLossOver10Percent", "stage3DiarrhoeaOverOneMonth",
  "stage3OralCandidiasis", "stage3SevereBacterialInfections", "stage3OralHairyLeukoplakia", "stage3ProlongedFever",
  "stage3BedriddenUnder50Percent", "stage3PulmonaryTb", "stage3Other", "stage4HerpesSimplexOverOneMonth",
  "stage4OesophagealCandidiasis", "stage4PneumocystisJiroveci", "stage4KaposisSarcoma", "stage4HivWastingSyndrome",
  "stage4HivEncephalopathy", "stage4RecurrentPneumonia", "stage4Cytomegalovirus", "stage4IsosporiasisCryptosporidiosis",
  "stage4BedriddenOver50Percent", "stage4CryptococcalMeningitis", "stage4CervicalCancer", "stage4Lymphoma",
  "stage4ExtraPulmonaryTb",
];
const EMPTY_DRAFT = Object.fromEntries([
  ...conditionKeys.map((key) => [key, ""]),
  ["stage1OtherSpecify", ""], ["stage2OtherSpecify", ""], ["stage3OtherSpecify", ""], ["cd4Result", ""],
]) as Draft;
const inputClass = "h-11 w-full rounded-lg border border-border-strong bg-surface-raised px-3 text-sm text-text-primary outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";
const yesNoOptions: { value: YesNo; label: string }[] = [{ value: "YES", label: "Yes" }, { value: "NO", label: "No" }];

const sections: { title: string; rows: { key: ArtStage1ConditionKey; label: string; specify?: keyof Pick<Draft, "stage1OtherSpecify" | "stage2OtherSpecify" | "stage3OtherSpecify"> }[] }[] = [
  { title: "WHO Stage 1 Conditions", rows: [
    { key: "persistentGeneralizedLymphadenopathy", label: "Persistent Generalized Lymphadenopathy" },
    { key: "stage1Other", label: "Other", specify: "stage1OtherSpecify" },
  ] },
  { title: "WHO Stage 2 Conditions (Moderate Disease)", rows: [
    { key: "stage2WeightLossUnder10Percent", label: "Weight Loss < 10% Body Weight" },
    { key: "stage2MinorMucocutaneousConditions", label: "Minor Mucocutaneous Conditions" },
    { key: "stage2RecurrentUrti", label: "Recurrent URTI" },
    { key: "stage2Other", label: "Other", specify: "stage2OtherSpecify" },
  ] },
  { title: "WHO Stage 3 Conditions (Moderate Disease)", rows: [
    { key: "stage3WeightLossOver10Percent", label: "Weight Loss > 10% Body Weight" },
    { key: "stage3DiarrhoeaOverOneMonth", label: "Diarrhoea > 1 Month" },
    { key: "stage3OralCandidiasis", label: "Oral Candidiasis" },
    { key: "stage3SevereBacterialInfections", label: "Severe Bacterial Infections Including Pneumonia" },
    { key: "stage3OralHairyLeukoplakia", label: "Oral Hairy Leukoplakia" },
    { key: "stage3ProlongedFever", label: "Prolonged Fever" },
    { key: "stage3BedriddenUnder50Percent", label: "Bedridden < 50% / Day For Most Of Last Month" },
    { key: "stage3PulmonaryTb", label: "Pulmonary TB (Current Or In The Last Year)" },
    { key: "stage3Other", label: "Other", specify: "stage3OtherSpecify" },
  ] },
  { title: "WHO Stage 4 Conditions (Severe Disease (AIDS))", rows: [
    { key: "stage4HerpesSimplexOverOneMonth", label: "Herpes Simplex Virus Lesions > 1 Month" },
    { key: "stage4OesophagealCandidiasis", label: "Oesophageal Candidiasis" },
    { key: "stage4PneumocystisJiroveci", label: "Pneumocystis Jiroveci (Formerly PCP)" },
    { key: "stage4KaposisSarcoma", label: "Kaposi's Sarcoma" },
    { key: "stage4HivWastingSyndrome", label: "HIV Wasting Syndrome" },
    { key: "stage4HivEncephalopathy", label: "HIV Encephalopathy" },
    { key: "stage4RecurrentPneumonia", label: "Recurrent Pneumonia" },
    { key: "stage4Cytomegalovirus", label: "Cytomegalovirus" },
    { key: "stage4IsosporiasisCryptosporidiosis", label: "Isosporiasis / Cryptosporidiosis" },
    { key: "stage4BedriddenOver50Percent", label: "Bedridden > 50% / Day For Most Of Last Month" },
    { key: "stage4CryptococcalMeningitis", label: "Cryptococcal Meningitis" },
    { key: "stage4CervicalCancer", label: "Cervical Cancer" },
    { key: "stage4Lymphoma", label: "Lymphoma" },
    { key: "stage4ExtraPulmonaryTb", label: "Extra-Pulmonary TB" },
  ] },
];

function toYesNo(value: boolean | null): YesNo { return value === null ? "" : value ? "YES" : "NO"; }

function YesNoGroup({ label, value, onChange }: { label: string; value: YesNo; onChange: (value: YesNo) => void }) {
  const radioName = useId();
  return <div className="flex flex-col gap-2"><p className="text-[13px] font-medium text-text-primary">{label}</p><div className="flex gap-3">
    {yesNoOptions.map((option) => <label key={option.value} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-medium transition-colors ${value === option.value ? "border-brand-500 bg-brand-50 text-brand-700" : "border-border-strong bg-surface-raised text-text-primary"}`}>
      <input type="radio" name={radioName} checked={value === option.value} onChange={() => onChange(option.value)} className="accent-brand-600" />{option.label}
    </label>)}
  </div></div>;
}

export function ArtStage1ConditionsForm({ visitId }: { visitId: string }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [saveError, setSaveError] = useState<string | null>(null);
  const detailQuery = useQuery({
    queryKey: ["art-stage-1-conditions", visitId],
    queryFn: () => getArtStage1Conditions(visitId),
    enabled: open,
    retry: false,
  });
  const hasAnyAnswer = conditionKeys.some((key) => draft[key] !== "") ||
    Boolean(draft.stage1OtherSpecify.trim() || draft.stage2OtherSpecify.trim() || draft.stage3OtherSpecify.trim() || draft.cd4Result.trim());

  useEffect(() => {
    if (!open || detailQuery.data === undefined) return;
    const saved = detailQuery.data;
    setDraft(saved ? Object.fromEntries([
      ...conditionKeys.map((key) => [key, toYesNo(saved[key])]),
      ["stage1OtherSpecify", saved.stage1OtherSpecify ?? ""],
      ["stage2OtherSpecify", saved.stage2OtherSpecify ?? ""], ["stage3OtherSpecify", saved.stage3OtherSpecify ?? ""], ["cd4Result", saved.cd4Result ?? ""],
    ]) as Draft : EMPTY_DRAFT);
  }, [open, detailQuery.data]);

  const save = useMutation({
    mutationFn: (_updatingExisting: boolean) => {
      const payload = Object.fromEntries([
        ...conditionKeys.map((key) => [key, draft[key] === "" ? null : draft[key] === "YES"]),
        ["stage1OtherSpecify", draft.stage1OtherSpecify.trim() || null],
        ["stage2OtherSpecify", draft.stage2OtherSpecify.trim() || null], ["stage3OtherSpecify", draft.stage3OtherSpecify.trim() || null], ["cd4Result", draft.cd4Result.trim() || null],
      ]) as ArtStage1ConditionsPayload;
      return saveArtStage1Conditions(visitId, payload);
    },
    onSuccess: (details, updatingExisting) => {
      queryClient.setQueryData(["art-stage-1-conditions", visitId], details);
      setSaveError(null);
      setOpen(false);
      showToast(
        updatingExisting ? "WHO clinical staging details updated." : "WHO clinical staging details saved.",
        "success",
      );
    },
    onError: (error) => setSaveError(error instanceof ApiError ? error.message : "Couldn't save the WHO clinical staging details. Try again."),
  });

  function updateDraft(patch: Partial<Draft>) { setDraft((current) => ({ ...current, ...patch })); setSaveError(null); }
  function resetDraft() { setDraft(EMPTY_DRAFT); setSaveError(null); }

  return <>
    <Button variant="secondary" size="md" icon={<HeartPulse className="size-4" aria-hidden />} onClick={() => { setSaveError(null); setOpen(true); }}>Capture WHO Clinical Staging</Button>
    <Modal open={open} size="lg" title="Capture WHO Clinical Staging" description="Record WHO Stage 1–4 conditions for this Adult ART Initiation visit." dismissible={!save.isPending} onClose={() => setOpen(false)} footer={<>
      <Button variant="secondary" disabled={save.isPending} onClick={resetDraft}><RotateCcw className="mr-1.5 size-3.5" aria-hidden />Reset</Button>
      <Button variant="primary" loading={save.isPending} disabled={detailQuery.isLoading || save.isPending || !hasAnyAnswer} onClick={() => save.mutate(detailQuery.data !== null && detailQuery.data !== undefined)}>Save</Button>
    </>}>
      <div className="flex flex-col gap-5">
        {detailQuery.isError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-danger-50 p-3"><p className="text-[13px] text-danger-700">The server couldn't load the saved record. You can still enter a new record and try saving it.</p><Button variant="secondary" size="md" onClick={() => detailQuery.refetch()}>Try again</Button></div>}
        {!detailQuery.isLoading && !detailQuery.isError && detailQuery.data === null && <p role="status" className="rounded-lg bg-surface-sunken px-3.5 py-3 text-[13px] text-text-secondary">No WHO clinical staging record exists for this visit yet. Enter any details you have and save them.</p>}
        {!detailQuery.isLoading && !hasAnyAnswer && <p className="text-[13px] text-text-secondary">Enter at least one answer to enable Save. All other fields are optional.</p>}
        {detailQuery.isLoading ? <p className="text-[13px] text-text-secondary">Loading saved details…</p> : <>
          {detailQuery.data && <p className="rounded-lg bg-brand-50 px-3.5 py-3 text-[12.5px] text-brand-800">The values shown are the saved clinical staging details for this visit. Any changes you make here will be saved to this visit when you select Save.</p>}
          {sections.map((section) => <section key={section.title} className="rounded-lg border border-border-subtle bg-surface-sunken/50 p-4">
            <h3 className="mb-4 text-sm font-semibold text-text-primary">{section.title}</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{section.rows.map((row) => <div key={row.key} className="rounded-lg border border-border-subtle bg-surface-raised p-3">
              <YesNoGroup label={row.label} value={draft[row.key]} onChange={(value) => updateDraft({ [row.key]: value })} />
              {row.specify && draft[row.key] === "YES" && <label className="mt-3 flex flex-col gap-1.5 text-[12.5px] font-medium text-text-primary">Specify<textarea rows={2} className="w-full rounded-lg border border-border-strong bg-surface-raised px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" value={draft[row.specify]} onChange={(event) => updateDraft({ [row.specify!]: event.target.value })} placeholder="Add details" />
              </label>}
            </div>)}</div>
          </section>)}
          <section className="rounded-lg border border-border-subtle bg-surface-sunken/50 p-4"><label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-text-primary">CD4 Result <span className="font-normal text-text-secondary">For clients with MDR/XDR-TB irrespective of CD4 count, or clients with CD4 &lt; 350 cells/mm³ who have TB/HIV or are pregnant.</span><input className={inputClass} value={draft.cd4Result} onChange={(event) => updateDraft({ cd4Result: event.target.value })} placeholder="Enter CD4 result" /></label></section>
        </>}
        {saveError && <p role="alert" className="text-[13px] text-danger-700">{saveError}</p>}
      </div>
    </Modal>
  </>;
}
