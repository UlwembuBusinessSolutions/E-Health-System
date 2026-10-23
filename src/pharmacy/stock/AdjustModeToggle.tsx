import clsx from "clsx";
import type { AdjustmentMode } from "@/shared/api/pharmacyStock";

const MODES: { value: AdjustmentMode; label: string }[] = [
  { value: "REMOVE", label: "Remove stock" },
  { value: "ADD", label: "Add stock found" },
];

interface AdjustModeToggleProps {
  mode: AdjustmentMode;
  onChange: (mode: AdjustmentMode) => void;
}

export function AdjustModeToggle({ mode, onChange }: AdjustModeToggleProps) {
  return (
    <div role="group" aria-label="What are you doing?" className="grid grid-cols-2 gap-2">
      {MODES.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          aria-pressed={mode === value}
          onClick={() => onChange(value)}
          className={clsx(
            "min-h-11 rounded-lg border px-3 text-[14px] font-semibold",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
            mode === value
              ? "border-brand-500 bg-brand-50 text-brand-700"
              : "border-border-strong bg-surface-raised text-text-secondary hover:text-text-primary",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
