import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { getVitalsAssessment } from "@/shared/api/triage";
import { VitalsDetailContent } from "./VitalsDetailContent";

// A standalone route (no AppShell chrome, see router.tsx's own why-note),
// opened in its own small window from VitalsDetailModal's print button —
// same reasoning as TicketPrintPage: the print stylesheet only has to deal
// with this content, never the app's sidebar/top-bar, and window.print()
// prints exactly what's in the tab that called it. Renders the same
// VitalsDetailContent the on-screen modal does, so what's on paper matches
// what a nurse already reviewed on screen.
export function VitalsPrintPage() {
  const { assessmentId } = useParams<{ assessmentId: string }>();

  const query = useQuery({
    queryKey: ["vitals-assessment", assessmentId],
    queryFn: () => getVitalsAssessment(assessmentId as string),
    enabled: !!assessmentId,
  });

  // A short delay, not an immediate call — see TicketPrintPage's own
  // why-note on why firing window.print() before the browser has actually
  // painted the fetched content produces a blank or half-rendered printout
  // in some browsers. The tab stays open afterward so "Print again" works.
  useEffect(() => {
    if (!query.data) return;
    const timeout = setTimeout(() => window.print(), 200);
    return () => clearTimeout(timeout);
  }, [query.data]);

  if (!assessmentId) {
    return <p className="p-6 text-center text-[14px] text-text-secondary">No vitals reading specified.</p>;
  }
  if (query.isLoading) {
    return <p className="p-6 text-center text-[14px] text-text-secondary">Loading vitals…</p>;
  }
  if (query.isError || !query.data) {
    return <p className="p-6 text-center text-[14px] text-danger-600">Couldn't load this vitals reading.</p>;
  }

  return (
    <div className="flex min-h-screen justify-center bg-surface-sunken p-6 print:min-h-0 print:bg-white print:p-0">
      {/* The colour badges and status banners carry real clinical meaning
          (GREEN/YELLOW/ORANGE/RED), so this asks the browser to keep their
          background colour on paper rather than the flat black-on-white
          printers default to — most browsers drop background colours
          unless asked, which would leave only the text label to tell two
          differently-coloured banners apart. */}
      <style>{`
        @media print {
          .vitals-print-card, .vitals-print-card * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
      {/* Same card shape as VitalsDetailModal (rounded-[20px], p-7) — this
          page renders the same VitalsDetailContent that modal does, so its
          own frame around it should match rather than drift toward
          TicketPrintPage's differently-shaped ticket card. */}
      <div className="vitals-print-card w-full max-w-[640px] rounded-[20px] border border-border-subtle bg-white p-7 shadow-card print:max-w-none print:rounded-none print:border-0 print:shadow-none">
        <p className="mb-5 text-[12px] font-semibold uppercase tracking-wide text-text-secondary">Vitals reading</p>
        <VitalsDetailContent
          assessment={query.data.assessment}
          capturedByName={query.data.capturedByName}
          patientName={query.data.patientName}
          patientMpi={query.data.patientMpi}
        />
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
