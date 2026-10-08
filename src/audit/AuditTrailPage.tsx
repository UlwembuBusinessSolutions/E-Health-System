import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Activity, CalendarDays, ChevronLeft, ChevronRight, ClipboardList, Download, RefreshCw, ShieldCheck } from "lucide-react";
import { exportTenantAudit, listTenantAudit } from "@/shared/api/audit";
import { ApiError } from "@/shared/api/client";
import { Button } from "@/shared/components/Button";
import { useToast } from "@/shared/components/toast/ToastProvider";
import "./AuditTrailPage.css";

const PAGE_SIZE = 50;
function dateIso(daysAgo = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function label(value: string): string {
  const text = value.replaceAll("_", " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}
function formattedValue(value: string | null): string {
  if (value === null) return "Not recorded";
  try { return JSON.stringify(JSON.parse(value), null, 2); } catch { return value; }
}
export function AuditTrailPage() {
  const { showToast } = useToast();
  const [page, setPage] = useState(0);
  const [from, setFrom] = useState(() => dateIso());
  const [to, setTo] = useState(() => dateIso());
  const invalidRange = Boolean(from && to && from > to);
  const auditQuery = useQuery({
    queryKey: ["tenant", "audit", { from, to, page }],
    queryFn: () => listTenantAudit({ page, size: PAGE_SIZE, from: from || undefined, to: to || undefined }),
    enabled: !invalidRange,
  });
  const exportMutation = useMutation({
    mutationFn: () => exportTenantAudit({ from: from || undefined, to: to || undefined }),
    onSuccess: () => showToast("Audit trail exported.", "success"),
    onError: (error) => showToast(error instanceof ApiError ? error.message : "Couldn't export the audit trail. Try again.", "error"),
  });
  function range(start: string, end: string) { setFrom(start); setTo(end); setPage(0); }
  const entries = auditQuery.data?.items ?? [];
  const total = auditQuery.data?.totalItems ?? 0;
  const ready = auditQuery.isSuccess && !invalidRange;
  const presets = [{ title: "Today", days: 0 }, { title: "Last 7 days", days: 6 }, { title: "Last 30 days", days: 29 }];
  return (
    <div className="tenant-audit">
      <header className="ta-header">
        <div className="ta-heading"><span className="ta-emblem"><ShieldCheck size={25} aria-hidden /></span><div>
          <p className="ta-eyebrow">Organization activity</p><h1>Audit trail</h1>
          <p>Follow staff activity and changes across your organization.</p>
        </div></div>
        <Button icon={<Download size={16} aria-hidden />} loading={exportMutation.isPending} disabled={invalidRange} onClick={() => exportMutation.mutate()}>Export CSV</Button>
      </header>
      <section className="ta-filters" aria-label="Filter audit trail">
        <div className="ta-filter-top"><span><CalendarDays size={16} aria-hidden /> Date range</span><div className="ta-presets">
          {presets.map(preset => <button key={preset.title} type="button" aria-pressed={from === dateIso(preset.days) && to === dateIso()} onClick={() => range(dateIso(preset.days), dateIso())}>{preset.title}</button>)}
          <button type="button" aria-pressed={!from && !to} onClick={() => range("", "")}>All history</button>
        </div></div>
        <div className="ta-date-fields">
          <label htmlFor="audit-from">From<input id="audit-from" type="date" value={from} max={to || undefined} onChange={e => range(e.target.value, to)} /></label>
          <span className="ta-date-separator" aria-hidden>—</span>
          <label htmlFor="audit-to">To<input id="audit-to" type="date" value={to} min={from || undefined} onChange={e => range(from, e.target.value)} /></label>
          <p>{invalidRange ? "Choose an end date on or after the start date." : !from && !to ? "Showing all recorded activity." : "Activity within your selected dates, inclusive."}</p>
        </div>
      </section>
      <section className="ta-log" aria-labelledby="activity-heading" aria-busy={auditQuery.isFetching}>
        <div className="ta-log-heading"><div><h2 id="activity-heading"><Activity size={18} aria-hidden /> Activity log <span className="ta-count">{ready ? total.toLocaleString() : "—"}</span></h2><p>Open an event to view record changes and device details.</p></div>
          <Button variant="secondary" icon={<RefreshCw size={14} aria-hidden />} loading={auditQuery.isFetching} disabled={invalidRange} onClick={() => void auditQuery.refetch()}>Refresh</Button>
        </div>
        {invalidRange ? <div className="ta-state" role="alert"><CalendarDays size={28} aria-hidden /><h3>Check your date range</h3><p>The end date must be on or after the start date.</p></div>
          : auditQuery.isLoading ? <div className="ta-loading" role="status"><span className="sr-only">Loading audit trail</span>{[0, 1, 2, 3, 4].map(i => <div key={i} className="animate-pulse" />)}</div>
          : auditQuery.isError ? <div className="ta-state" role="alert"><ClipboardList size={28} aria-hidden /><h3>Activity couldn't be loaded</h3><p>Please try again to retrieve your organization's audit trail.</p><Button variant="secondary" onClick={() => void auditQuery.refetch()}>Retry</Button></div>
          : entries.length === 0 ? <div className="ta-state"><span className="ta-emblem"><ClipboardList size={28} aria-hidden /></span><h3>{from || to ? "No activity in this date range" : "No activity recorded yet"}</h3><p>{from || to ? "Try a wider date range to find earlier events." : "Recorded events will appear here as your team works."}</p>{(from || to) && <Button variant="secondary" onClick={() => range("", "")}>Show all history</Button>}</div>
          : <>
            <div className="ta-columns" aria-hidden><span>Event / record</span><span>Performed by</span><span>Date & time</span><span /></div>
            <div className="ta-events">{entries.map(entry => <details key={entry.id} className="ta-event">
              <summary>
                <div className="ta-event-main"><span className="ta-event-icon"><Activity size={16} aria-hidden /></span><div><strong>{label(entry.action)}</strong><span className="ta-entity">{label(entry.entityType)}</span></div></div>
                <div className="ta-actor"><span className="ta-avatar" aria-hidden>{(entry.actorName || "Unknown").split(/\s+/).slice(0, 2).map(part => part[0]).join("")}</span><span>{entry.actorName || "Unknown actor"}</span></div>
                <time dateTime={entry.createdAt}><span>{new Date(entry.createdAt).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}</span><small>{new Date(entry.createdAt).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</small></time>
                <ChevronRight className="ta-chevron" size={16} aria-hidden />
              </summary>
              <div className="ta-detail">
                <div className="ta-detail-title">Event details <span>{entry.id}</span></div>
                <dl><div><dt>Record ID</dt><dd>{entry.entityId || "Not recorded"}</dd></div><div><dt>IP address</dt><dd>{entry.ipAddress || "Not recorded"}</dd></div><div className="ta-device"><dt>Device</dt><dd>{entry.deviceSignature || "Not recorded"}</dd></div></dl>
                {(entry.beforeValue !== null || entry.afterValue !== null) && <div className="ta-changes"><div><h4>Before</h4><pre>{formattedValue(entry.beforeValue)}</pre></div><div><h4>After</h4><pre>{formattedValue(entry.afterValue)}</pre></div></div>}
              </div>
            </details>)}</div>
            <footer className="ta-pagination"><p>Showing <strong>{page * PAGE_SIZE + 1}–{page * PAGE_SIZE + entries.length}</strong> of <strong>{total.toLocaleString()}</strong> events</p><div><Button variant="secondary" icon={<ChevronLeft size={15} aria-hidden />} disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>Previous</Button><span>Page {page + 1}</span><Button variant="secondary" icon={<ChevronRight size={15} aria-hidden />} disabled={!auditQuery.data?.hasMore} onClick={() => setPage(p => p + 1)}>Next</Button></div></footer>
          </>}
      </section>
    </div>
  );
}
