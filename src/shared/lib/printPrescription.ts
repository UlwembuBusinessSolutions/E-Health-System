// Opens a single prescription's print-friendly page (PrescriptionPrintPage)
// in its own small window — same shape as printVitals.ts's
// printVitalsReading(), including its own why-note on window sizing/opener
// handling, which this mirrors exactly rather than re-deriving.
//
// Call this directly from a click handler, not after an await — see
// printTicket.ts's own why-note on why a window.open() fired from inside an
// async callback is what popup blockers actually flag.
export function printPrescription(prescriptionId: string): void {
  const tab = window.open(`/print/prescription/${prescriptionId}`, "prescription-print", "width=680,height=860");
  if (tab) tab.opener = null;
}
