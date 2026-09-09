// Lihle | 2026-09-09 | Derive daily counts, recent assessments, and visits awaiting vitals from API data so the dashboard reflects recorded clinic activity.
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Activity, AlertTriangle, Clock, Plus } from "lucide-react";
import { isAbnormal, listTriageAssessments } from "@/shared/api/triage";
import { listVisits } from "@/shared/api/visits";
import { PageHeader } from "@/shared/components/PageHeader";
import { StatCard } from "@/shared/components/StatCard";

export function TriageDashboard() {
  const assessments = useQuery({ queryKey: ["triage", "assessments"], queryFn: listTriageAssessments });
  const visits = useQuery({ queryKey: ["visits"], queryFn: listVisits });
  const today = new Date().toLocaleDateString("en-ZA");
  const rows = (assessments.data ?? []).filter(row => new Date(row.assessment.capturedAt).toLocaleDateString("en-ZA") === today);
  const captured = new Set((assessments.data ?? []).map(row => row.assessment.visitId));
  const waiting = (visits.data ?? []).filter(v => new Date(v.visitDateTime).toLocaleDateString("en-ZA") === today && !captured.has(v.id));
  return <div className="space-y-6">
    <PageHeader title="Triage" action={<Link className="inline-flex items-center gap-2 text-brand-700" to="/app/triage/capture"><Plus size={18} />Capture vitals</Link>} />
    {assessments.isError || visits.isError ? <p role="alert" className="text-danger-600">{assessments.error?.message ?? visits.error?.message}</p> : assessments.isPending || visits.isPending ? <p>Loading triage...</p> : <>
      <div className="grid gap-4 sm:grid-cols-3"><StatCard label="Assessments today" value={rows.length} icon={Activity} /><StatCard label="Out of range today" value={rows.filter(row => isAbnormal(row.assessment)).length} icon={AlertTriangle} /><StatCard label="Awaiting vitals today" value={waiting.length} icon={Clock} /></div>
      <nav className="flex flex-wrap gap-5 border-b pb-4 text-sm text-brand-700"><Link to="/app/triage/list">All assessments</Link><Link to="/app/triage/list?status=ABNORMAL">Out-of-range readings</Link><Link to="/app/pharmacy">Pharmacy</Link></nav>
      <section>
        <h2 className="mb-3 text-base font-semibold">Recent assessments</h2>
        {assessments.data?.length ? <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-surface-raised"><tr>{["Patient", "Blood pressure", "Heart rate", "Temperature", "Captured", "Details"].map(label => <th key={label} className="p-3 whitespace-nowrap">{label}</th>)}</tr></thead>
            <tbody>{[...assessments.data].sort((a, b) => Date.parse(b.assessment.capturedAt) - Date.parse(a.assessment.capturedAt)).slice(0, 10).map(({ assessment, patientName, patientMpi }) => <tr key={assessment.id} className="border-b">
              <td className="p-3"><p className="font-medium">{patientName}</p><p className="font-mono text-xs text-text-secondary">{patientMpi}</p></td>
              <td className="p-3 whitespace-nowrap">{assessment.systolicBloodPressure}/{assessment.diastolicBloodPressure} mmHg</td>
              <td className="p-3 whitespace-nowrap">{assessment.heartRate} bpm</td>
              <td className="p-3 whitespace-nowrap">{assessment.temperatureCelsius} °C</td>
              <td className="p-3 whitespace-nowrap">{new Date(assessment.capturedAt).toLocaleString("en-ZA")}</td>
              <td className="p-3 whitespace-nowrap"><Link className="text-brand-700" aria-label={`View assessment for ${patientName}`} to={`/app/triage/assessments/${assessment.id}`}>View details</Link></td>
            </tr>)}</tbody>
          </table>
        </div> : <p className="text-sm text-text-secondary">No assessments captured yet. Capture vitals for a visit to see its details here.</p>}
      </section>
      <section><h2 className="mb-3 text-base font-semibold">Awaiting vitals</h2>{waiting.length === 0 ? <p className="text-sm text-text-secondary">No visits awaiting vitals today.</p> : <ul className="divide-y">{waiting.map(v => <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div>{v.patientName}<p className="font-mono text-xs text-text-secondary">{v.patientMpi}</p></div><Link className="text-sm text-brand-700" to={`/app/triage/capture/${v.id}`}>Capture vitals</Link></li>)}</ul>}</section>
    </>}
  </div>;
}
