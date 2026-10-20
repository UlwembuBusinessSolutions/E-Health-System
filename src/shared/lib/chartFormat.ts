// Labels and scales shared by the dashboards' charts, so every chart words
// days and rounds axes the same way.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// A bare YYYY-MM-DD is a calendar day, never UTC midnight.
function parseDay(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** `2026-10-13` -> `13 Oct`. */
export function shortDay(iso: string): string {
  const date = parseDay(iso);
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** `2026-10-13` -> `Tue 13 Oct`. */
export function dayTitle(iso: string): string {
  const date = parseDay(iso);
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export function isWeekend(iso: string): boolean {
  const weekday = parseDay(iso).getDay();
  return weekday === 0 || weekday === 6;
}

/** `plural(3, "box", "boxes")` -> `3 boxes`. */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count.toLocaleString("en-ZA")} ${count === 1 ? singular : pluralForm}`;
}

/** A rounded top for an axis that starts at 0, with its tick step; at least `minimum`. */
export function niceScale(max: number, ticks = 4, minimum = 4): { top: number; step: number } {
  const target = Math.max(max, minimum) / ticks;
  const magnitude = 10 ** Math.floor(Math.log10(target));
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((candidate) => candidate >= target) ?? target;
  const wholeStep = Math.max(1, Math.round(step));
  return { top: Math.ceil(Math.max(max, minimum) / wholeStep) * wholeStep, step: wholeStep };
}
