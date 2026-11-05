import { Bandage, Droplets, FlaskConical, Ruler, Scale, TestTube, type LucideIcon } from "lucide-react";
import { useId, type ReactNode } from "react";
import type { AdditionalObservations, ScoringProfile } from "@/shared/api/triage";
import { VitalStatusBadge } from "./VitalStatusBadge";
import { bmiStatus, haemoglobinStatus, traumaStatus, type VitalStatus } from "./vitalsStatus";
import {
  CLASSIFICATION_PILL,
  bodyMassIndex,
  classifyBmi,
  classifyGlucose,
  classifyUrineDipstick,
  classifyUrinePh,
  heightInCm,
  icd10CodesOf,
  type Classification,
} from "./vitalClassification";

export const MEASUREMENTS = [
  { key: "weightKg", label: "Weight", unit: "kg", icon: Scale },
  { key: "heightCm", label: "Height / length", unit: "cm", icon: Ruler },
  { key: "glucoseMmolL", label: "Blood glucose", unit: "mmol/L", icon: Droplets },
  { key: "haemoglobinGdl", label: "Haemoglobin", unit: "g/dL", icon: Droplets },
] as const;
// The story's urinalysis list, in the story's order: blood, urobilinogen, bilirubin, glucose, leukocytes,
// protein, nitrate, ketones (urine pH sits next to them).
const GRADES = [["NEGATIVE", "Negative"], ["TRACE", "Trace"], ["ONE_PLUS", "1+"], ["TWO_PLUS", "2+"], ["THREE_PLUS", "3+"], ["FOUR_PLUS", "4+"]] as const;
const BINARY = [["NEGATIVE", "Negative"], ["POSITIVE", "Positive"]] as const;
const URINALYSIS = [
  { key: "urineBlood" as const, label: "Blood", options: GRADES },
  { key: "urineUrobilinogen" as const, label: "Urobilinogen", options: [["NORMAL", "Normal"], ["ELEVATED", "Elevated"]] as const },
  { key: "urineBilirubin" as const, label: "Bilirubin", options: BINARY },
  { key: "urineGlucose" as const, label: "Glucose", options: GRADES },
  { key: "urineLeukocytes" as const, label: "Leukocytes", options: GRADES },
  { key: "urineProtein" as const, label: "Protein", options: GRADES },
  { key: "urineNitrites" as const, label: "Nitrate", options: BINARY },
  { key: "urineKetones" as const, label: "Ketones", options: GRADES },
];
const RESULTS = [
  ...URINALYSIS.map(({ key, label, options }) => ({ key, label: `Urine ${label.toLowerCase()}`, options })),
  { key: "pregnancyTest" as const, label: "Urine pregnancy test", options: [...BINARY, ["INDETERMINATE", "Indeterminate"]] as const },
];
const PREGNANCY_OPTIONS = [...BINARY, ["INDETERMINATE", "Indeterminate"]] as const;
export type AdditionalVitalsState = Record<
  typeof MEASUREMENTS[number]["key"] | typeof RESULTS[number]["key"] | "traumaPresent" | "glucoseType" | "urinePh" | "heightUnit",
  string
>;
export const EMPTY_ADDITIONAL_VITALS = Object.fromEntries([
  ...MEASUREMENTS.map(({ key }) => [key, ""]), ...RESULTS.map(({ key }) => [key, ""]),
  ["traumaPresent", ""], ["glucoseType", ""], ["urinePh", ""], ["heightUnit", "cm"],
]) as AdditionalVitalsState;

export function additionalPayload(state: AdditionalVitalsState): AdditionalObservations {
  // Height may be typed in centimetres or metres; the record always stores centimetres.
  const heightCm = state.heightCm === "" ? null : heightInCm(state.heightCm, state.heightUnit) ?? Number(state.heightCm);
  return {
    ...Object.fromEntries(MEASUREMENTS.map(({ key }) => [key, state[key] === "" ? null : Number(state[key])])),
    heightCm,
    ...Object.fromEntries(RESULTS.map(({ key }) => [key, state[key] || null])),
    glucoseType: state.glucoseType === "FASTING" || state.glucoseType === "RANDOM" ? state.glucoseType : null,
    urinePh: state.urinePh === "" ? null : Number(state.urinePh),
    traumaPresent: state.traumaPresent === "" ? null : state.traumaPresent === "yes",
  };
}

/** The ICD-10 codes the form's blood glucose points to, for the prescribing screen. */
export function additionalIcd10Codes(state: AdditionalVitalsState): string[] {
  return icd10CodesOf([classifyGlucose(state.glucoseMmolL, state.glucoseType)]);
}

function Pill({ result }: { result: Classification | null }) {
  if (!result) return null;
  return <span className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold ${CLASSIFICATION_PILL[result.tone]}`}>{result.text}</span>;
}

const inputClass = "h-11 w-full rounded-lg border border-border-strong bg-surface-raised px-3 text-sm text-text-primary outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";
export function AdditionalVitalsForm({ value, onChange, traumaRequired = false }: { value: AdditionalVitalsState; onChange: (value: AdditionalVitalsState) => void; traumaRequired?: boolean }) {
  const prefix = useId();
  const update = (key: keyof AdditionalVitalsState, next: string) => onChange({ ...value, [key]: next });

  const heightCentimetres = heightInCm(value.heightCm, value.heightUnit);
  const bmi = bodyMassIndex(value.weightKg, heightCentimetres);
  const bmiResult = classifyBmi(bmi);
  const glucoseResult = classifyGlucose(value.glucoseMmolL, value.glucoseType);
  const glucoseNeedsType = value.glucoseMmolL !== "" && !value.glucoseType && !glucoseResult;
  const urineResults = URINALYSIS.map(({ key }) => classifyUrineDipstick(value[key]));
  const phResult = classifyUrinePh(value.urinePh);
  const urineIntervention = [...urineResults, phResult].some((result) => result?.tone === "intervention");
  const glucoseCodes = additionalIcd10Codes(value);

  return <section className="mt-5 space-y-5 rounded-xl border border-border-subtle bg-surface-sunken/30 p-4">
    <div><h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary"><FlaskConical className="size-4 text-text-accent" aria-hidden /> Additional measurements</h3>
      <p className="mt-1 text-xs text-text-secondary">Record when assessed. Leave unmeasured values blank.</p></div>
    <div className="flex max-w-sm flex-col gap-1.5 text-sm text-text-primary">
      <label htmlFor={`${prefix}-trauma`} className="flex items-center gap-2"><Bandage className="size-4" aria-hidden /> Injury within the past 48 hours{traumaRequired && <span aria-hidden="true" className="text-danger-500"> *</span>}</label>
      <select id={`${prefix}-trauma`} className={inputClass} required={traumaRequired} aria-describedby={`${prefix}-trauma-hint`} value={value.traumaPresent} onChange={e => update("traumaPresent", e.target.value)}>
        <option value="">{traumaRequired ? "Select injury assessment…" : "Not assessed"}</option><option value="no">No trauma</option><option value="yes">Trauma present</option>
      </select>
      <p id={`${prefix}-trauma-hint`} className="text-xs text-text-secondary">{traumaRequired ? "Required before saving routine vitals. Other measurements below are optional." : "Record if assessed."}</p>
    </div>

    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {MEASUREMENTS.map(({ key, label, unit, icon: Icon }) => <div key={key} className="flex flex-col gap-1.5 text-sm text-text-primary">
        <label htmlFor={`${prefix}-${key}`} className="flex items-center gap-1.5">
          <Icon className="size-4 text-text-accent" aria-hidden />{label}{" "}
          {key !== "heightCm" && <span className="text-xs text-text-secondary">({unit})</span>}
        </label>
        {key === "heightCm" ? (
          <div className="grid grid-cols-[1fr_5rem] gap-2">
            <input id={`${prefix}-${key}`} type="number" inputMode="decimal" min="0.01" step="any" className={inputClass} placeholder="Not measured" value={value[key]} onChange={e => update(key, e.target.value)} />
            <select aria-label="Height unit" className={inputClass} value={value.heightUnit} onChange={e => update("heightUnit", e.target.value)}>
              <option value="cm">cm</option><option value="m">m</option>
            </select>
          </div>
        ) : (
          <input id={`${prefix}-${key}`} type="number" inputMode="decimal" min={key === "glucoseMmolL" ? "0" : "0.01"} step="any" className={inputClass} placeholder="Not measured" value={value[key]} onChange={e => update(key, e.target.value)} />
        )}
        {key === "heightCm" && value.heightUnit === "m" && heightCentimetres !== null && <p className="text-xs text-text-secondary">Saved as {heightCentimetres} cm.</p>}
        {key === "glucoseMmolL" && <select className={inputClass} aria-label="Blood glucose measurement type" value={value.glucoseType} onChange={e => update("glucoseType", e.target.value)}><option value="">Select fasting or random</option><option value="FASTING">Fasting</option><option value="RANDOM">Random</option></select>}
      </div>)}
    </div>

    {bmi !== null && <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-surface-raised px-3 py-2 text-sm text-text-primary">
      <span>Body mass index: <strong className="tabular-nums">{bmi.toFixed(1)} kg/m²</strong></span>
      <Pill result={bmiResult} />
      {bmiResult?.referToDietician && <span className="text-xs font-medium text-amber-700">Referral to Dietician needed.</span>}
    </div>}

    {value.glucoseMmolL !== "" && <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-surface-raised px-3 py-2 text-sm text-text-primary">
      <span>Blood glucose:</span>
      <Pill result={glucoseResult} />
      {glucoseNeedsType && <span className="text-xs text-amber-700">Select fasting or random to classify this reading.</span>}
      {glucoseCodes.length > 0 && <span className="text-xs text-text-secondary">ICD-10 {glucoseCodes.join(", ")}</span>}
    </div>}

    <div className="space-y-3 rounded-lg border border-border-subtle bg-surface-raised p-3">
      <p className="flex items-center gap-2 text-sm font-medium text-text-primary"><TestTube className="size-4 text-text-accent" aria-hidden />Urinalysis <span className="text-xs font-normal text-text-secondary">· Optional</span></p>
      {urineIntervention && <p role="alert" className="rounded-lg bg-danger-50 px-3 py-2 text-sm font-medium text-danger-600">(Intervention Required) See the flagged urinalysis results below.</p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {URINALYSIS.map(({ key, label, options }, index) => <div key={key} className="flex flex-col gap-1.5 text-sm text-text-primary">
          <label htmlFor={`${prefix}-${key}`}>{label}</label>
          <select id={`${prefix}-${key}`} className={inputClass} value={value[key]} onChange={e => update(key, e.target.value)}>
            <option value="">Not recorded</option>{options.map(([id, text]) => <option key={id} value={id}>{text}</option>)}
          </select>
          <Pill result={urineResults[index]} />
        </div>)}
        <div className="flex flex-col gap-1.5 text-sm text-text-primary">
          <label htmlFor={`${prefix}-urinePh`}>pH level</label>
          <input id={`${prefix}-urinePh`} type="number" inputMode="decimal" min="0" max="14" step="0.1" className={inputClass} placeholder="Not recorded" value={value.urinePh} onChange={e => update("urinePh", e.target.value)} />
          <Pill result={phResult} />
        </div>
      </div>
    </div>

    <div className="max-w-sm">
      <div className="flex flex-col gap-1.5 text-sm text-text-primary">
        <label htmlFor={`${prefix}-pregnancyTest`}>Urine pregnancy test <span className="text-xs text-text-secondary">· Optional</span></label>
        <select id={`${prefix}-pregnancyTest`} className={inputClass} value={value.pregnancyTest} onChange={e => update("pregnancyTest", e.target.value)}>
          <option value="">Not recorded</option>{PREGNANCY_OPTIONS.map(([id, text]) => <option key={id} value={id}>{text}</option>)}
        </select>
      </div>
    </div>
  </section>;
}

function Tile({ icon: Icon, label, value, unit, report = false, status }: { icon: LucideIcon; label: string; value: string; unit?: ReactNode; report?: boolean; status?: VitalStatus | null }) {
  if (report) {
    return <div className="min-h-[178px] rounded-[22px] border border-transparent bg-white p-6 sm:p-9">
      <div className="flex min-h-[38px] items-center justify-between gap-3">
        <p className="whitespace-nowrap text-[19px] font-medium leading-6 text-slate-800">{label}</p>
        {status && <VitalStatusBadge status={status} />}
      </div>
      <p className="mt-4 flex flex-wrap items-baseline gap-x-2 text-[42px] font-bold leading-none tracking-tight text-slate-900">
        {value}{unit && <span className="text-[20px] font-normal tracking-normal text-slate-500">{unit}</span>}
      </p>
    </div>;
  }
  return <div className="rounded-xl border border-border-subtle bg-surface-sunken/40 p-3">
    <p className="flex items-center gap-1.5 text-xs text-text-secondary"><Icon className="size-3.5 text-text-accent" aria-hidden />{label}</p>
    <p className="mt-3 text-base font-semibold tabular-nums text-text-primary">{value} {unit && <span className="text-xs font-normal text-text-secondary">{unit}</span>}</p>
  </div>;
}

// True when at least one measurement or result was actually recorded. The backend always sends some
// computed fields (classifications, flags), so those must not count as "something was recorded".
function hasRecordedValue(value: AdditionalObservations): boolean {
  const recorded: Array<keyof AdditionalObservations> = [
    "traumaPresent", "weightKg", "heightCm", "glucoseMmolL", "haemoglobinGdl", "urinePh",
    "urineProtein", "urineGlucose", "urineKetones", "urineBlood", "urineLeukocytes", "urineNitrites",
    "urineUrobilinogen", "urineBilirubin", "pregnancyTest",
  ];
  return recorded.some((key) => value[key] != null);
}

export function AdditionalVitalsSummary({ value, variant = "default", scoringProfile }: { value?: AdditionalObservations | null; variant?: "default" | "report"; scoringProfile?: ScoringProfile | null }) {
  if (!value || !hasRecordedValue(value)) return null;
  const report = variant === "report";
  const statusFor = (key: string, raw: number | null | undefined): VitalStatus | null => {
    if (!report || raw == null) return null;
    return key === "haemoglobinGdl" ? haemoglobinStatus(raw, scoringProfile) : null;
  };
  // The backend sends each classification already in brackets, e.g. "(Normal)".
  const findings = Object.entries(value.urinalysisFindings ?? {});
  return <section className={report ? "space-y-4" : "space-y-3"}>
    {report
      ? <h3 className="text-xl font-bold text-slate-950">Measurements &amp; Investigations</h3>
      : <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary"><FlaskConical className="size-4 text-text-accent" aria-hidden />Measurements &amp; investigations</h3>}
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {value.traumaPresent != null && <Tile report={report} icon={Bandage} label={report ? "Recent Trauma" : "Recent trauma"} value={value.traumaPresent ? "Yes" : "No"} status={report ? traumaStatus(value.traumaPresent) : null} />}
      {MEASUREMENTS.map(({ key, label, unit, icon }) => value[key] != null && <Tile report={report} key={key} icon={icon} label={label} value={String(value[key])} unit={unit} status={statusFor(key, value[key])} />)}
      {value.bmi != null && <Tile report={report} icon={Scale} label="BMI" value={String(value.bmi)} unit={<>kg/m<sup>2</sup></>} status={report ? bmiStatus(value.bmi, scoringProfile) : null} />}
      {value.urinePh != null && <Tile report={report} icon={TestTube} label="Urine pH" value={String(value.urinePh)} status={report && value.urinePh > 7 ? { label: "Intervention required", tone: "caution" } : null} />}
      {value.bmiClassification && <p className="col-span-full text-sm font-medium text-text-primary">BMI: {value.bmiClassification}</p>}
      {value.dieticianReferralRequired && <p className="col-span-full text-sm font-medium text-amber-700">Refer to Dietician.</p>}
      {value.glucoseClassification && <p className="col-span-full text-sm font-medium text-text-primary">Blood glucose{value.glucoseType ? ` (${value.glucoseType.toLowerCase()})` : ""}: {value.glucoseClassification}</p>}
      {findings.length > 0 && <p className="col-span-full text-sm font-medium text-text-primary">Urinalysis: {findings.map(([name, result]) => `${name} ${result}`).join(" · ")}</p>}
      {value.urinalysisInterventionRequired && <p role="alert" className="col-span-full text-sm font-medium text-danger-600">(Intervention Required) See the flagged urinalysis results.</p>}
      {RESULTS.map(({ key, label, options }) => value[key] != null && <Tile report={report} key={key} icon={TestTube} label={label} value={options.find(([id]) => id === value[key])?.[1] ?? value[key]!} />)}
    </div>
  </section>;
}
