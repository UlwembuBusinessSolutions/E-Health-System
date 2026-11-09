// Lihle | 2026-09-09 | Add visit selection, validated vital capture, and explicit out-of-range confirmation so staff can capture readings against an existing visit.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Save } from "lucide-react";
import { captureVitals, isAbnormal, validateVitalSigns, type AvpuLevel, type CaptureVitalsPayload } from "@/shared/api/triage";
import { getVisit, listVisits } from "@/shared/api/visits";
import { Input } from "@/shared/components/Input";
import { Button } from "@/shared/components/Button";
import { PageHeader } from "@/shared/components/PageHeader";

const fields = [
  ["systolicBloodPressure", "Systolic BP (mmHg)", 40, 300],
  ["diastolicBloodPressure", "Diastolic BP (mmHg)", 20, 200],
  ["heartRate", "Heart rate (bpm)", 20, 250],
  ["temperatureCelsius", "Temperature (C)", 30, 45],
  ["respiratoryRate", "Respiratory rate (breaths/min)", 5, 80],
] as const;

export function CaptureVitalsScreen() {
  const { visitId } = useParams();
  const navigate = useNavigate();
  const cache = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});
  const [avpu, setAvpu] = useState<AvpuLevel | "">("");
  const [confirmed, setConfirmed] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [warning, setWarning] = useState(false);
  const visit = useQuery({ queryKey: ["visit", visitId], queryFn: () => getVisit(visitId!), enabled: !!visitId });
  const visits = useQuery({ queryKey: ["visits"], queryFn: listVisits, enabled: !visitId });
  const save = useMutation({ mutationFn: (payload: CaptureVitalsPayload) => captureVitals(visitId!, payload), onSuccess: result => {
    void cache.invalidateQueries({ queryKey: ["triage"] });
    navigate(`/app/triage/assessments/${result.assessment.id}`);
  } });
  if (!visitId) return <div className="space-y-5"><PageHeader title="Select a visit" />{visits.isError ? <p role="alert">{visits.error.message}</p> : visits.isPending ? <p>Loading visits...</p> : <ul className="divide-y">{visits.data.map(v => <li key={v.id} className="py-3"><Link className="text-brand-700" to={`/app/triage/capture/${v.id}`}>{v.patientName} - {v.patientMpi}</Link><p className="text-xs text-text-secondary">{new Date(v.visitDateTime).toLocaleString("en-ZA")}</p></li>)}{visits.data.length === 0 && <li>No visits in this clinic.</li>}</ul>}</div>;
  if (visit.isError) return <p role="alert" className="text-danger-600">{visit.error.message}</p>;
  if (!visit.data) return <p>Loading visit...</p>;
  return <div className="space-y-5">
    <PageHeader title="Capture vital signs" description={`${visit.data.patientName} - ${visit.data.patientMpi}`} />
    <form className="max-w-3xl space-y-5" onSubmit={e => {
      e.preventDefault();
      const payload: CaptureVitalsPayload = { systolicBloodPressure: Number(values.systolicBloodPressure), diastolicBloodPressure: Number(values.diastolicBloodPressure), heartRate: Number(values.heartRate), temperatureCelsius: values.temperatureCelsius ?? "", respiratoryRate: Number(values.respiratoryRate), avpu: avpu as AvpuLevel, confirmOutOfRange: confirmed };
      const nextErrors = validateVitalSigns(payload);
      if (!avpu) nextErrors.avpu = "Select alertness.";
      setErrors(nextErrors);
      if (Object.keys(nextErrors).length) return;
      if (isAbnormal(payload) && !confirmed) { setWarning(true); return; }
      save.mutate(payload);
    }}>
      <fieldset disabled={save.isPending} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">{fields.map(([field, label, min, max]) => <div key={field}><Input required label={label} type="number" min={min} max={max} step={field === "temperatureCelsius" ? "0.1" : "1"} value={values[field] ?? ""} onChange={e => { setValues({ ...values, [field]: e.target.value }); setConfirmed(false); setWarning(false); }} />{errors[field] && <p role="alert" className="mt-1 text-sm text-danger-600">{errors[field]}</p>}</div>)}</div>
        <label className="block text-sm font-medium">Alertness (AVPU)<select required aria-label="Alertness (AVPU)" className="mt-1 block w-full rounded-md border p-3" value={avpu} onChange={e => { setAvpu(e.target.value as AvpuLevel); setConfirmed(false); setWarning(false); }}><option value="">Select alertness</option>{["ALERT", "VOICE", "PAIN", "UNRESPONSIVE"].map(value => <option key={value}>{value}</option>)}</select></label>
        {warning && <div role="alert" className="border-l-4 border-warning-500 bg-warning-50 p-4"><p className="text-sm">One or more readings are outside the configured ranges.</p><label className="mt-3 flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I confirm these observations are correct.</label></div>}
        {save.isError && <p role="alert" className="text-danger-600">{save.error.message}</p>}
        <div className="flex flex-wrap gap-3"><Button type="submit" loading={save.isPending} icon={<Save size={16} />}>Save vital signs</Button><Link className="self-center text-sm text-text-secondary" to="/app/triage">Cancel</Link></div>
      </fieldset>
    </form>
  </div>;
}
