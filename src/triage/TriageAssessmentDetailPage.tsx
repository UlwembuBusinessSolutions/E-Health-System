// Lihle | 2026-09-09 | Load the saved assessment and visit, compare prior readings, and add follow-up links so staff can review patient context and continue care workflows.
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { getTriageAssessment, isAbnormal } from "@/shared/api/triage";
import { getVisit } from "@/shared/api/visits";
import { PageHeader } from "@/shared/components/PageHeader";

export function TriageAssessmentDetailPage() {
  const { id } = useParams();
  const query = useQuery({ queryKey: ["triage", "assessment", id], queryFn: () => getTriageAssessment(id!), enabled: !!id });
  const a = query.data?.assessment;
  const prior = query.data?.priorAssessment;
  const visit = useQuery({ queryKey: ["visit", a?.visitId], queryFn: () => getVisit(a!.visitId), enabled: !!a });
  if (query.isError) return <div className="space-y-4"><p role="alert" className="text-danger-600">{query.error.message}</p><button className="rounded-md border px-4 py-2" onClick={() => void query.refetch()}>Try again</button><Link className="ml-4 text-brand-700" to="/app/triage/list">All assessments</Link></div>;
  if (!a) return <p>Loading assessment...</p>;
  const readings = [
    ["Blood pressure", `${a.systolicBloodPressure}/${a.diastolicBloodPressure}`, prior ? `${prior.systolicBloodPressure}/${prior.diastolicBloodPressure}` : "", "mmHg"],
    ["Heart rate", a.heartRate, prior?.heartRate, "bpm"],
    ["Temperature", a.temperatureCelsius, prior?.temperatureCelsius, "°C"],
    ["Respiratory rate", a.respiratoryRate, prior?.respiratoryRate, "breaths/min"],
    ["Alertness", a.avpu, prior?.avpu, ""],
  ];
  return <div className="space-y-5">
    <PageHeader title="Triage assessment" description={visit.data ? `${visit.data.patientName} - ${visit.data.patientMpi}` : undefined} />
    {visit.isPending ? <p className="text-sm text-text-secondary">Loading patient and visit details...</p> : visit.isError ? <div role="alert" className="text-sm text-danger-600">Unable to load patient and visit details: {visit.error.message} <button className="underline" onClick={() => void visit.refetch()}>Try again</button></div> : null}
    <dl className="grid gap-4 rounded-lg border border-border-subtle bg-surface-raised p-4 sm:grid-cols-2">
      <div><dt className="text-xs text-text-secondary">Patient</dt><dd className="mt-1"><Link className="text-brand-700" to={`/app/patients/${a.patientId}`}>{visit.data?.patientName ?? a.patientId}</Link></dd></div>
      <div><dt className="text-xs text-text-secondary">MPI</dt><dd className="mt-1 font-mono text-sm">{visit.data?.patientMpi ?? "Unavailable"}</dd></div>
      <div><dt className="text-xs text-text-secondary">Visit date</dt><dd className="mt-1 text-sm">{visit.data ? new Date(visit.data.visitDateTime).toLocaleString("en-ZA") : "Unavailable"}</dd></div>
      <div><dt className="text-xs text-text-secondary">Service stream</dt><dd className="mt-1 text-sm">{visit.data?.serviceStream.replaceAll("_", " ") ?? "Unavailable"}</dd></div>
      <div><dt className="text-xs text-text-secondary">Assessment ID</dt><dd className="mt-1 break-all font-mono text-sm">{a.id}</dd></div>
      <div><dt className="text-xs text-text-secondary">Captured by (user ID)</dt><dd className="mt-1 break-all font-mono text-sm">{a.capturedByUserId || "Unavailable"}</dd></div>
    </dl>
    <p className="text-sm">Captured {new Date(a.capturedAt).toLocaleString("en-ZA")}<span className={`ml-3 ${isAbnormal(a) ? "text-warning-700" : "text-success-700"}`}>{isAbnormal(a) ? "Out-of-range readings" : "Within configured ranges"}</span></p>
    <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b"><tr><th className="p-3">Observation</th><th className="p-3">Recorded</th>{prior && <th className="p-3">Prior</th>}</tr></thead><tbody>{readings.map(([label, value, previous, unit]) => <tr key={label} className="border-b"><th className="p-3 font-medium">{label}</th><td className="p-3">{value} {unit}</td>{prior && <td className="p-3">{previous} {unit}</td>}</tr>)}</tbody></table></div>
    {prior && <p className="text-xs text-text-secondary">Prior assessment: {new Date(prior.capturedAt).toLocaleString("en-ZA")}</p>}
    <nav className="flex flex-wrap gap-5 text-sm text-brand-700"><Link to="/app/triage/list">All assessments</Link><Link to={`/app/triage/capture/${a.visitId}`}>Capture another reading</Link><Link to={`/app/pharmacy/create?visitId=${a.visitId}`}>Create prescription</Link></nav>
  </div>;
}
