// Opens a single vitals reading's print-friendly page (VitalsPrintPage) in
// its own small window — same shape as printTicket.ts's printQueueTicket(),
// including its own why-note on window sizing/opener handling, which this
// mirrors exactly rather than re-deriving.
//
// Call this directly from a click handler, not after an await — see
// printTicket.ts's own why-note on why a window.open() fired from inside an
// async callback is what popup blockers actually flag.
//
// Deliberately no "noopener" in the features string, same trade-off
// printTicket.ts documents: severing tab.opener by hand right after the
// open() call achieves the same tabnabbing protection without losing the
// one-time sessionStorage clone a same-origin popup needs to open signed in.
export function printVitalsReading(assessmentId: string): void {
  const tab = window.open(`/print/vitals/${assessmentId}`, "vitals-print", "width=680,height=860");
  if (tab) tab.opener = null;
}
