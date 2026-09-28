import { Activity, Droplets, Gauge, HeartPulse, Thermometer, Wind } from "lucide-react";
import type { TriageAssessment } from "@/shared/api/triage";

/** Consistent, labelled measurements for the history list and latest reading. */
export function VitalsOverview({ assessment: a }: { assessment: TriageAssessment }) {
  const fields = [
    { label: "Blood pressure", icon: Gauge, value: a.systolicBp == null ? null : `${a.systolicBp}/${a.diastolicBp ?? "—"}`, unit: "mmHg" },
    { label: "Pulse", icon: HeartPulse, value: a.heartRate, unit: "bpm" },
    { label: "Respirations", icon: Wind, value: a.respiratoryRate, unit: "/min" },
    { label: "Temperature", icon: Thermometer, value: a.temperatureCelsius, unit: "°C" },
    { label: "SpO₂", icon: Activity, value: a.spo2Percent, unit: "%" },
    { label: "Glucose", icon: Droplets, value: a.additionalObservations?.glucoseMmolL, unit: "mmol/L" },
  ];
  return <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
    {fields.map(({ label, icon: Icon, value, unit }) => <div key={label} className="rounded-lg bg-surface-sunken/60 p-2.5">
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-text-secondary"><Icon className="size-3.5 text-text-accent" aria-hidden />{label}</p>
      <p className="mt-1 text-[15px] font-semibold tabular-nums text-text-primary">{value ?? "—"} {value != null && <span className="text-[11px] font-normal text-text-secondary">{unit}</span>}</p>
    </div>)}
  </div>;
}
