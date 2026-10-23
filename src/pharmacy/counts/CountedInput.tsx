import { useState } from "react";

interface CountedInputProps {
  value: number | null;
  /** Accessible name, e.g. "Counted quantity for Metformin lot MF1120". */
  label: string;
  onCommit: (quantity: number) => void;
  disabled?: boolean;
}

// Typing never saves. The number is committed when the field loses focus or
// Enter is pressed, so each line is stamped with the system quantity once,
// at the moment the pharmacist finished counting it, not on every keystroke.
export function CountedInput({ value, label, onCommit, disabled = false }: CountedInputProps) {
  const [draft, setDraft] = useState<string | null>(null);

  function commit() {
    if (draft === null) return;
    const digits = draft.trim();
    setDraft(null);
    if (digits === "") return;
    const quantity = Number(digits);
    if (quantity !== value) onCommit(quantity);
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      aria-label={label}
      disabled={disabled}
      placeholder={"—"}
      value={draft ?? (value === null ? "" : String(value))}
      onChange={(event) => setDraft(event.target.value.replace(/\D/g, ""))}
      onFocus={(event) => event.target.select()}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
      className="h-11 w-24 rounded-lg border border-border-strong bg-surface-raised px-3 text-right text-[15px] font-semibold tabular-nums text-text-primary outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:opacity-60"
    />
  );
}
