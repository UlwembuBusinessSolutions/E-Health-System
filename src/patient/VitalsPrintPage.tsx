import { useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { getPatientVitalsHistory, getVitalsAssessment } from "@/shared/api/triage";
import { getOrganizationSelf } from "@/shared/api/organization";
import { TewsPill, VitalsDashboard } from "./VitalsDashboard";
import { SCORING_PROFILE_OPTIONS } from "./VitalsDetailContent";
import { TriageColourBadge } from "@/shared/components/TriageColourBadge";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" });
}

export function VitalsPrintPage() {
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get("patientId") ?? "";
  const query = useQuery({
    queryKey: ["vitals-assessment", assessmentId],
    queryFn: () => getVitalsAssessment(assessmentId as string),
    enabled: !!assessmentId,
  });
  const historyQuery = useQuery({
    queryKey: ["patient-vitals-history", patientId, "print"],
    queryFn: () => getPatientVitalsHistory(patientId, { page: 0, pageSize: 50, ascending: true }),
    enabled: !!patientId,
  });
  const orgQuery = useQuery({ queryKey: ["organization", "self"], queryFn: getOrganizationSelf });

  useEffect(() => {
    if (!query.data || (patientId && historyQuery.isLoading)) return;
    const timeout = setTimeout(() => window.print(), 200);
    return () => clearTimeout(timeout);
  }, [query.data, patientId, historyQuery.isLoading]);

  if (!assessmentId) return <p className="p-6 text-center text-sm text-slate-600">No vitals reading specified.</p>;
  if (query.isLoading || (patientId && historyQuery.isLoading)) return <p className="p-6 text-center text-sm text-slate-600">Loading vitals…</p>;
  if (query.isError || !query.data) return <p className="p-6 text-center text-sm text-red-700">Couldn’t load this vitals reading.</p>;

  const { assessment, capturedByName, patientName, patientMpi } = query.data;
  const org = orgQuery.data;
  const history = historyQuery.data?.items.map((entry) => entry.assessment) ?? [assessment];
  const reportHistory = history.some((reading) => reading.id === assessment.id) ? history : [...history, assessment];
  const profileLabel = SCORING_PROFILE_OPTIONS.find((option) => option.value === assessment.scoringProfile)?.label ?? assessment.scoringProfile;

  return (
    <main className="vitals-report-page min-h-screen bg-[#e9eeee] p-4 text-slate-950 sm:p-6 lg:p-8">
      <style>{`
        @page { size: A4 landscape; margin: 10mm; }
        @media print {
          html, body, #root { background: #fff !important; }
          .vitals-report-page { min-height: 0 !important; padding: 0 !important; background: #fff !important; }
          .vitals-report-frame { max-width: none !important; padding: 0 !important; box-shadow: none !important; }
          .vitals-report-header, .vitals-dashboard-card, .vitals-report-warning { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .vitals-dashboard-card, .vitals-report-warning, .vitals-dashboard-section { break-inside: avoid; }
          .vitals-report-print-button { display: none !important; }
        }
      `}</style>
      <div className="vitals-report-frame mx-auto max-w-[1540px] rounded-[28px] bg-[#f4f7f6] p-6 shadow-[0_18px_60px_rgba(21,45,43,.08)] sm:p-7">
        <header className="vitals-report-header flex flex-wrap items-center justify-between gap-4 rounded-[20px] bg-white px-6 py-6 sm:px-8">
          <div className="flex min-w-0 items-center gap-5">
            <img src={org?.logoUrl ?? "/ulwembu-logo.png"} alt={org?.displayName ?? "Ulwembu"} className="h-14 w-auto max-w-48 object-contain" />
            <div className="hidden h-10 w-px bg-slate-200 sm:block" />
            <div className="flex flex-wrap items-center gap-3">
              <TriageColourBadge colour={assessment.finalColour} />
              {assessment.tewsScore != null && <TewsPill score={assessment.tewsScore} profile={profileLabel} />}
            </div>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-[12px] font-medium uppercase tracking-wide text-slate-500">Patient record</p>
            <p className="mt-0.5 font-mono text-xl font-semibold text-slate-900">{patientMpi}</p>
          </div>
        </header>

        <section className="mt-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-[36px]">Patient Vitals Overview</h1>
            <p className="mt-1 text-base text-slate-600 sm:text-lg">Clinical data and triage record at a glance</p>
            <p className="mt-2 text-sm font-medium text-slate-700">{patientName}</p>
          </div>
          <p className="text-sm leading-6 text-slate-600 sm:text-right">
            Captured: <strong className="font-semibold text-slate-800">{capturedByName ?? "Staff member"}</strong><br />
            {formatDateTime(assessment.observedAt)}
          </p>
        </section>

        <section className="mt-5">
          <VitalsDashboard assessment={assessment} history={reportHistory} totalCount={historyQuery.data?.totalElements ?? reportHistory.length} showAssessmentMeta={false} />
        </section>

        {(assessment.presentingComplaint || assessment.discriminators.length > 0) && <section className="mt-7 rounded-[20px] bg-white p-6">
          <h2 className="text-lg font-bold text-slate-950">Clinical notes</h2>
          {assessment.presentingComplaint && <p className="mt-3 text-sm leading-6 text-slate-700">{assessment.presentingComplaint}</p>}
          {assessment.discriminators.length > 0 && <p className="mt-3 text-sm text-slate-600">Triage indicators: {assessment.discriminators.map((item) => item.replaceAll("_", " ").toLowerCase()).join(", ")}</p>}
        </section>}

        <footer className="mt-8 flex flex-wrap justify-between gap-2 border-t border-slate-200 pt-4 text-xs text-slate-500">
          <span>Patient Vitals Overview · Clinical record · {org?.displayName ?? "Ulwembu"}</span>
          <span>Confidential patient information</span>
        </footer>
      </div>
      <button type="button" onClick={() => window.print()} className="vitals-report-print-button fixed bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#164e63] px-5 py-3 text-sm font-semibold text-white shadow-lg">
        <Printer className="size-4" aria-hidden />Print again
      </button>
    </main>
  );
}
