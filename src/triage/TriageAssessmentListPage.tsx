// Lihle | 2026-09-09 | Load saved assessments with patient search, reading filters, refresh, and detail links so staff can find and review captured vitals.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, RefreshCw } from "lucide-react";
import { isAbnormal, listTriageAssessments } from "@/shared/api/triage";
import { PageHeader } from "@/shared/components/PageHeader";
import { Input } from "@/shared/components/Input";

export function TriageAssessmentListPage() {
  const [params] = useSearchParams();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(params.get("status") ?? "ALL");
  const query = useQuery({ queryKey: ["triage", "assessments"], queryFn: listTriageAssessments });
  const rows = (query.data ?? []).filter(row =>
    `${row.patientName} ${row.patientMpi}`.toLowerCase().includes(search.toLowerCase()) &&
    (status === "ALL" || isAbnormal(row.assessment) === (status === "ABNORMAL")));
  return <div className="space-y-5">
    <PageHeader title="Triage assessments" action={<Link className="inline-flex items-center gap-2 text-brand-700" to="/app/triage/capture"><Plus size={18} />Capture vitals</Link>} />
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-0 flex-1"><Input label="Search assessments" value={search} onChange={e => setSearch(e.target.value)} placeholder="Patient name or MPI" /></div>
      <label className="text-sm">Readings<select aria-label="Readings" className="mt-1 block h-11 rounded-md border px-3" value={status} onChange={e => setStatus(e.target.value)}><option value="ALL">All readings</option><option value="ABNORMAL">Out of range</option><option value="NORMAL">Within range</option></select></label>
      <button title="Refresh assessments" aria-label="Refresh assessments" className="h-11 w-11 shrink-0 rounded-md border flex items-center justify-center" onClick={() => void query.refetch()}><RefreshCw size={18} /></button>
    </div>
    {query.isError ? <p role="alert" className="text-danger-600">{query.error.message}</p> : query.isPending ? <p>Loading assessments...</p> : <div className="overflow-x-auto">
      <table className="w-full text-left text-sm"><thead className="border-b bg-surface-raised"><tr>{["Patient", "Blood pressure", "Heart rate", "Temperature", "Readings", "Captured", "Details"].map(label => <th key={label} className="p-3 whitespace-nowrap">{label}</th>)}</tr></thead>
        <tbody>{rows.map(({ assessment: a, patientName, patientMpi }) => <tr key={a.id} className="border-b">
          <td className="p-3"><Link className="font-medium text-brand-700" to={`/app/triage/assessments/${a.id}`}>{patientName}</Link><div className="font-mono text-xs">{patientMpi}</div></td>
          <td className="p-3 whitespace-nowrap">{a.systolicBloodPressure}/{a.diastolicBloodPressure} mmHg</td><td className="p-3">{a.heartRate} bpm</td><td className="p-3">{a.temperatureCelsius} °C</td>
          <td className={`p-3 whitespace-nowrap ${isAbnormal(a) ? "text-warning-700" : "text-success-700"}`}>{isAbnormal(a) ? "Out of range" : "Within range"}</td><td className="p-3 whitespace-nowrap">{new Date(a.capturedAt).toLocaleString("en-ZA")}</td>
        <td className="p-3 whitespace-nowrap"><Link className="text-brand-700" aria-label={`View assessment for ${patientName}`} to={`/app/triage/assessments/${a.id}`}>View details</Link></td></tr>)}</tbody></table>{rows.length === 0 && <p className="py-10 text-center text-text-secondary">No assessments found.</p>}
    </div>}
  </div>;
}
