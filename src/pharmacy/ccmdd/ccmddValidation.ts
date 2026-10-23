/** Shared, pure validation for the pharmacy CCMDD page. */
export function validTracingDays(value: string): boolean {
  // Number("") === 0; blank values and decimal values cannot be submitted.
  if (!/^\d+$/.test(value.trim())) return false;
  const days = Number(value);
  return Number.isSafeInteger(days) && days >= 1 && days <= 90;
}

/** Never let bad API timestamps throw RangeError during a React render. */
export function formatCcmddDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg", day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(date) + " SAST";
}
