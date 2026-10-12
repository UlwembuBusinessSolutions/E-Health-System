import clsx from "clsx";

export interface FilterChipOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

interface FilterChipsProps<T extends string> {
  /** Accessible name of the group, e.g. "Stock status". */
  label: string;
  options: FilterChipOption<T>[];
  /** Selected value, or null for "no filter". */
  value: T | null;
  /** Receives null when the active chip is pressed again. */
  onChange: (value: T | null) => void;
}

export function FilterChips<T extends string>({ label, options, value, onChange }: FilterChipsProps<T>) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const pressed = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={pressed}
            onClick={() => onChange(pressed ? null : option.value)}
            className={clsx(
              "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-[13.5px] font-medium transition-colors duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
              pressed
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : "border-border-strong bg-surface-raised text-text-secondary hover:text-text-primary",
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[12px] tabular-nums">{option.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
