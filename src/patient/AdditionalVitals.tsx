import { Bandage, Droplets, FlaskConical, Ruler, Scale, TestTube, type LucideIcon } from "lucide-react";
import { useId, type ReactNode } from "react";
import type { AdditionalObservations, ScoringProfile } from "@/shared/api/triage";
import { VitalStatusBadge } from "./VitalStatusBadge";
import { bmiStatus, haemoglobinStatus, traumaStatus, type VitalStatus } from "./vitalsStatus";

export const MEASUREMENTS = [
  { key: "weightKg", label: "Weight", unit: "kg", icon: Scale },
  { key: "heightCm", label: "Height / length", unit: "cm", icon: Ruler },
  { key: "glucoseMmolL", label: "Blood glucose", unit: "mmol/L", icon: Droplets },
  { key: "haemoglobinGdl", label: "Haemoglobin", unit: "g/dL", icon: Droplets },
] as const;
const DIPSTICKS = [
  ["urineProtein", "Protein"], ["urineGlucose", "Glucose"], ["urineKetones", "Ketones"],
  ["urineBlood", "Blood"], ["urineLeukocytes", "Leukocytes"], ["urineNitrites", "Nitrites"],
] as const;
const GRADES = [["NEGATIVE", "Negative"], ["TRACE", "Trace"], ["ONE_PLUS", "1+"], ["TWO_PLUS", "2+"], ["THREE_PLUS", "3+"], ["FOUR_PLUS", "4+"]] as const;
const BINARY = [["NEGATIVE", "Negative"], ["POSITIVE", "Positive"]] as const;
const RESULTS = [...DIPSTICKS.map(([key, label]) => ({ key, label: `Urine ${label.toLowerCase()}`, options: key === "urineNitrites" ? BINARY : GRADES })),
  { key: "pregnancyTest" as const, label: "Urine pregnancy test", options: [...BINARY, ["INDETERMINATE", "Indeterminate"]] },
];
export type AdditionalVitalsState = Record<typeof MEASUREMENTS[number]["key"] | typeof RESULTS[number]["key"] | "traumaPresent", string>;
export const EMPTY_ADDITIONAL_VITALS = Object.fromEntries([
  ...MEASUREMENTS.map(({ key }) => [key, ""]), ...RESULTS.map(({ key }) => [key, ""]), ["traumaPresent", ""],
]) as AdditionalVitalsState;

export function additionalPayload(state: AdditionalVitalsState): AdditionalObservations {
  return {
    ...Object.fromEntries(MEASUREMENTS.map(({ key }) => [key, state[key] === "" ? null : Number(state[key])])),
    ...Object.fromEntries(RESULTS.map(({ key }) => [key, state[key] || null])),
    traumaPresent: state.traumaPresent === "" ? null : state.traumaPresent === "yes",
  };
}

const inputClass = "h-11 w-full rounded-lg border border-border-strong bg-surface-raised px-3 text-sm text-text-primary outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";
export function AdditionalVitalsForm({ value, onChange, traumaRequired = false }: { value: AdditionalVitalsState; onChange: (value: AdditionalVitalsState) => void; traumaRequired?: boolean }) {
  const prefix = useId();
  const update = (key: keyof AdditionalVitalsState, next: string) => onChange({ ...value, [key]: next });
  const bmi = Number(value.weightKg) > 0 && Number(value.heightCm) > 0 ? (Number(value.weightKg) / (Number(value.heightCm) / 100) ** 2).toFixed(1) : null;
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
      {MEASUREMENTS.map(({ key, label, unit, icon: Icon }) => <label key={key} className="flex flex-col gap-1.5 text-sm text-text-primary">
        <span className="flex items-center gap-1.5"><Icon className="size-4 text-text-accent" aria-hidden />{label} <span className="text-xs text-text-secondary">({unit})</span></span>
        <input type="number" inputMode="decimal" min="0.01" step="any" className={inputClass} placeholder="Not measured" value={value[key]} onChange={e => update(key, e.target.value)} />
      </label>)}
    </div>
    {bmi && <p role="status" className="rounded-lg bg-surface-raised px-3 py-2 text-sm text-text-primary">Calculated BMI: <strong>{bmi} kg/m²</strong><span className="ml-2 text-xs text-text-secondary">Children require age-specific growth assessment.</span></p>}
    <details className="rounded-lg border border-border-subtle bg-surface-raised p-3" open={RESULTS.some(({key}) => !!value[key]) || undefined}>
      <summary className="cursor-pointer text-sm font-medium text-text-primary"><TestTube className="mr-2 inline size-4 text-text-accent" aria-hidden />Urine dipstick &amp; pregnancy test <span className="text-xs text-text-secondary">· Optional</span></summary>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {RESULTS.map(({ key, label, options }) => <div key={key} className="flex flex-col gap-1.5 text-sm text-text-primary"><label htmlFor={`${prefix}-${key}`}>{label}</label>
          <select id={`${prefix}-${key}`} className={inputClass} value={value[key]} onChange={e => update(key, e.target.value)}>
            <option value="">Not recorded</option>{options.map(([id, text]) => <option key={id} value={id}>{text}</option>)}
          </select>
        </div>)}
      </div>
    </details>
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
export function AdditionalVitalsSummary({ value, variant = "default", scoringProfile }: { value?: AdditionalObservations | null; variant?: "default" | "report"; scoringProfile?: ScoringProfile | null }) {
  if (!value || !Object.values(value).some(v => v != null)) return null;
  const report = variant === "report";
  const statusFor = (key: string, raw: number | null | undefined): VitalStatus | null => {
    if (!report || raw == null) return null;
    return key === "haemoglobinGdl" ? haemoglobinStatus(raw, scoringProfile) : null;
  };
  return <section className={report ? "space-y-4" : "space-y-3"}>
    {report
      ? <h3 className="text-xl font-bold text-slate-950">Measurements &amp; Investigations</h3>
      : <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary"><FlaskConical className="size-4 text-text-accent" aria-hidden />Measurements &amp; investigations</h3>}
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {value.traumaPresent != null && <Tile report={report} icon={Bandage} label={report ? "Recent Trauma" : "Recent trauma"} value={value.traumaPresent ? "Yes" : "No"} status={report ? traumaStatus(value.traumaPresent) : null} />}
      {MEASUREMENTS.map(({ key, label, unit, icon }) => value[key] != null && <Tile report={report} key={key} icon={icon} label={label} value={String(value[key])} unit={unit} status={statusFor(key, value[key])} />)}
      {value.bmi != null && <Tile report={report} icon={Scale} label="BMI" value={String(value.bmi)} unit={<>kg/m<sup>2</sup></>} status={report ? bmiStatus(value.bmi, scoringProfile) : null} />}
      {RESULTS.map(({ key, label, options }) => value[key] != null && <Tile report={report} key={key} icon={TestTube} label={label} value={options.find(([id]) => id === value[key])?.[1] ?? value[key]!} />)}
    </div>
  </section>;
}
