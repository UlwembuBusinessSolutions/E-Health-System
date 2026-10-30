import type { ReactNode } from "react";
import { Activity, TriangleAlert } from "lucide-react";
import type { TriageAssessment } from "@/shared/api/triage";
import { AdditionalVitalsSummary } from "./AdditionalVitals";
import { AVPU_OPTIONS, MOBILITY_OPTIONS, SCORING_PROFILE_OPTIONS } from "./VitalsDetailContent";
import { TriageColourBadge } from "@/shared/components/TriageColourBadge";
import { VitalStatusBadge } from "./VitalStatusBadge";
import {
  bloodPressureStatus,
  heartRateStatus,
  isSubOptimalReading,
  isWarned,
  painStatus,
  spo2Status,
  type VitalStatus,
} from "./vitalsStatus";

const LOCALE = "en-ZA";
const dayKey = (iso: string) => new Date(iso).toLocaleDateString(LOCALE);
const shortDate = (iso: string) => new Date(iso).toLocaleDateString(LOCALE, { day: "numeric", month: "short" });
const shortTime = (iso: string) => new Date(iso).toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit", hour12: false });

function MetricCard({
  label,
  value,
  unit,
  status,
  children,
}: {
  label: string;
  value: ReactNode;
  unit?: ReactNode;
  status?: VitalStatus | null;
  children?: ReactNode;
}) {
  return (
    <article className="vitals-dashboard-card min-h-[178px] rounded-[22px] border border-transparent bg-white p-6 sm:p-9">
      <div className="flex min-h-[38px] items-center justify-between gap-3">
        <p className="whitespace-nowrap text-[19px] font-medium leading-6 text-slate-800">{label}</p>
        {status && <VitalStatusBadge status={status} />}
      </div>
      <p className="mt-4 flex flex-wrap items-baseline gap-x-2 text-[42px] font-bold leading-none tracking-tight text-slate-900">
        {value}{unit && <span className="text-[20px] font-normal tracking-normal text-slate-500">{unit}</span>}
      </p>
      {children}
    </article>
  );
}

interface Band {
  min: number;
  max: number;
  label?: string;
}

// Small dot/line chart of the most recent readings. `band` draws the shaded
// "typical range" strip; `ticks` are the y-axis labels; `showValues` prints
// each reading above its dot. X labels are times when every point is from the
// same day, dates when each point is from a different day, and both otherwise.
function TrendChart({
  label,
  readings,
  select,
  limit,
  connect = false,
  showValues = false,
  band,
  ticks = [],
}: {
  label: string;
  readings: TriageAssessment[];
  select: (reading: TriageAssessment) => number | null;
  limit: number;
  connect?: boolean;
  showValues?: boolean;
  band?: Band;
  ticks?: number[];
}) {
  const values = readings
    .map((reading) => ({ reading, value: select(reading) }))
    .filter((item): item is { reading: TriageAssessment; value: number } => item.value != null)
    .slice(-limit);
  if (values.length < 2) return null;

  const left = 28;
  const right = 214;
  const top = 20;
  const bottom = 100;
  const plotMin = Math.min(...values.map((item) => item.value), band?.min ?? Infinity);
  const plotMax = Math.max(...values.map((item) => item.value), band?.max ?? -Infinity);
  const span = Math.max(1, plotMax - plotMin);
  const yOf = (value: number) => bottom - ((value - plotMin) / span) * (bottom - top);
  const points = values.map((item, index) => ({
    ...item,
    x: left + 16 + index * ((right - left - 32) / (values.length - 1)),
    y: yOf(item.value),
  }));

  const days = values.map((item) => dayKey(item.reading.observedAt));
  const sameDay = days.every((day) => day === days[0]);
  const uniqueDays = new Set(days).size === days.length;
  const bandTop = band ? yOf(band.max) : 0;
  const bandHeight = band ? Math.max(14, yOf(band.min) - bandTop) : 0;

  return (
    <div className="mt-5">
      <svg viewBox="0 0 220 132" role="img" aria-label={`${label} trend across ${values.length} readings`} className="h-auto w-full max-w-[260px] overflow-visible">
        <title>{`${label} trend`}</title>
        {band && <rect x={left} y={bandTop} width={right - left} height={bandHeight} rx="5" fill="#e8ecea" />}
        {band?.label && <text x={left + 6} y={bandTop + bandHeight / 2 + 3} fontSize="8" fill="#475569">{band.label}</text>}
        <line x1={left} y1={top - 4} x2={left} y2={bottom + 2} stroke="#dce5e2" strokeWidth="1" />
        {ticks.map((tick) => <text key={tick} x={left - 6} y={yOf(tick) + 3} textAnchor="end" fontSize="8" fill="#334155">{tick}</text>)}
        {connect && <polyline points={points.map(({ x, y }) => `${x},${y}`).join(" ")} fill="none" stroke="#dc2f3f" strokeWidth="1.5" strokeLinejoin="round" />}
        {points.map(({ reading, value, x, y }) => <g key={reading.id}>
          <circle cx={x} cy={y} r="3.5" fill="#dc2f3f" />
          {showValues && <text x={x} y={y - 8} textAnchor="middle" fontSize="8" fill="#334155">{value}</text>}
        </g>)}
        {points.map(({ reading, x }) => (
          <text key={`x-${reading.id}`} x={x} y={bottom + 18} textAnchor="middle" fontSize="8" fill="#475569">
            {sameDay ? shortTime(reading.observedAt) : uniqueDays ? shortDate(reading.observedAt) : <>
              <tspan x={x}>{shortDate(reading.observedAt)}</tspan>
              <tspan x={x} dy="10">{shortTime(reading.observedAt)}</tspan>
            </>}
          </text>
        ))}
      </svg>
    </div>
  );
}

const BAR_TONES = { pale: "bg-[#e3eae8]", optimal: "bg-[#b8cbc6]", latestOptimal: "bg-[#5c7d76]", subOptimal: "bg-[#ee82a2]" } as const;
const MAX_BARS = 10;

function HistoryCard({
  readings,
  totalCount,
  resultCounts,
}: {
  readings: TriageAssessment[];
  totalCount: number;
  resultCounts?: { optimal: number; subOptimal: number };
}) {
  const classified = readings.map((reading) => ({ reading, subOptimal: isSubOptimalReading(reading) }));
  const optimalCount = resultCounts?.optimal ?? classified.filter((item) => !item.subOptimal).length;
  const subOptimalCount = resultCounts?.subOptimal ?? classified.filter((item) => item.subOptimal).length;
  const visible = classified.slice(-MAX_BARS);
  // The most recent optimal reading is the darker "last known good" bar.
  let latestOptimalIndex = -1;
  visible.forEach((item, index) => { if (!item.subOptimal) latestOptimalIndex = index; });
  const toneOf = (item: { subOptimal: boolean }, index: number) =>
    item.subOptimal ? BAR_TONES.subOptimal
      : index === latestOptimalIndex ? BAR_TONES.latestOptimal
        : index === 0 && visible.length >= 8 ? BAR_TONES.pale
          : BAR_TONES.optimal;
  return (
    <article className="vitals-dashboard-card min-h-[178px] rounded-[22px] border border-transparent bg-white p-6 sm:p-9">
      <p className="flex min-h-[38px] items-center text-[19px] font-medium leading-6 text-slate-800">Overview</p>
      <p className="mt-4 text-[42px] font-bold leading-none tracking-tight text-slate-900">
        {optimalCount + subOptimalCount}/{totalCount}<span className="ml-2 text-[20px] font-normal tracking-normal text-slate-500">Results</span>
      </p>
      {visible.length > 0 ? <>
        <div className="mt-8 flex h-[100px] items-stretch gap-1.5" aria-label={`${visible.length} recent readings, optimal or sub-optimal`}>
          {visible.map((item, index) => <span key={item.reading.id} title={`${shortDate(item.reading.observedAt)} · ${item.subOptimal ? "sub-optimal" : "optimal"}`} className={`min-w-0 flex-1 rounded-full ${toneOf(item, index)}`} />)}
        </div>
        <div className="mt-4 h-1 rounded-full bg-gradient-to-r from-[#5c7d76] to-[#e5485f]" aria-hidden />
        <div className="mt-3 flex flex-wrap gap-x-10 gap-y-1 text-[14px] text-slate-800">
          <span>Optimal {optimalCount}</span>
          <span>Sub Optimal {subOptimalCount}</span>
        </div>
      </> : <p className="mt-5 text-sm text-slate-500">No reading history available.</p>}
    </article>
  );
}

export function VitalsDashboard({
  assessment,
  history = [assessment],
  totalCount = history.length,
  showAssessmentMeta = true,
  resultCounts,
}: {
  assessment: TriageAssessment;
  history?: TriageAssessment[];
  totalCount?: number;
  showAssessmentMeta?: boolean;
  /** Overrides the Optimal / Sub Optimal counts (e.g. totals from the server when `history` is only one page). */
  resultCounts?: { optimal: number; subOptimal: number };
}) {
  const a = assessment;
  const chronological = [...history].sort((first, second) => first.observedAt.localeCompare(second.observedAt));
  const profile = SCORING_PROFILE_OPTIONS.find((option) => option.value === a.scoringProfile)?.label ?? a.scoringProfile;
  const avpu = AVPU_OPTIONS.find((option) => option.value === a.avpu)?.label ?? a.avpu;
  const mobility = MOBILITY_OPTIONS.find((option) => option.value === a.mobility)?.label ?? a.mobility;
  const bpStatus = bloodPressureStatus(a.systolicBp, a.diastolicBp, a.scoringProfile, isWarned(a, /blood pressure|systolic|diastolic/i));
  const o2Status = spo2Status(a.spo2Percent, a.scoringProfile, isWarned(a, /spo|oxygen saturation/i));
  return <>
    {showAssessmentMeta && <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <TriageColourBadge colour={a.finalColour} />
        {a.tewsScore != null && <TewsPill score={a.tewsScore} profile={profile} />}
      </div>
      <p className="text-sm text-slate-600">Observed {new Date(a.observedAt).toLocaleString(LOCALE, { dateStyle: "medium", timeStyle: "short" })}</p>
    </div>}
    {a.outOfRangeConfirmed && a.validationWarnings && <div role="note" className="vitals-report-warning mb-12 flex gap-3 rounded-[16px] border border-red-300 bg-[#fee3e3] px-5 py-[20px] text-sm leading-6 text-slate-950 sm:text-base">
      <TriangleAlert className="mt-0.5 size-6 shrink-0" aria-hidden />
      <p><strong>Confirmed unusual measurements:</strong> {a.validationWarnings}</p>
    </div>}
    {a.emergencySign && a.emergencySignNote && <div role="note" className="vitals-report-warning mb-12 flex gap-3 rounded-[16px] border border-red-300 bg-[#fee3e3] px-5 py-[20px] text-sm leading-6 text-slate-950 sm:text-base">
      <TriangleAlert className="mt-0.5 size-6 shrink-0" aria-hidden /><p><strong>Emergency sign observed:</strong> {a.emergencySignNote}</p>
    </div>}

    <section className="vitals-dashboard-section">
      <h2 className="mb-5 text-xl font-bold text-slate-950">Vitals</h2>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {a.respiratoryRate != null && <MetricCard label="Resp. Rate" value={a.respiratoryRate} unit="/min" />}
        {a.heartRate != null && <MetricCard label="Heart Rate" value={a.heartRate} unit="bpm" status={heartRateStatus(a.heartRate, a.scoringProfile)} />}
        {a.systolicBp != null && <MetricCard label="Blood Pressure" value={`${a.systolicBp}/${a.diastolicBp ?? "—"}`} unit="mmHg" status={bpStatus} />}
        {a.temperatureCelsius != null && <MetricCard label="Temperature" value={a.temperatureCelsius} unit="°C" />}
        {a.spo2Percent != null && <MetricCard label="SpO₂" value={a.spo2Percent} unit="%" status={o2Status}>
          <TrendChart label="SpO₂" readings={chronological} select={(reading) => reading.spo2Percent} limit={4} showValues band={{ min: 94, max: 100, label: "Typical Range" }} ticks={[94, 100]} />
        </MetricCard>}
        <HistoryCard readings={chronological} totalCount={totalCount} resultCounts={resultCounts} />
        {a.mobility && <MetricCard label="Mobility" value={mobility} />}
        <MetricCard label="Oxygen" value={a.oxygenSupport === "SUPPLEMENTAL" ? "Supplemental" : "Room air"} />
        {a.painScore != null && <MetricCard label="Pain" value={`${a.painScore}/10`} status={painStatus(a.painScore)}>
          <TrendChart label="Pain" readings={chronological} select={(reading) => reading.painScore} limit={3} connect band={{ min: 0, max: 10 }} ticks={[0, 5, 10]} />
        </MetricCard>}
        {avpu && <MetricCard label="AVPU" value={avpu} />}
      </div>
    </section>

    {a.additionalObservations && <section className="vitals-dashboard-section mt-8"><AdditionalVitalsSummary value={a.additionalObservations} variant="report" scoringProfile={a.scoringProfile} /></section>}
  </>;
}

// The "TEWS 10 · Adult" pill, shared by the in-app dashboard header, the print
// report and the design preview so all three look identical.
export function TewsPill({ score, profile }: { score: number; profile: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-[#d7e4e1] px-4 py-2 text-sm font-semibold text-[#54766f]">
      <Activity className="size-3.5" aria-hidden />TEWS {score} · {profile}
    </span>
  );
}
