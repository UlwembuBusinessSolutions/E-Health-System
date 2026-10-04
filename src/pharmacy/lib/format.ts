const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

// A bare `YYYY-MM-DD` (expiry dates) must be read as a calendar day, not as
// UTC midnight — `new Date("2026-09-30")` would show 29 Sep west of UTC.
function toDate(iso: string): Date {
  const match = DATE_ONLY.exec(iso);
  if (!match) return new Date(iso);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

// Month names are spelled out here instead of via Intl so every browser and
// locale prints "Sep", never "Sept".
function formatDay(date: Date): string {
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** `2026-09-30` or a full timestamp -> `30 Sep 2026`. */
export function formatDate(iso: string): string {
  return formatDay(toDate(iso));
}

/** Timestamp -> `30 Sep 2026, 14:05` in the viewer's local time. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${formatDay(date)}, ${hours}:${minutes}`;
}

/** Whole calendar days from today until `isoDate` (negative once it has passed). */
export function daysUntil(isoDate: string, today: Date = new Date()): number {
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((toDate(isoDate).getTime() - startOfToday.getTime()) / MS_PER_DAY);
}

/** `pluralise(3, "box", "boxes")` -> `3 boxes`; plural defaults to adding "s". */
export function pluralise(count: number, singular: string, plural = `${singular}s`): string {
  return `${count.toLocaleString("en-ZA")} ${count === 1 ? singular : plural}`;
}
