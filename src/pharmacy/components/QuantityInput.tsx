import { useState, type KeyboardEvent } from "react";
import clsx from "clsx";
import { Minus, Plus } from "lucide-react";

interface QuantityInputProps {
  value: number;
  onChange: (value: number) => void;
  /** Accessible name, e.g. "Quantity received". */
  label: string;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// While the field is focused it shows what the user is typing (`draft`), not
// the clamped value, so clearing the box or typing "1" on the way to "12"
// is never fought by min/max. The value is clamped on blur and by the buttons.
export function QuantityInput({
  value,
  onChange,
  label,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  step = 1,
  disabled = false,
  className,
}: QuantityInputProps) {
  const [draft, setDraft] = useState<string | null>(null);

  const current = draft === null || draft === "" ? value : Number(draft);

  function handleType(raw: string) {
    const digits = raw.replace(/\D/g, "");
    setDraft(digits);
    if (digits !== "") onChange(Math.min(Number(digits), max));
  }

  function commit(next: number) {
    setDraft(null);
    onChange(clamp(next, min, max));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      commit(current + (event.key === "ArrowUp" ? step : -step));
    }
  }

  const stepButton =
    "grid size-11 shrink-0 place-items-center text-text-secondary hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div
      className={clsx(
        "inline-flex items-stretch overflow-hidden rounded-lg border border-border-strong bg-surface-raised focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100",
        className,
      )}
    >
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        disabled={disabled || current <= min}
        onClick={() => commit(current - step)}
        className={stepButton}
      >
        <Minus className="size-4" aria-hidden />
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        role="spinbutton"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max === Number.MAX_SAFE_INTEGER ? undefined : max}
        aria-valuenow={value}
        disabled={disabled}
        value={draft ?? String(value)}
        onChange={(event) => handleType(event.target.value)}
        onFocus={(event) => event.target.select()}
        onBlur={() => commit(draft === "" ? min : current)}
        onKeyDown={handleKeyDown}
        className="h-11 w-16 min-w-0 bg-transparent text-center text-[15px] font-semibold tabular-nums text-text-primary outline-none disabled:opacity-60"
      />
      <button
        type="button"
        aria-label={`Increase ${label}`}
        disabled={disabled || current >= max}
        onClick={() => commit(current + step)}
        className={stepButton}
      >
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  );
}
