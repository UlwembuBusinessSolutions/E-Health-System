import clsx from "clsx";

export interface OptionCard<T extends string> {
  value: T;
  label: string;
  hint: string;
}

interface OptionCardsProps<T extends string> {
  legend: string;
  options: OptionCard<T>[];
  /** Null when nothing is selected (presets start unselected). */
  value: T | null;
  onChange: (value: T) => void;
  /** Hide the legend visually while keeping it for screen readers. */
  hideLegend?: boolean;
}

// One selectable card per option, used for product type, tracking and presets.
// Buttons with aria-pressed (not radios) because presets can start with no
// selection and re-pressing is harmless.
export function OptionCards<T extends string>({ legend, options, value, onChange, hideLegend = false }: OptionCardsProps<T>) {
  return (
    <fieldset>
      <legend className={clsx("mb-1.5 text-[13px] font-medium text-text-primary", hideLegend && "sr-only")}>{legend}</legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.value)}
              className={clsx(
                "flex min-h-11 flex-col items-start gap-0.5 rounded-lg border px-3.5 py-2.5 text-left",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
                selected ? "border-brand-500 bg-brand-50" : "border-border-strong bg-surface-raised hover:bg-surface-sunken",
              )}
            >
              <span className="text-[14px] font-semibold text-text-primary">{option.label}</span>
              <span className="text-[12.5px] text-text-secondary">{option.hint}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
