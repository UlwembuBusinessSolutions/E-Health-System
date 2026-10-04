export type DateRangeKey = "ALL" | "30D" | "7D" | "TODAY";

export const DATE_RANGE_OPTIONS: { value: DateRangeKey; label: string }[] = [
  { value: "ALL", label: "All time" },
  { value: "30D", label: "Last 30 days" },
  { value: "7D", label: "Last 7 days" },
  { value: "TODAY", label: "Today" },
];

const DAYS_BACK: Record<Exclude<DateRangeKey, "ALL">, number> = { TODAY: 0, "7D": 6, "30D": 29 };

// Local calendar day, not toISOString(): that is UTC and would shift the day
// for a pharmacy east or west of Greenwich around midnight.
function toDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export interface DateBounds {
  from?: string;
  to?: string;
}

/** Inclusive `from`/`to` days for a chip; "Last 7 days" includes today. */
export function boundsFor(range: DateRangeKey, today: Date = new Date()): DateBounds {
  if (range === "ALL") return {};
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - DAYS_BACK[range]);
  return { from: toDay(start), to: toDay(today) };
}
