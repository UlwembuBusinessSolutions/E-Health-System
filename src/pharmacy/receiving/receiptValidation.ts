import type { ReceivableProduct, ReceiptLineDraft, TrackingMode } from "./receiptTypes";

// Pure functions only: no React, no clock (callers pass `today`), so every rule
// can be unit-tested with plain objects.

/** Vaccines and similar products must arrive between these temperatures (inclusive). */
export const COLD_CHAIN_MIN_C = 2;
export const COLD_CHAIN_MAX_C = 8;

const MIN_FLAG_NOTE_LENGTH = 3;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Today as `YYYY-MM-DD` in the viewer's local calendar (what a native date input uses). */
export function isoToday(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function trackingModeOf(product: ReceivableProduct): TrackingMode {
  if (product.serialTracked) return "SERIAL";
  if (product.batchTracked || product.expiryTracked) return "LOT";
  return "QUANTITY";
}

/** Units in one pack; 1 when the product is counted loose. */
export function unitsPerPack(product: ReceivableProduct): number {
  return product.packSize !== null && product.packSize > 1 ? product.packSize : 1;
}

/** Units that physically arrived (serial products: one per scanned serial). */
export function receivedQuantity(line: ReceiptLineDraft): number {
  if (trackingModeOf(line.product) === "SERIAL") return line.serials.length;
  return line.packs * unitsPerPack(line.product);
}

/** Units that go on the shelf: everything, unless a flag rejects part of the delivery. */
export function acceptedQuantity(line: ReceiptLineDraft): number {
  const received = receivedQuantity(line);
  if (!line.flag) return received;
  return Math.min(Math.max(line.flag.acceptedQuantity, 0), received);
}

export function parseTemperature(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

/** Why a cold-chain line cannot be accepted as-is, or null when it is fine (or not yet answered). */
export function coldChainProblem(line: ReceiptLineDraft): string | null {
  if (!line.product.coldChain) return null;
  const temperature = parseTemperature(line.temperature);
  const outOfRange = temperature !== null && (temperature < COLD_CHAIN_MIN_C || temperature > COLD_CHAIN_MAX_C);
  if (outOfRange && line.coldBoxIntact === false) {
    return `Arrived at ${temperature} °C in a damaged cold box. Safe range is ${COLD_CHAIN_MIN_C} to ${COLD_CHAIN_MAX_C} °C.`;
  }
  if (outOfRange) {
    return `Arrived at ${temperature} °C. Safe range is ${COLD_CHAIN_MIN_C} to ${COLD_CHAIN_MAX_C} °C.`;
  }
  if (line.coldBoxIntact === false) return "The cold box was not intact.";
  return null;
}

/** One message per thing still missing on a line; an empty object means the line is ready. */
export interface LineIssues {
  quantity?: string;
  lot?: string;
  expiry?: string;
  temperature?: string;
  coldBox?: string;
  flag?: string;
}

function expiryIssue(line: ReceiptLineDraft, today: string): string | undefined {
  if (!line.product.expiryTracked) return undefined;
  if (!ISO_DAY.test(line.expiryDate)) return "Enter the expiry date";
  if (line.expiryDate < today) return "That expiry date has already passed";
  return undefined;
}

function flagIssue(line: ReceiptLineDraft): string | undefined {
  if (line.flag) {
    if (line.flag.reason === null) return "Choose what is wrong with this line";
    if (line.flag.note.trim().length < MIN_FLAG_NOTE_LENGTH) return "Add a note for the supplier";
    return undefined;
  }
  return coldChainProblem(line) ? "Flag this line for the cold-chain problem" : undefined;
}

export function validateLine(line: ReceiptLineDraft, today: string): LineIssues {
  const { product } = line;
  const issues: LineIssues = {};

  if (receivedQuantity(line) < 1) {
    issues.quantity = trackingModeOf(product) === "SERIAL" ? "Scan at least one serial number" : "Enter a quantity of at least 1";
  }
  if (trackingModeOf(product) === "LOT") {
    if (product.batchTracked && line.lotNumber.trim() === "") issues.lot = "Enter the lot number";
    issues.expiry = expiryIssue(line, today);
  }
  if (product.coldChain) {
    if (parseTemperature(line.temperature) === null) issues.temperature = "Enter the temperature on arrival";
    if (line.coldBoxIntact === null) issues.coldBox = "Say whether the cold box was intact";
  }
  issues.flag = flagIssue(line);

  // Drop the undefined keys so `Object.keys(issues).length === 0` means "ready".
  return Object.fromEntries(Object.entries(issues).filter(([, message]) => message !== undefined));
}

export function lineIsReady(issues: LineIssues): boolean {
  return Object.keys(issues).length === 0;
}

export interface ReceiptInput {
  facilityId: string;
  supplierId: string | null;
  lines: ReceiptLineDraft[];
}

export interface ReceiptValidation {
  /** Issues by line key, for the per-line "still needed" lists. */
  lineIssues: Map<string, LineIssues>;
  /** The single next thing to do, shown in the summary rail; null when ready to post. */
  hint: string | null;
}

function nextStep(input: ReceiptInput, lineIssues: Map<string, LineIssues>): string | null {
  if (!input.facilityId) return "Choose the facility receiving this stock.";
  if (!input.supplierId) return "Choose the supplier.";
  if (input.lines.length === 0) return "Add at least one product.";

  const unfinished = input.lines.filter((line) => !lineIsReady(lineIssues.get(line.key) ?? {})).length;
  if (unfinished === 0) return null;
  return unfinished === 1 ? "1 line still needs details." : `${unfinished} lines still need details.`;
}

export function validateReceipt(input: ReceiptInput, today: string): ReceiptValidation {
  const lineIssues = new Map(input.lines.map((line) => [line.key, validateLine(line, today)]));
  return { lineIssues, hint: nextStep(input, lineIssues) };
}

export interface SerialAddResult {
  serials: string[];
  /** Plain-language reason nothing was added, e.g. a duplicate scan. */
  error: string | null;
}

/** Adds a typed or scanned serial, refusing blanks and duplicates (case-insensitive). */
export function addSerial(existing: string[], raw: string): SerialAddResult {
  const serial = raw.trim();
  if (serial === "") return { serials: existing, error: null };
  const duplicate = existing.some((value) => value.toLowerCase() === serial.toLowerCase());
  if (duplicate) return { serials: existing, error: `${serial} is already on this line.` };
  return { serials: [...existing, serial], error: null };
}
