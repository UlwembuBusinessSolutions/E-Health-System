import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { getQueueToken } from "@/shared/api/queue";
import { getFacilities } from "@/shared/api/facilities";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" });
}

// RECQ-US-003 — a standalone route (no AppShell chrome, see router.tsx's
// own why-note on that), opened in its own small window from the queue
// page's "Print" button or the "Visit started" success screen
// (PatientDetailPage). Deliberately its own page rather than a modal: the
// print stylesheet only has to deal with this content, never the app's
// sidebar/top-bar, and window.print() prints exactly what's in the tab
// that called it.
export function TicketPrintPage() {
  const { tokenId } = useParams<{ tokenId: string }>();

  const tokenQuery = useQuery({
    queryKey: ["queue-token", tokenId],
    queryFn: () => getQueueToken(tokenId as string),
    enabled: !!tokenId,
  });
  const facilitiesQuery = useQuery({ queryKey: ["facilities"], queryFn: getFacilities });

  // A short delay, not an immediate call: firing window.print() before the
  // browser has actually painted the fetched ticket produces a blank or
  // half-rendered printout in some browsers. The tab stays open afterward
  // (print or cancel) so "Print again" below still works for a jammed or
  // misfed ticket, RECQ-US-003's own acceptance note on why reprint has to
  // be a real, repeatable action, not one-shot.
  useEffect(() => {
    if (!tokenQuery.data) return;
    const timeout = setTimeout(() => window.print(), 200);
    return () => clearTimeout(timeout);
  }, [tokenQuery.data]);

  if (!tokenId) {
    return <p className="p-6 text-center text-[14px] text-text-secondary">No ticket specified.</p>;
  }
  if (tokenQuery.isLoading || facilitiesQuery.isLoading) {
    return <p className="p-6 text-center text-[14px] text-text-secondary">Loading ticket…</p>;
  }
  if (tokenQuery.isError || !tokenQuery.data) {
    return <p className="p-6 text-center text-[14px] text-danger-600">Couldn't load this ticket.</p>;
  }

  const entry = tokenQuery.data;
  const facility = (facilitiesQuery.data ?? []).find((f) => f.id === entry.token.facilityId);

  return (
    <div className="flex min-h-screen justify-center bg-surface-sunken p-6 print:min-h-0 print:bg-white print:p-0">
      {/* 80mm is the common thermal-receipt-printer width this ticket is
          sized for (queue-appointments-plan.md §3.7's own note on 58/80mm
          rolls). The `@page size` line only takes effect on a printer/
          driver that actually offers an 80mm paper size — on anything else
          (a normal printer, "Save as PDF") the browser falls back to
          A4/Letter, so the ticket's own width must stay fixed at 80mm
          rather than stretching to fill that page — without that fixed
          width, printing to any standard printer stretched every line of
          the ticket across the full page width, breaking the layout
          entirely instead of just being non-optimally sized. */}
      <style>{`
        @media print {
          @page { size: 80mm auto; margin: 4mm; }
        }
      `}</style>
      <div className="w-[80mm] max-w-full rounded-xl border border-border-subtle bg-white p-4 text-black shadow-card print:rounded-none print:border-0 print:shadow-none">
        <div className="flex flex-col items-center gap-1 border-b border-dashed border-black/25 pb-3 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-black/70">
            {facility?.name ?? "Queue Ticket"}
          </p>
          <p className="font-mono text-[46px] font-bold leading-none tabular-nums">#{entry.token.tokenNumber}</p>
          {entry.token.priority === "PRIORITY" && (
            <p className="mt-1 rounded-full bg-black px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-white">
              Priority
            </p>
          )}
        </div>
        <dl className="mt-3 flex flex-col gap-1.5 text-[12.5px]">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-black/60">Patient</dt>
            <dd className="font-medium">{entry.patientName}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-black/60">MPI</dt>
            <dd className="font-mono">{entry.patientMpi}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-black/60">Issued</dt>
            <dd>{formatDateTime(entry.token.issuedAt)}</dd>
          </div>
        </dl>
        <p className="mt-4 border-t border-dashed border-black/25 pt-3 text-center text-[11px] leading-snug text-black/60">
          Please wait to be called. Keep this ticket until your visit is complete.
        </p>
      </div>
      <button
        type="button"
        onClick={() => window.print()}
        className="fixed bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-brand-500 px-5 py-3 text-[14px] font-semibold text-white shadow-lg print:hidden"
      >
        <Printer className="size-4" aria-hidden />
        Print again
      </button>
    </div>
  );
}
