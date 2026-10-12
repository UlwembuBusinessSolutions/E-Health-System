import clsx from "clsx";
import { daysUntil, formatDate, pluralise } from "../lib/format";

// Matches the backend's "expires soon" window (GET /expiry defaults to 90).
const WARNING_WINDOW_DAYS = 90;

interface ExpiryTextProps {
  /** `YYYY-MM-DD`, or null for products without expiry tracking. */
  date: string | null;
  className?: string;
}

// The urgency is spelled out ("expired", "in 12 days"), not only coloured.
function describeUrgency(days: number): string | null {
  if (days < 0) return "expired";
  if (days === 0) return "today";
  if (days <= WARNING_WINDOW_DAYS) return `in ${pluralise(days, "day")}`;
  return null;
}

export function ExpiryText({ date, className }: ExpiryTextProps) {
  if (!date) return <span className={clsx("text-text-secondary", className)}>—</span>;

  const days = daysUntil(date);
  const urgency = describeUrgency(days);
  const tone = days < 0 ? "text-danger-600" : days <= WARNING_WINDOW_DAYS ? "text-amber-600" : "text-text-primary";

  return (
    <span className={clsx("tabular-nums", tone, className)}>
      <time dateTime={date}>{formatDate(date)}</time>
      {urgency && <span className="ml-1.5 text-[12px] font-medium">({urgency})</span>}
    </span>
  );
}
