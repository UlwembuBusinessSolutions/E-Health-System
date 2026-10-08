import type { RegisterEntry, ScheduledProduct } from "@/shared/api/pharmacyRegister";
import { formatCsv } from "../lib/csv";
import { formatDateTime } from "../lib/format";

const HEADER = [
  "Date and time",
  "RX number",
  "Patient",
  "Patient ID",
  "Prescriber",
  "Prescriber reg. no.",
  "In",
  "Out",
  "Balance",
  "Dispensed by",
  "Witnessed by",
  "Lot",
];

/** The whole book as CSV for an inspector; one row per entry, oldest first, as written. */
export function registerToCsv(entries: RegisterEntry[]): string {
  const rows = entries.map((entry) => [
    formatDateTime(entry.entryAt),
    entry.rxSerial ?? "",
    entry.patientName ?? "",
    entry.patientIdRef ?? "",
    entry.prescriberName ?? "",
    entry.prescriberRegNo ?? "",
    entry.quantityIn ? String(entry.quantityIn) : "",
    entry.quantityOut ? String(entry.quantityOut) : "",
    String(entry.balanceAfter),
    entry.dispensedByName,
    entry.witnessedByName ?? "",
    entry.lotNumber,
  ]);
  return formatCsv([HEADER, ...rows]);
}

export function registerFilename(product: ScheduledProduct): string {
  const slug = product.productName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `register-${slug}.csv`;
}
