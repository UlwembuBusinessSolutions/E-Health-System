import clsx from "clsx";
import { pluralise } from "../lib/format";

interface SerialRemovePickerProps {
  serialsInStock: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

export function SerialRemovePicker({ serialsInStock, selected, onChange }: SerialRemovePickerProps) {
  function toggle(serial: string) {
    onChange(selected.includes(serial) ? selected.filter((item) => item !== serial) : [...selected, serial]);
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-[13px] font-medium text-text-primary">
        Which serial numbers?{" "}
        <span className="font-normal text-text-secondary">{pluralise(selected.length, "unit")} selected</span>
      </legend>
      <div className="flex flex-wrap gap-2">
        {serialsInStock.map((serial) => {
          const on = selected.includes(serial);
          return (
            <button
              key={serial}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(serial)}
              className={clsx(
                "min-h-11 rounded-lg border px-3.5 font-mono text-[13.5px]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
                on ? "border-brand-700 bg-brand-700 text-white" : "border-border-strong bg-surface-raised text-text-primary",
              )}
            >
              {serial}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
