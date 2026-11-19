import type { CoverLevel, PharmacyOverview, StockCover } from "@/shared/api/pharmacyOverview";
import { dayTitle, isWeekend, niceScale, plural, shortDay } from "@/shared/lib/chartFormat";
import { unitLabel } from "../lib/units";

export { dayTitle, isWeekend, niceScale, plural, shortDay };

// Pure helpers behind the Overview tab: labels, scales and positions. Kept
// out of the components so every number on screen is worked out one way.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September",
  "October", "November", "December"];

/** Bars run from 0 to this many days; anything longer is drawn full. */
export const COVER_SCALE_DAYS = 60;
export const COVER_CHART_ROWS = 8;
export const BACKLOG_DAYS = 7;

/** `2026-10` -> `Oct`. */
export function monthShort(yearMonth: string): string {
  return MONTHS[Number(yearMonth.slice(5, 7)) - 1];
}

/** `2026-10` -> `October 2026`. */
export function monthLong(yearMonth: string): string {
  return `${MONTHS_LONG[Number(yearMonth.slice(5, 7)) - 1]} ${yearMonth.slice(0, 4)}`;
}


export function needsOrdering(row: StockCover): boolean {
  return row.level === "CRITICAL" || row.level === "WARNING";
}

/** Average units a day over the history behind the estimate, or null without use. */
export function perDay(row: StockCover): number | null {
  return row.used > 0 && row.basisDays > 0 ? row.used / row.basisDays : null;
}

function formatRate(rate: number): string {
  // One decimal below 10 a day (0.8 vials), whole numbers above; never "0".
  // A decimal point, not the en-ZA comma: "1,3" beside "1 234" reads as a typo.
  if (rate >= 10) return Math.round(rate).toLocaleString("en-ZA");
  const rounded = Math.max(0.1, Math.round(rate * 10) / 10);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** "about 6 tablets a day", with the history span when it is shorter than 30 days. */
export function usageText(row: StockCover): string {
  const rate = perDay(row);
  if (rate === null) {
    return row.basisDays === 0 ? "no history here yet" : `not used in the last ${plural(row.basisDays, "day")}`;
  }
  const amount = formatRate(rate);
  const text = `about ${amount} ${unitLabel(row.baseUnit, amount === "1" ? 1 : 2)} a day`;
  return row.basisDays < 30 ? `${text} (last ${plural(row.basisDays, "day")})` : text;
}

export function daysLeftText(row: StockCover): string {
  if (row.level === "OUT") return "Out of stock";
  if (row.daysLeft === null) return "No recent use";
  if (row.daysLeft === 0) return "Under 1 day";
  return plural(row.daysLeft, "day");
}

export const LEVEL_STATUS: Record<CoverLevel, string> = {
  OUT: "Out of stock: order now",
  CRITICAL: "Under 7 days: order now",
  WARNING: "7–30 days: order soon",
  OK: "Over 30 days",
  NO_RECENT_USE: "No recent use",
};

/** Bar length as a share of the scale; nothing is drawn without a projection. */
export function coverPercent(row: StockCover): number {
  if (row.daysLeft === null || row.level === "OUT") return 0;
  return (Math.min(row.daysLeft, COVER_SCALE_DAYS) / COVER_SCALE_DAYS) * 100;
}

/** "1 h 40 min", "3 days" — how long the oldest waiting prescription has waited. */
export function waitedText(oldestSince: string, now: Date): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(oldestSince).getTime()) / 60_000));
  if (minutes < 60) return plural(minutes, "min", "min");
  if (minutes < 24 * 60) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
  }
  return plural(Math.floor(minutes / (24 * 60)), "day");
}

/** Received minus dispensed over the last `BACKLOG_DAYS` days of history. */
export function backlog(days: PharmacyOverview["prescriptionsPerDay"]): number {
  return days.slice(-BACKLOG_DAYS).reduce((sum, day) => sum + day.received - day.dispensed, 0);
}


/** Weekend runs as % positions across a series of `count` evenly spaced days. */
export function weekendBands(dates: string[]): { left: number; width: number }[] {
  const last = dates.length - 1;
  const bands: { left: number; width: number }[] = [];
  let start: number | null = null;
  dates.forEach((date, index) => {
    const weekend = isWeekend(date);
    if (weekend && start === null) start = index;
    if ((!weekend || index === last) && start !== null) {
      const end = weekend ? index : index - 1;
      const left = Math.max(0, (start - 0.5) / last) * 100;
      const right = Math.min(1, (end + 0.5) / last) * 100;
      bands.push({ left, width: right - left });
      start = null;
    }
  });
  return bands;
}
