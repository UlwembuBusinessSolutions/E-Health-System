import type { CountLine, CountReason } from "@/shared/api/pharmacyCounts";

// Pure counting rules, kept free of React so they are easy to read and test.

export type LineOutcome = "NOT_COUNTED" | "MATCH" | "SHORT" | "OVER";
export type ReviewFilter = "ALL" | "DIFFERENCES" | "LARGE" | "NOT_COUNTED";

/** More than 10% off the ledger, or more than 50 units, deserves a recount. */
const LARGE_PERCENT = 0.1;
const LARGE_UNITS = 50;

export function isCounted(line: CountLine): boolean {
  return line.countedQuantity !== null;
}

/** Counted minus system; null until both are known (a blind count hides the system figure). */
export function differenceOf(line: CountLine): number | null {
  if (line.variance !== null) return line.variance;
  if (line.countedQuantity === null || line.baselineQuantity === null) return null;
  return line.countedQuantity - line.baselineQuantity;
}

export function outcomeOf(line: CountLine): LineOutcome {
  const difference = differenceOf(line);
  if (difference === null) return "NOT_COUNTED";
  if (difference === 0) return "MATCH";
  return difference < 0 ? "SHORT" : "OVER";
}

export function isLargeDifference(line: CountLine): boolean {
  const difference = differenceOf(line);
  if (difference === null || difference === 0) return false;
  if (line.large !== null) return line.large;
  if (line.baselineQuantity === null) return false;
  const size = Math.abs(difference);
  if (size > LARGE_UNITS) return true;
  // A lot the ledger did not know about has no base to take a percentage of.
  return line.baselineQuantity > 0 && size / line.baselineQuantity > LARGE_PERCENT;
}

export interface CountTotals {
  total: number;
  counted: number;
  matches: number;
  short: number;
  over: number;
  large: number;
  netUnits: number;
  /** Differences that still lack a reason; posting is blocked while this is above 0. */
  missingReasons: number;
}

export function totalsOf(lines: CountLine[]): CountTotals {
  const totals: CountTotals = {
    total: lines.length,
    counted: 0,
    matches: 0,
    short: 0,
    over: 0,
    large: 0,
    netUnits: 0,
    missingReasons: 0,
  };
  for (const line of lines) {
    // Progress is judged on the typed number alone: a blind count hides the
    // system figure, but the lot is still counted.
    if (isCounted(line)) totals.counted += 1;
    const outcome = outcomeOf(line);
    if (outcome === "NOT_COUNTED") continue;
    if (outcome === "MATCH") {
      totals.matches += 1;
      continue;
    }
    totals[outcome === "SHORT" ? "short" : "over"] += 1;
    totals.netUnits += differenceOf(line) ?? 0;
    if (isLargeDifference(line)) totals.large += 1;
    if (line.reason === null) totals.missingReasons += 1;
  }
  return totals;
}

export function matchesFilter(line: CountLine, filter: ReviewFilter): boolean {
  switch (filter) {
    case "ALL":
      return true;
    case "DIFFERENCES":
      return outcomeOf(line) === "SHORT" || outcomeOf(line) === "OVER";
    case "LARGE":
      return isLargeDifference(line);
    case "NOT_COUNTED":
      return outcomeOf(line) === "NOT_COUNTED";
  }
}

export const REASON_LABELS: Record<CountReason, string> = {
  MISCOUNT: "Miscount",
  DAMAGED: "Damaged",
  EXPIRED_REMOVED: "Expired and removed",
  LOST_OR_MISSING: "Lost or missing",
  UNRECORDED_RECEIPT: "Unrecorded receipt",
  RETURNED_TO_STOCK: "Returned to stock",
};

function isCountReason(reason: string): reason is CountReason {
  return reason in REASON_LABELS;
}

/** The server stores a reason as free text, so anything unfamiliar is shown as written. */
export function reasonLabel(reason: string): string {
  return isCountReason(reason) ? REASON_LABELS[reason] : reason;
}

const SHORT_REASONS: CountReason[] = ["MISCOUNT", "DAMAGED", "EXPIRED_REMOVED", "LOST_OR_MISSING"];
const OVER_REASONS: CountReason[] = ["MISCOUNT", "UNRECORDED_RECEIPT", "RETURNED_TO_STOCK"];

/** Only reasons that make sense for the direction of the difference are offered. */
export function reasonsFor(outcome: LineOutcome): CountReason[] {
  if (outcome === "SHORT") return SHORT_REASONS;
  if (outcome === "OVER") return OVER_REASONS;
  return [];
}

/** `+12`, `-5`, `0` — an explicit sign makes direction readable without colour. */
export function formatSigned(value: number): string {
  if (value > 0) return `+${value}`;
  return value < 0 ? `−${Math.abs(value)}` : "0";
}
