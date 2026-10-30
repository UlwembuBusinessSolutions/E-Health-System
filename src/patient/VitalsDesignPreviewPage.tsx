import type { TriageAssessment } from "@/shared/api/triage";
import { TriageColourBadge } from "@/shared/components/TriageColourBadge";
import { TewsPill, VitalsDashboard } from "./VitalsDashboard";

const observedAt = [
  "2026-01-25T08:00:00Z", "2026-01-25T08:30:00Z", "2026-01-25T09:00:00Z", "2026-01-26T08:00:00Z",
  "2026-01-26T08:30:00Z", "2026-01-27T08:00:00Z", "2026-10-20T07:30:00Z", "2026-10-20T08:00:00Z",
  "2026-10-20T08:30:00Z", "2026-10-20T09:05:00Z",
];
const spo2 = [96, 94, 92, 95, 93, 91, 82, 76, 73, 72];

const history: TriageAssessment[] = observedAt.map((date, index) => ({
  id: `preview-${index + 1}`,
  visitId: "preview-visit",
  status: "ACTIVE",
  supersedesAssessmentId: null,
  correctionReason: null,
  emergencySign: false,
  emergencySignNote: null,
  scoringProfile: "ADULT",
  profileManuallyConfirmed: false,
  respiratoryRate: index === 9 ? 59 : 18 + (index % 4),
  heartRate: index === 9 ? 73 : 72 + (index % 5),
  systolicBp: index === 9 ? 23 : 118 + index,
  diastolicBp: index === 9 ? 23 : 76 + (index % 4),
  temperatureCelsius: index === 9 ? 50 : 36.5 + (index % 3) * 0.1,
  spo2Percent: spo2[index],
  oxygenSupport: "ROOM_AIR",
  oxygenDevice: null,
  oxygenFlowLpm: null,
  avpu: index === 9 ? "CONFUSED" : "ALERT",
  mobility: "WALKING",
  painScore: index === 9 ? 10 : 2 + (index % 4),
  painScale: "NUMERIC",
  presentingComplaint: null,
  additionalObservations: index === 9 ? {
    traumaPresent: false,
    weightKg: 70,
    heightCm: 180,
    haemoglobinGdl: 10,
    bmi: 12.5,
  } : null,
  outOfRangeConfirmed: index === 9,
  validationWarnings: index === 9 ? "Systolic blood pressure 23; Temperature 50.0 °C" : null,
  discriminators: [],
  tewsScore: index === 9 ? 10 : 2,
  scoringVersion: "PREVIEW-DATA",
  calculatedColour: index === 9 ? "RED" : "GREEN",
  finalColour: index === 9 ? "RED" : "GREEN",
  overrideReason: null,
  overriddenByUserId: null,
  capturedByUserId: "preview-user",
  observedAt: date,
  recordedAt: date,
}));

export function VitalsDesignPreviewPage() {
  const latest = history[history.length - 1];
  return (
    <main className="min-h-screen bg-[#e9eeee] p-4">
      <div className="mx-auto max-w-[1540px] rounded-[28px] bg-[#f4f7f6] p-6 shadow-[0_18px_60px_rgba(21,45,43,.08)] sm:p-7">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-[20px] bg-white px-6 py-6 sm:px-8">
          <div className="flex flex-wrap items-center gap-5">
            <img src="/ulwembu-logo.png" alt="Ulwembu" className="h-14 w-auto max-w-48 object-contain" />
            <div className="hidden h-10 w-px bg-slate-200 sm:block" />
            <TriageColourBadge colour={latest.finalColour} />
            <TewsPill score={10} profile="Adult" />
          </div>
          <span className="font-mono text-xl font-medium text-slate-900">DC-0000008</span>
        </header>
        <section className="mt-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-[36px]">Patient Vitals Overview</h1>
            <p className="mt-1 text-base text-slate-600 sm:text-lg">Clinical data and triage record at a glance</p>
          </div>
          <p className="text-sm leading-6 text-slate-600 sm:text-right">Captured: <strong className="font-semibold text-slate-800">Sipho Mahlangu</strong><br />20 Oct 2026, 09:05</p>
        </section>
        <section className="mt-5"><VitalsDashboard assessment={latest} history={history} totalCount={47} resultCounts={{ optimal: 33, subOptimal: 7 }} showAssessmentMeta={false} /></section>
        <footer className="mt-8 flex flex-wrap justify-between gap-2 border-t border-slate-200 pt-4 text-xs text-slate-500">
          <span>Patient Vitals Overview · Clinical record</span>
          <span>Confidential patient information</span>
        </footer>
      </div>
      <span className="fixed right-4 top-4 z-10 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Development preview · synthetic data</span>
    </main>
  );
}
