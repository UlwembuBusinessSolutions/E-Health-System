import type { ImportRow, ImportRowResult } from "@/shared/api/pharmacyImport";
import { formatCsv, parseCsv } from "../lib/csv";

// Pure helpers for the import screens: reading a file or pasted text, guessing
// which column is which, building the template, and the left-out-rows file.

export type FieldKey = Exclude<keyof ImportRow, "confirmNewProduct">;

export interface FieldInfo {
  key: FieldKey;
  /** The label in the template header and in the "Goes into" menu. */
  label: string;
  /** Other headings people use for the same thing, compared after tidying. */
  aliases: string[];
}

// The order here is the order of the template's columns.
export const FIELDS: FieldInfo[] = [
  { key: "sku", label: "SKU", aliases: ["sku", "code", "product code", "item code", "stock code"] },
  { key: "name", label: "Product name", aliases: ["product name", "name", "product", "item", "item name", "item description", "description"] },
  { key: "category", label: "Category", aliases: ["category", "type", "product type"] },
  { key: "unit", label: "Unit", aliases: ["unit", "uom", "unit of measure", "base unit"] },
  { key: "packSize", label: "Pack size", aliases: ["pack size", "packsize", "pack", "units per pack"] },
  { key: "schedule", label: "Schedule", aliases: ["schedule", "sa schedule", "drug schedule"] },
  { key: "lot", label: "Lot", aliases: ["lot", "lot no", "lot number", "batch", "batch no", "batch number"] },
  { key: "expiry", label: "Expiry", aliases: ["expiry", "expiry date", "exp", "exp date", "expires", "expiration"] },
  { key: "quantity", label: "Quantity", aliases: ["quantity", "qty", "qty received", "received", "units", "amount"] },
  { key: "supplier", label: "Supplier", aliases: ["supplier", "supplier name", "vendor"] },
  { key: "invoice", label: "Invoice", aliases: ["invoice", "invoice no", "invoice number", "inv", "inv no"] },
];

export const FIELD_LABELS = Object.fromEntries(FIELDS.map((field) => [field.key, field.label])) as Record<FieldKey, string>;

export const MAX_ROWS = 2000;

/** For each column of the file, which field it goes into ("" = not used). */
export type ColumnFields = (FieldKey | "")[];

export type MatchQuality = "exact" | "guess" | "none";

function tidy(heading: string): string {
  return heading.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function fieldForHeading(heading: string): { key: FieldKey; quality: MatchQuality } | null {
  const text = tidy(heading);
  if (!text) return null;
  for (const field of FIELDS) {
    if (tidy(field.label) === text) return { key: field.key, quality: "exact" };
  }
  for (const field of FIELDS) {
    if (field.aliases.some((alias) => tidy(alias) === text)) return { key: field.key, quality: "guess" };
  }
  return null;
}

export interface ReadSheet {
  /** What the file calls each column; "Column 1"... when the file has no heading row. */
  headings: string[];
  body: string[][];
  hadHeadingRow: boolean;
}

/** Text from a file or the paste box -> a heading row (if there is one) and the data rows. */
export function readSheet(text: string): ReadSheet {
  const parsed = parseCsv(text);
  if (parsed.length === 0) return { headings: [], body: [], hadHeadingRow: false };
  const knownHeadings = parsed[0].filter((cell) => fieldForHeading(cell) !== null).length;
  const hadHeadingRow = knownHeadings >= 2 || (knownHeadings === 1 && parsed[0].length === 1);
  const width = Math.max(...parsed.map((row) => row.length));
  const headings = hadHeadingRow
    ? Array.from({ length: width }, (_, index) => parsed[0][index] ?? "")
    : Array.from({ length: width }, (_, index) => `Column ${index + 1}`);
  return { headings, body: hadHeadingRow ? parsed.slice(1) : parsed, hadHeadingRow };
}

export interface GuessedColumns {
  columns: ColumnFields;
  quality: MatchQuality[];
}

/** Matches each column heading to a field. Without a heading row the template order is assumed. */
export function guessColumns(sheet: ReadSheet): GuessedColumns {
  const taken = new Set<FieldKey>();
  const columns: ColumnFields = [];
  const quality: MatchQuality[] = [];
  sheet.headings.forEach((heading, index) => {
    const match = sheet.hadHeadingRow ? fieldForHeading(heading) : { key: FIELDS[index]?.key, quality: "guess" as const };
    if (match?.key && !taken.has(match.key)) {
      taken.add(match.key);
      columns.push(match.key);
      quality.push(match.quality);
    } else {
      columns.push("");
      quality.push("none");
    }
  });
  return { columns, quality };
}

/** Turns the data rows into import rows using the chosen column -> field choices. */
export function rowsFromSheet(body: string[][], columns: ColumnFields): ImportRow[] {
  return body.map((cells) => {
    const row: ImportRow = { sku: "", name: "", category: "", unit: "", packSize: "", schedule: "", lot: "", expiry: "", quantity: "", supplier: "", invoice: "", confirmNewProduct: false };
    columns.forEach((field, index) => {
      if (field) row[field] = (cells[index] ?? "").trim();
    });
    return row;
  });
}

export type FileKind = "both" | "products" | "stock" | "unknown";

/** What the mapped columns say the file is for. */
export function describeFile(columns: ColumnFields): FileKind {
  const has = (key: FieldKey) => columns.includes(key);
  if (!has("sku")) return "unknown";
  if (has("quantity") && has("name")) return "both";
  if (has("quantity")) return "stock";
  if (has("name")) return "products";
  return "unknown";
}

export const FILE_KIND_LABELS: Record<FileKind, string> = {
  both: "Products and stock together",
  products: "Products only",
  stock: "Stock only",
  unknown: "We could not tell",
};

export type TemplateKind = Exclude<FileKind, "unknown">;

const TEMPLATE_COLUMNS: Record<TemplateKind, FieldKey[]> = {
  both: FIELDS.map((field) => field.key),
  products: ["sku", "name", "category", "unit", "packSize", "schedule"],
  stock: ["sku", "lot", "expiry", "quantity", "supplier", "invoice"],
};

// Real-looking examples show the expected formats better than a description.
const EXAMPLES: Partial<Record<FieldKey, string[]>> = {
  sku: ["AMOX-500-CAP", "IBU-400-TAB", "SYR-5ML"],
  name: ["Amoxicillin 500 mg capsules", "Ibuprofen 400 mg tablets", "Syringe 5 ml"],
  category: ["Medicine", "Medicine", "Supply"],
  unit: ["capsule", "tablet", "each"],
  packSize: ["20", "30", "100"],
  schedule: ["", "", ""],
  lot: ["AX2388", "IB4410", ""],
  expiry: ["2027-06-30", "2027-03-31", ""],
  quantity: ["240", "500", "1000"],
  supplier: ["", "", ""],
  invoice: ["INV-1042", "INV-1042", "INV-1042"],
};

export const TEMPLATE_FILENAMES: Record<TemplateKind, string> = {
  both: "products-and-stock-template.csv",
  products: "products-template.csv",
  stock: "stock-template.csv",
};

export function templateCsv(kind: TemplateKind): string {
  const columns = TEMPLATE_COLUMNS[kind];
  const header = columns.map((key) => FIELD_LABELS[key]);
  const examples = [0, 1, 2].map((index) => columns.map((key) => EXAMPLES[key]?.[index] ?? ""));
  return formatCsv([header, ...examples]);
}

export const LEFT_OUT_FILENAME = "left-out-rows.csv";

export interface LeftOutRow {
  row: ImportRow;
  reason: string;
}

/** The rows the pharmacist chose to skip, with the reason beside each, ready to fix and import again. */
export function leftOutCsv(leftOut: LeftOutRow[]): string {
  const header = [...FIELDS.map((field) => field.label), "Why it was left out"];
  const lines = leftOut.map(({ row, reason }) => [...FIELDS.map((field) => row[field.key]), reason]);
  return formatCsv([header, ...lines]);
}

export const PROBLEM_LABELS: Record<NonNullable<ImportRowResult["problem"]>, string> = {
  MISSING_SKU: "No SKU",
  UNKNOWN_SKU: "Unknown SKU",
  SIMILAR_SKU: "Check SKU",
  MISSING_NAME: "No product name",
  ALREADY_IN_CATALOGUE: "Already exists",
  ARCHIVED_PRODUCT: "Archived product",
  SERIAL_PRODUCT: "Serials needed",
  COLD_CHAIN_PRODUCT: "Cold-chain",
  BAD_CATEGORY: "Bad category",
  BAD_UNIT: "Bad unit",
  BAD_PACK_SIZE: "Bad pack size",
  BAD_SCHEDULE: "Bad schedule",
  BAD_QUANTITY: "Bad quantity",
  MISSING_LOT: "No lot number",
  BAD_EXPIRY: "Bad expiry",
  EXPIRED: "Expired",
  DUPLICATE_LOT: "Lot listed twice",
  LOT_EXPIRY_MISMATCH: "Lot clash",
  UNKNOWN_SUPPLIER: "Unknown supplier",
  SIMILAR_SUPPLIER: "Check supplier",
};
