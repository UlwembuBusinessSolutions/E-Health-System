// RECQ-US-003 — opens a queue ticket's print-friendly page (TicketPrintPage)
// in its own small window. Shared by the queue page's "Print" action and
// the "Visit started" success screen, both of which need the exact same
// window.open() shape.
//
// Call this directly from a click handler, not after an await — a
// window.open() fired from inside an async callback is what popup blockers
// actually flag, since by then the call is no longer "in response to" the
// click that triggered it.
//
// Deliberately no "noopener" in the features string, matching
// PatientDetailPage's handleView() own why-note on this exact trade-off —
// sessionStorage (the tenant auth token lives there) is only copied into a
// popup that keeps its opener relationship to the page that spawned it at
// creation time; "noopener" severs that up front, so the popup opened
// signed out and bounced to a login screen that then redirected to /app on
// success, never back to the ticket (found by testing: nothing printed).
// Severing tab.opener by hand right after achieves the same tabnabbing
// protection without losing that one-time storage clone.
export function printQueueTicket(tokenId: string): void {
  const tab = window.open(`/print/ticket/${tokenId}`, "ticket-print", "width=380,height=640");
  if (tab) tab.opener = null;
}
