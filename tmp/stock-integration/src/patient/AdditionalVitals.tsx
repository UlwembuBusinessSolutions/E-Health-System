import { Bandage, Droplets, FlaskConical, Ruler, Scale, TestTube, type LucideIcon } from "lucide-react";
import { useId } from "react";
import type { AdditionalObservations } from "@/shared/api/triage";

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
export function AdditionalVitalsForm({ value, onChange }: { value: AdditionalVitalsState; onChange: (value: AdditionalVitalsState) => void }) {
  const prefix = useId();
  const update = (key: keyof AdditionalVitalsState, next: string) => onChange({ ...value, [key]: next });
  const bmi = Number(value.weightKg) > 0 && Number(value.heightCm) > 0 ? (Number(value.weightKg) / (Number(value.heightCm) / 100) ** 2).toFixed(1) : null;
  return <section className="mt-5 space-y-5 rounded-xl border border-border-subtle bg-surface-sunken/30 p-4">
    <div><h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary"><FlaskConical className="size-4 text-text-accent" aria-hidden /> Additional measurements</h3>
      <p className="mt-1 text-xs text-text-secondary">Record when assessed. Leave unmeasured values blank.</p></div>
    <div className="flex max-w-sm flex-col gap-1.5 text-sm text-text-primary">
      <label htmlFor={`${prefix}-trauma`} className="flex items-center gap-2"><Bandage className="size-4" aria-hidden /> Injury within the past 48 hours</label>
      <select id={`${prefix}-trauma`} className={inputClass} value={value.traumaPresent} onChange={e => update("traumaPresent", e.target.value)}>
        <option value="">Not assessed</option><option value="no">No trauma</option><option value="yes">Trauma present</option>
      </select>
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
      {RESULTS.map(({ key, label, options }) => value[key] != null && <Tile key={key} icon={TestTube} label={label} value={options.find(([id]) => id === value[key])?.[1] ?? value[key]!} />)}
    </div>
  </section>;
}
