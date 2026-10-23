import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRightLeft, Check, ChevronDown, CircleCheck, Clock3, HeartPulse, RefreshCw, Stethoscope, Ticket, XCircle } from "lucide-react";
import { getVisitTiming, type VisitTiming } from "@/shared/api/visitTiming";
import { Button } from "@/shared/components/Button";

export function formatElapsed(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return `${hours ? `${hours}h ` : ""}${minutes}m ${String(secs).padStart(2, "0")}s`;
}
const dateTime = new Intl.DateTimeFormat("en-ZA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" });
const labels = { CONSULTATION_FINISHED: "Consultation finished", VISIT_COMPLETED: "Visit completed", VISIT_CANCELLED: "Visit cancelled" };

function currentStage(timing: VisitTiming): string {
  if (!timing.active) return timing.completionReason ? labels[timing.completionReason] : "Visit finished";
  if (timing.consultationStartedAt) return "Consultation in progress";
  return timing.firstVitalsAt ? "Awaiting consultation" : "Awaiting assessment";
}

function Timeline({ timing }: { timing: VisitTiming }) {
  const stages = [
    { label: "Check-in", value: timing.startedAt, icon: Ticket, pending: "Not recorded", current: false },
    { label: "Vitals", value: timing.firstVitalsAt, icon: HeartPulse, pending: timing.active && !timing.consultationStartedAt ? "Awaiting reading" : "No reading recorded", current: timing.active && !timing.firstVitalsAt && !timing.consultationStartedAt },
    { label: "Consultation", value: timing.consultationStartedAt, icon: Stethoscope, pending: timing.active ? "Not started" : "Not recorded", current: timing.active && !!timing.consultationStartedAt },
    { label: "Finish", value: timing.finishedAt, icon: timing.completionReason === "VISIT_CANCELLED" ? XCircle : CircleCheck, pending: "Visit in progress", current: false },
  ];
  return <ol aria-label="Visit milestones" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    {stages.map(({ label, value, icon: Icon, pending, current }, index) => (
      <li key={label} aria-current={current ? "step" : undefined} className="relative flex min-w-0 gap-3">
        <span className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-full border ${current ? "border-brand-400 bg-brand-50 text-brand-700 ring-4 ring-brand-50" : value ? "border-brand-200 bg-brand-50 text-brand-600" : "border-border-subtle bg-surface text-text-secondary"}`}>
          {value && !current ? <Check className="size-4" aria-hidden /> : <Icon className="size-4" aria-hidden />}
        </span>
        <div className="min-w-0 pt-0.5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">{String(index + 1).padStart(2, "0")} · {label}</p>
          <p className={`mt-1 text-[13px] font-medium ${value || current ? "text-text-primary" : "text-text-secondary"}`}>
            {value ? <time dateTime={value} title={new Date(value).toLocaleString("en-ZA")}>{dateTime.format(new Date(value))}</time> : pending}
          </p>
          {current && value && <span className="mt-1 block text-[11px] font-medium text-brand-600">In progress</span>}
        </div>
      </li>
    ))}
  </ol>;
}

export function VisitTimingSummary({ timing, receivedAt, compact = false, action }: {
  timing: VisitTiming; receivedAt: number; compact?: boolean; action?: ReactNode;
}) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!timing.active) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [timing.active]);
  // Start with server-computed elapsed time, then add only time since this snapshot arrived.
  const extra = timing.active ? Math.max(0, Math.floor((now - receivedAt) / 1000)) : 0;
  const elapsed = timing.elapsedSeconds + extra;
  const before = timing.beforeConsultationSeconds + (timing.active && !timing.consultationStartedAt ? extra : 0);
  const consultation = timing.consultationSeconds === null ? null : timing.consultationSeconds + (timing.active ? extra : 0);
  const cancelled = timing.completionReason === "VISIT_CANCELLED";
  const status = currentStage(timing);
  return (
    <section aria-label="Patient time tracking" className={`overflow-hidden rounded-2xl border border-border-subtle bg-surface-raised text-left ${compact ? "mt-4" : "my-5 shadow-card"}`}>
      <header className={`flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle ${compact ? "px-4 py-3" : "px-5 py-4 sm:px-6"}`}>
        <h3 className="flex items-center gap-2 text-[14px] font-semibold text-text-primary"><Clock3 className="size-4 text-brand-600" aria-hidden />Patient time tracking</h3>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium ${cancelled ? "bg-ink-100 text-ink-600" : timing.active ? "bg-brand-50 text-brand-700" : "bg-success-50 text-success-600"}`}>
            {timing.active ? <span className="size-1.5 rounded-full bg-current" aria-hidden /> : cancelled ? <XCircle className="size-3.5" aria-hidden /> : <CircleCheck className="size-3.5" aria-hidden />}{status}
          </span>
          {action}
        </div>
      </header>
      <div className={`grid gap-4 ${compact ? "px-4 py-3 sm:grid-cols-2" : "px-5 py-5 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] sm:gap-6 sm:px-6"}`}>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">{timing.active ? "Total time so far" : "Total visit time"}</p>
          <p role="timer" aria-label="Elapsed visit time" className={`mt-1 font-mono font-semibold leading-tight tabular-nums tracking-tight text-text-primary ${compact ? "text-[25px]" : "text-[32px] sm:text-[38px]"}`}>{formatElapsed(elapsed)}</p>
          <p className="mt-2 text-[12px] leading-relaxed text-text-secondary">{timing.active ? "Tracking from check-in. Updates automatically." : "Final duration · timer stopped."}</p>
        </div>
        <dl className="grid grid-cols-2 gap-3 self-center">
          <div className="min-w-0 rounded-xl bg-surface-sunken p-3">
            <dt className="text-[11px] leading-relaxed text-text-secondary">Before consultation</dt>
            <dd className="mt-1 break-words font-mono text-[14px] font-semibold tabular-nums text-text-primary">{formatElapsed(before)}</dd>
          </div>
          <div className="min-w-0 rounded-xl bg-surface-sunken p-3">
            <dt className="text-[11px] leading-relaxed text-text-secondary">Consultation time</dt>
            <dd className="mt-1 break-words font-mono text-[14px] font-semibold tabular-nums text-text-primary">{consultation === null ? "Not started" : formatElapsed(consultation)}</dd>
          </div>
        </dl>
      </div>
      {compact ? <details className="group border-t border-border-subtle">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 py-3 text-[12px] font-semibold text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400">
          View timeline<ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="px-4 pb-4"><Timeline timing={timing} /></div>
      </details> : <div className="border-t border-border-subtle bg-surface/50 px-5 py-5 sm:px-6"><Timeline timing={timing} /></div>}
      {timing.visitId !== timing.journeyVisitId && <p className="flex items-center gap-2 border-t border-border-subtle px-4 py-3 text-[12px] text-text-secondary"><ArrowRightLeft className="size-4 shrink-0" aria-hidden />Includes time at the previous facility.</p>}
    </section>
  );
}

export function VisitTimingPanel({ visitId }: { visitId: string }) {
  const query = useQuery({ queryKey: ["visit-timing", visitId], queryFn: () => getVisitTiming(visitId), refetchInterval: 10_000 });
  if (query.isPending) return <section aria-label="Patient time tracking" role="status" className="my-5 space-y-3 rounded-2xl border border-border-subtle bg-surface-raised p-6"><p className="text-[13px] text-text-secondary">Loading patient time tracking…</p><div className="h-16 animate-pulse rounded-lg bg-surface-sunken motion-reduce:animate-none" aria-hidden /></section>;
  if (!query.data) return <section aria-label="Patient time tracking" role="alert" className="my-5 rounded-2xl border border-border-subtle bg-surface-raised p-5"><h3 className="font-semibold text-text-primary">Patient timing is unavailable</h3><p className="mb-3 mt-1 text-[13px] text-text-secondary">We couldn't load the visit timeline. Try again.</p><Button variant="secondary" onClick={() => void query.refetch()}>Retry timing</Button></section>;
  return <>
    <VisitTimingSummary timing={query.data} receivedAt={query.dataUpdatedAt} action={
      <Button variant="ghost" aria-label="Refresh patient timing" disabled={query.isFetching} onClick={() => void query.refetch()} icon={<RefreshCw className={`size-3.5 ${query.isFetching ? "animate-spin motion-reduce:animate-none" : ""}`} aria-hidden />}>Refresh</Button>
    } />
    {query.isRefetchError && <p role="status" className="mb-4 text-[12px] text-text-secondary">Live updates are unavailable. Showing the last known visit status. Use Refresh to try again.</p>}
  </>;
}
