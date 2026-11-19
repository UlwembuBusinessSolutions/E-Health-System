import { Bandage, Droplets, FlaskConical, Ruler, Scale, TestTube, Wind, type LucideIcon } from "lucide-react";
import { useId } from "react";
import type { AdditionalObservations } from "@/shared/api/triage";

export const MEASUREMENTS = [
  { key: "weightKg", label: "Weight", unit: "kg", icon: Scale },
  { key: "heightCm", label: "Height / length", unit: "cm", icon: Ruler },
  { key: "glucoseMmolL", label: "Blood glucose", unit: "mmol/L", icon: Droplets },
  { key: "haemoglobinGdl", label: "Haemoglobin", unit: "g/dL", icon: Droplets },
  { key: "peakFlowLpm", label: "Peak flow", unit: "L/min", icon: Wind },
] as const;
const DIPSTICKS = [
  ["urineBlood", "Blood", [["NEGATIVE", "Negative"], ["TRACE", "Trace"], ["ONE_PLUS", "1+"], ["TWO_PLUS", "2+"], ["THREE_PLUS", "3+"], ["FOUR_PLUS", "4+"]] as const],
  ["urineUrobilinogen", "Urobilinogen", [["NORMAL", "Normal"], ["ELEVATED", "Elevated"]] as const],
  ["urineBilirubin", "Bilirubin", [["NEGATIVE", "Negative"], ["POSITIVE", "Positive"]] as const],
  ["urineGlucose", "Glucose", [["NEGATIVE", "Negative"], ["TRACE", "Trace"], ["ONE_PLUS", "1+"], ["TWO_PLUS", "2+"], ["THREE_PLUS", "3+"], ["FOUR_PLUS", "4+"]] as const],
  ["urineLeukocytes", "Leukocytes", [["NEGATIVE", "Negative"], ["TRACE", "Trace"], ["ONE_PLUS", "1+"], ["TWO_PLUS", "2+"], ["THREE_PLUS", "3+"], ["FOUR_PLUS", "4+"]] as const],
  ["urineProtein", "Protein", [["NEGATIVE", "Negative"], ["TRACE", "Trace"], ["ONE_PLUS", "1+"], ["TWO_PLUS", "2+"], ["THREE_PLUS", "3+"], ["FOUR_PLUS", "4+"]] as const],
  ["urineNitrites", "Nitrate", [["NEGATIVE", "Negative"], ["POSITIVE", "Positive"]] as const],
  ["urineKetones", "Ketones", [["NEGATIVE", "Negative"], ["TRACE", "Trace"], ["ONE_PLUS", "1+"], ["TWO_PLUS", "2+"], ["THREE_PLUS", "3+"], ["FOUR_PLUS", "4+"]] as const],
] as const;
const BINARY = [["NEGATIVE", "Negative"], ["POSITIVE", "Positive"]] as const;
const RESULTS = [{ key: "pregnancyTest" as const, label: "Urine pregnancy test", options: [...BINARY, ["INDETERMINATE", "Indeterminate"] as const] }];
export type AdditionalVitalsState = Record<typeof MEASUREMENTS[number]["key"] | typeof RESULTS[number]["key"] | typeof DIPSTICKS[number][0] | "urinePh" | "traumaPresent", string>;
export const EMPTY_ADDITIONAL_VITALS = Object.fromEntries([
  ...MEASUREMENTS.map(({ key }) => [key, ""]), ...RESULTS.map(({ key }) => [key, ""]),
  ...DIPSTICKS.map(([key]) => [key, ""]), ["urinePh", ""], ["traumaPresent", ""],
]) as AdditionalVitalsState;

export function additionalPayload(state: AdditionalVitalsState): AdditionalObservations {
  return {
    ...Object.fromEntries(MEASUREMENTS.map(({ key }) => [key, state[key] === "" ? null : Number(state[key])])),
    ...Object.fromEntries(RESULTS.map(({ key }) => [key, state[key] || null])),
    ...Object.fromEntries(DIPSTICKS.map(([key]) => [key, state[key] || null])),
    urinePh: state.urinePh === "" ? null : Number(state.urinePh),
    traumaPresent: state.traumaPresent === "" ? null : state.traumaPresent === "yes",
  };
}

const inputClass = "h-11 w-full rounded-lg border border-border-strong bg-surface-raised px-3 text-sm text-text-primary outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";
export function AdditionalVitalsForm({ value, onChange, traumaRequired = false }: { value: AdditionalVitalsState; onChange: (value: AdditionalVitalsState) => void; traumaRequired?: boolean }) {
  const prefix = useId();
  const update = (key: keyof AdditionalVitalsState, next: string) => onChange({ ...value, [key]: next });
  const bmi = Number(value.weightKg) > 0 && Number(value.heightCm) > 0 ? (Number(value.weightKg) / (Number(value.heightCm) / 100) ** 2).toFixed(1) : null;
  return <>
    <div className="mt-5 flex max-w-sm flex-col gap-1.5 text-sm text-text-primary">
      <label htmlFor={`${prefix}-trauma`} className="flex items-center gap-2"><Bandage className="size-4" aria-hidden /> Injury within the past 48 hours{traumaRequired && <span aria-hidden="true" className="text-danger-500"> *</span>}</label>
      <select id={`${prefix}-trauma`} className={inputClass} required={traumaRequired} aria-describedby={`${prefix}-trauma-hint`} value={value.traumaPresent} onChange={e => update("traumaPresent", e.target.value)}>
        <option value="">{traumaRequired ? "Select injury assessment…" : "Not assessed"}</option><option value="no">No trauma</option><option value="yes">Trauma present</option>
      </select>
      <p id={`${prefix}-trauma-hint`} className="text-xs text-text-secondary">{traumaRequired ? "Required before saving routine vitals. Other measurements below are optional." : "Record if assessed."}</p>
    </div>
  <section className="mt-5 space-y-5 rounded-xl border border-border-subtle bg-surface-sunken/30 p-4">
    <div><h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary"><FlaskConical className="size-4 text-text-accent" aria-hidden /> Additional measurements</h3>
      <p className="mt-1 text-xs text-text-secondary">Record when assessed. Leave unmeasured values blank.</p></div>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {MEASUREMENTS.map(({ key, label, unit, icon: Icon }) => <label key={key} className="flex flex-col gap-1.5 text-sm text-text-primary">
        <span className="flex items-center gap-1.5"><Icon className="size-4 text-text-accent" aria-hidden />{label} <span className="text-xs text-text-secondary">({unit})</span></span>
        <input type="number" inputMode="decimal" min="0.01" step="any" className={inputClass} placeholder="Not measured" value={value[key]} onChange={e => update(key, e.target.value)} />
      </label>)}
      <label className="flex flex-col gap-1.5 text-sm text-text-primary">
        <span className="flex items-center gap-1.5"><Scale className="size-4 text-text-accent" aria-hidden />Body mass index <span className="text-xs text-text-secondary">(kg/m²)</span></span>
        <input type="text" readOnly aria-readonly="true" className={`${inputClass} bg-surface-sunken`} placeholder="Calculated from weight and height" value={bmi ?? ""} />
      </label>
    </div>
    {bmi && <p role="status" className="rounded-lg bg-surface-raised px-3 py-2 text-sm text-text-primary">Calculated BMI: <strong>{bmi} kg/m²</strong><span className="ml-2 text-xs text-text-secondary">Children require age-specific growth assessment.</span></p>}
    <details className="rounded-lg border border-border-subtle bg-surface-raised p-3" open>
      <summary className="cursor-pointer text-sm font-medium text-text-primary"><TestTube className="mr-2 inline size-4 text-text-accent" aria-hidden />Urine dipstick &amp; pregnancy test <span className="text-xs text-text-secondary">· Optional</span></summary>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {DIPSTICKS.map(([key, label, options]) => <div key={key} className="min-w-0 rounded-lg border border-border-subtle px-3 py-2">
          <label className="flex items-center gap-2 text-sm text-text-primary">
            <input type="checkbox" checked={value[key] !== ""} onChange={e => update(key, e.target.checked ? options[0][0] : "")} className="size-4 accent-brand-600" />
            {label}
          </label>
          {value[key] !== "" && <select aria-label={`${label} result`} className={`${inputClass} mt-2 h-9`} value={value[key]} onChange={e => update(key, e.target.value)}>
            {options.map(([id, text]) => <option key={id} value={id}>{text}</option>)}
          </select>}
        </div>)}
        <div className="min-w-0 rounded-lg border border-border-subtle px-3 py-2">
          <label className="flex items-center gap-2 text-sm text-text-primary">
            <input type="checkbox" checked={value.urinePh !== ""} onChange={e => update("urinePh", e.target.checked ? "7" : "")} className="size-4 accent-brand-600" />
            pH Level
          </label>
          {value.urinePh !== "" && <input aria-label="Urine pH level" type="number" min="0" max="14" step="0.1" className={`${inputClass} mt-2 h-9`} value={value.urinePh} onChange={e => update("urinePh", e.target.value)} />}
        </div>
      </div>
      <div className="mt-3 grid max-w-sm grid-cols-1 gap-4">
        {RESULTS.map(({ key, label, options }) => <div key={key} className="flex flex-col gap-1.5 text-sm text-text-primary"><label htmlFor={`${prefix}-${key}`}>{label}</label>
          <select id={`${prefix}-${key}`} className={inputClass} value={value[key]} onChange={e => update(key, e.target.value)}>
            <option value="">Not recorded</option>{options.map(([id, text]) => <option key={id} value={id}>{text}</option>)}
          </select>
        </div>)}
      </div>
    </details>
  </section>
  </>;
}

function Tile({ icon: Icon, label, value, unit }: { icon: LucideIcon; label: string; value: string; unit?: string }) {
  return <div className="rounded-xl border border-border-subtle bg-surface-sunken/40 p-3">
    <p className="flex items-center gap-1.5 text-xs text-text-secondary"><Icon className="size-3.5 text-text-accent" aria-hidden />{label}</p>
    <p className="mt-1 text-base font-semibold tabular-nums text-text-primary">{value} <span className="text-xs font-normal text-text-secondary">{unit}</span></p>
  </div>;
}
export function AdditionalVitalsSummary({ value }: { value?: AdditionalObservations | null }) {
  if (!value || !Object.values(value).some(v => v != null)) return null;
  return <section className="space-y-3"><h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary"><FlaskConical className="size-4 text-text-accent" aria-hidden />Measurements &amp; investigations</h3>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {value.traumaPresent != null && <Tile icon={Bandage} label="Recent trauma" value={value.traumaPresent ? "Present" : "None"} />}
      {MEASUREMENTS.map(({ key, label, unit, icon }) => value[key] != null && <Tile key={key} icon={icon} label={label} value={String(value[key])} unit={unit} />)}
      {value.bmi != null && <Tile icon={Scale} label="BMI" value={String(value.bmi)} unit="kg/m²" />}
      {value.urinePh != null && <Tile icon={TestTube} label="Urine pH" value={String(value.urinePh)} />}
      {DIPSTICKS.map(([key, label, options]) => value[key] != null && <Tile key={key} icon={TestTube} label={`Urine ${label.toLowerCase()}`} value={options.find(([id]) => id === value[key])?.[1] ?? value[key]!} />)}
      {RESULTS.map(({ key, label, options }) => value[key] != null && <Tile key={key} icon={TestTube} label={label} value={options.find(([id]) => id === value[key])?.[1] ?? value[key]!} />)}
    </div>
  </section>;
}
