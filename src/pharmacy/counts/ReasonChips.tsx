import clsx from "clsx";
import type { CountReason } from "@/shared/api/pharmacyCounts";
import { REASON_LABELS } from "./countMath";

interface ReasonChipsProps {
  /** Names the group for screen readers, e.g. "Reason for Metformin lot MF1120". */
  label: string;
  options: CountReason[];
  value: string | null;
  onChange: (reason: CountReason) => void;
}

export function ReasonChips({ label, options, value, onChange }: ReasonChipsProps) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((reason) => {
        const pressed = value === reason;
        return (
          <button
            key={reason}
            type="button"
            aria-pressed={pressed}
            onClick={() => onChange(reason)}
            className={clsx(
              "min-h-11 rounded-full border px-3.5 text-[13px] font-medium transition-colors duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
              pressed
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : "border-border-strong bg-surface-raised text-text-secondary hover:text-text-primary",
            )}
          >
            {REASON_LABELS[reason]}
          </button>
        );
      })}
    </div>
  );
}
