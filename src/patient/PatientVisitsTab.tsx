import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRightLeft, Building2, CalendarDays, ChevronLeft, ChevronRight, Clock3, Search, History } from "lucide-react";
import { getPatientVisitHistory, type ServiceStream, type VisitType } from "@/shared/api/visits";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";

const types: Record<VisitType, string> = { NEW: "New visit", FOLLOW_UP: "Follow-up" };
const streams: Record<ServiceStream, string> = {
  GENERAL: "General", CHRONIC_CARE: "Chronic care", MATERNAL_CHILD: "Maternal & child", OCCUPATIONAL_HEALTH: "Occupational health",
};
const dateFormat = new Intl.DateTimeFormat("en-ZA", { day: "numeric", month: "short", year: "numeric" });
const timeFormat = new Intl.DateTimeFormat("en-ZA", { hour: "2-digit", minute: "2-digit" });
const pageSize = 10;
const controlClass = "h-11 w-full rounded-lg border border-border-strong bg-surface-raised px-3 text-[14px] text-text-primary outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

export function PatientVisitsTab({ patientId }: { patientId: string }) {
  const id = useId();
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [order, setOrder] = useState("newest");
  const [page, setPage] = useState(1);
  const query = useQuery({ queryKey: ["patients", patientId, "visits"], queryFn: () => getPatientVisitHistory(patientId) });
  const visits = query.data ?? [];
  const filtered = visits.filter(visit => (!type || visit.visitType === type) &&
    `${visit.facilityName ?? "Unknown facility"} ${streams[visit.serviceStream] ?? visit.serviceStream} ${types[visit.visitType] ?? visit.visitType}`.toLowerCase().includes(search.trim().toLowerCase()),
  ).sort((a, b) => (Date.parse(b.visitDateTime) - Date.parse(a.visitDateTime)) * (order === "newest" ? 1 : -1));
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const offset = (currentPage - 1) * pageSize;
  const latest = visits.reduce<string | null>((value, visit) => !value || Date.parse(visit.visitDateTime) > Date.parse(value) ? visit.visitDateTime : value, null);
  // Every visit this patient has is already in `visits` — resolving a
  // transfer's source facility is just a lookup against that same list, no
  // extra request needed.
  const facilityNameByVisitId = new Map(visits.map(visit => [visit.id, visit.facilityName ?? "Unknown facility"]));
  function clearFilters() { setSearch(""); setType(""); setPage(1); }

  return (
    <Card className="mb-6 overflow-hidden">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border-subtle p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><History className="size-5" aria-hidden /></span>
          <div><h2 className="text-[18px] font-semibold text-text-primary">Visit history</h2><p className="mt-1 text-[13px] text-text-secondary">Care across facilities, in one place.</p></div>
        </div>
        {query.isSuccess && <span className="rounded-full border border-border-subtle bg-surface px-3 py-1.5 text-[12px] font-medium text-text-secondary">{visits.length} {visits.length === 1 ? "visit" : "visits"} recorded</span>}
      </header>

      {query.isPending ? <div role="status" className="space-y-4 p-6"><p className="text-[14px] text-text-secondary">Loading visit history…</p>{[0, 1, 2].map(i => <div key={i} aria-hidden className="h-20 animate-pulse rounded-xl bg-surface-sunken motion-reduce:animate-none" />)}</div>
        : query.isError ? <div role="alert" className="space-y-3 p-6"><p className="text-[14px] text-text-secondary">Visit history could not be loaded. Please try again.</p><Button variant="secondary" loading={query.isFetching} onClick={() => void query.refetch()}>Retry</Button></div>
        : visits.length === 0 ? <div className="flex flex-col items-center px-6 py-14 text-center"><CalendarDays className="mb-3 size-8 text-text-secondary" aria-hidden /><h3 className="text-[15px] font-semibold text-text-primary">No visits recorded yet</h3><p className="mt-2 max-w-sm text-[13px] leading-relaxed text-text-secondary">When a visit is started for this patient, its date, facility and service will appear here.</p></div>
        : <>
          <dl className="grid grid-cols-2 gap-4 border-b border-border-subtle bg-surface/60 px-5 py-4 sm:px-6">
            <div><dt className="text-[12px] text-text-secondary">Most recent visit</dt><dd className="mt-1 text-[14px] font-semibold text-text-primary">{latest ? dateFormat.format(new Date(latest)) : "—"}</dd></div>
            <div><dt className="text-[12px] text-text-secondary">Facilities visited</dt><dd className="mt-1 text-[14px] font-semibold text-text-primary">{new Set(visits.map(visit => visit.facilityId)).size}</dd></div>
          </dl>
          <div className="grid gap-3 p-5 sm:grid-cols-[minmax(0,1fr)_150px_150px] sm:p-6">
            <label className="block"><span className="mb-1.5 block text-[12px] font-medium text-text-secondary">Search visits</span><span className="relative block"><Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-text-secondary" aria-hidden /><input type="search" placeholder="Search facility or service" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} className={`${controlClass} pl-9`} /></span></label>
            <div><label htmlFor={`${id}-type`}><span className="mb-1.5 block text-[12px] font-medium text-text-secondary">Visit type</span></label><select id={`${id}-type`} value={type} onChange={event => { setType(event.target.value); setPage(1); }} className={controlClass}><option value="">All visit types</option><option value="NEW">New visit</option><option value="FOLLOW_UP">Follow-up</option></select></div>
            <div><label htmlFor={`${id}-sort`}><span className="mb-1.5 block text-[12px] font-medium text-text-secondary">Sort by</span></label><select id={`${id}-sort`} value={order} onChange={event => { setOrder(event.target.value); setPage(1); }} className={controlClass}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></div>
          </div>
          {filtered.length === 0 ? <div role="status" className="px-6 pb-10 pt-3 text-center"><h3 className="font-semibold text-text-primary">No matching visits</h3><p className="mb-4 mt-1 text-[13px] text-text-secondary">Try a different facility, service or visit type.</p><Button variant="secondary" onClick={clearFilters}>Clear filters</Button></div>
            : <ol aria-label="Patient visit history" className="px-5 sm:px-6">
              {filtered.slice(offset, offset + pageSize).map(visit => {
                const date = new Date(visit.visitDateTime);
                return <li key={visit.id} className="relative border-l border-border-subtle pb-4 pl-5 last:pb-0 sm:pl-6">
                  <span aria-hidden className="absolute -left-[5px] top-6 size-[9px] rounded-full bg-brand-500 ring-4 ring-surface-raised" />
                  <article className="rounded-xl border border-border-subtle bg-surface-raised p-4 transition-colors hover:bg-surface/60 sm:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <time dateTime={visit.visitDateTime} className="text-[14px] font-semibold text-text-primary">{dateFormat.format(date)}</time>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${visit.visitType === "FOLLOW_UP" ? "bg-brand-50 text-brand-700" : "bg-surface-sunken text-text-secondary"}`}>{types[visit.visitType] ?? visit.visitType}</span>
                    </div>
                    <p className="mt-3 flex items-start gap-2 text-[15px] font-medium text-text-primary"><Building2 className="mt-0.5 size-4 shrink-0 text-text-secondary" aria-hidden /><span className="min-w-0 break-words">{visit.facilityName ?? "Unknown facility"}</span></p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-text-secondary"><span>{streams[visit.serviceStream] ?? visit.serviceStream}</span><span className="inline-flex items-center gap-1.5"><Clock3 className="size-3.5" aria-hidden />{timeFormat.format(date)}</span></div>
                    {visit.transferredFromVisitId && <p className="mt-3 flex items-center gap-2 border-t border-border-subtle pt-3 text-[12px] text-brand-600"><ArrowRightLeft className="size-3.5 shrink-0" aria-hidden />Transferred from {facilityNameByVisitId.get(visit.transferredFromVisitId) ?? "another facility"}</p>}
                  </article>
                </li>;
              })}
            </ol>}
          <footer className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle px-5 py-4 sm:px-6">
            <p role="status" className="text-[12px] text-text-secondary">{filtered.length ? `${offset + 1}–${Math.min(offset + pageSize, filtered.length)} of ${filtered.length} visits` : "0 visits"}{(search.trim() || type) && ` · ${visits.length} total`}</p>
            {pages > 1 && <div className="flex items-center gap-2"><Button variant="secondary" aria-label="Previous visits" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft className="size-4" aria-hidden /></Button><span className="text-[12px] text-text-secondary">{currentPage} / {pages}</span><Button variant="secondary" aria-label="Next visits" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}><ChevronRight className="size-4" aria-hidden /></Button></div>}
          </footer>
        </>}
    </Card>
  );
}
