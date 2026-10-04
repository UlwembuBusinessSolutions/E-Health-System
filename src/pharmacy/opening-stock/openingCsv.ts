import type { OpeningRowResult, OpeningRowStatus, OpeningStockRow } from "@/shared/api/pharmacyPlanning";
import { formatCsv, parseCsv } from "../lib/csv";

// Pure helpers for the opening-stock sheet: reading what was pasted or
// uploaded, building the template, and counting what the checker found.

const HEADER = ["SKU", "Lot", "Expiry", "Quantity"];

// Real-looking examples show the expected formats better than a description.
const EXAMPLES = [
  ["AMOX-500-CAP", "AX2388", "2026-11-30", "240"],
  ["PARA-500-TAB", "PC7702", "2027-06-30", "800"],
  ["METF-500-TAB", "MF1120", "2027-09-30", "620"],
];

export const TEMPLATE_FILENAME = "opening-stock-template.csv";

export function templateCsv(): string {
  return formatCsv([HEADER, ...EXAMPLES]);
}

function isHeaderRow(cells: string[]): boolean {
  return cells[0]?.toLowerCase() === "sku";
}

/** Text from a file or the paste box -> rows. A header row is optional; missing cells become blank, so the checker can flag them. */
export function rowsFromText(text: string): OpeningStockRow[] {
  const parsed = parseCsv(text);
  const body = parsed.length > 0 && isHeaderRow(parsed[0]) ? parsed.slice(1) : parsed;
  return body.map(([sku = "", lot = "", expiry = "", quantity = ""]) => ({ sku, lot, expiry, quantity }));
}

export const STATUS_LABELS: Record<OpeningRowStatus, string> = {
  OK: "OK",
  UNKNOWN_PRODUCT: "Unknown product",
  BAD_EXPIRY: "Bad expiry",
  DUPLICATE_LOT: "Duplicate lot",
  BAD_QUANTITY: "Bad quantity",
};

// Used only when the server sends no hint of its own.
export const FALLBACK_HINTS: Record<OpeningRowStatus, string> = {
  OK: "",
  UNKNOWN_PRODUCT: "This SKU is not in Stock. Check the spelling, or add the product first.",
  BAD_EXPIRY: "Write the expiry as year-month-day, for example 2027-06-30, and make sure it is in the future.",
  DUPLICATE_LOT: "This lot is listed twice for the same product. Keep one row, or change the lot number.",
  BAD_QUANTITY: "Use a whole number above zero, for example 240.",
};

export interface ReviewSummary {
  total: number;
  ready: number;
  needFixing: number;
  unitsReady: number;
  /** Count per problem type, only for types that occur. */
  problems: { status: Exclude<OpeningRowStatus, "OK">; count: number }[];
}

export function summarise(rows: OpeningStockRow[], results: OpeningRowResult[]): ReviewSummary {
  const summary: ReviewSummary = { total: rows.length, ready: 0, needFixing: 0, unitsReady: 0, problems: [] };
  const problemCounts = new Map<Exclude<OpeningRowStatus, "OK">, number>();

  results.forEach((result, index) => {
    if (result.status === "OK") {
      summary.ready += 1;
      summary.unitsReady += Number(rows[index]?.quantity) || 0;
      return;
    }
    summary.needFixing += 1;
    problemCounts.set(result.status, (problemCounts.get(result.status) ?? 0) + 1);
  });

  summary.problems = [...problemCounts].map(([status, count]) => ({ status, count }));
  return summary;
}
