import { useId } from "react";
import clsx from "clsx";

export interface ReasonOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

interface ReasonPickerProps<T extends string> {
  /** Visible group heading, e.g. "Why are you removing this stock?" */
  legend: string;
  options: ReasonOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  note: string;
  onNoteChange: (note: string) => void;
  /** The option that needs a written explanation. */
  otherValue?: T;
  minNoteLength?: number;
}

// Real radio inputs (visually hidden) rather than ARIA-faked buttons: arrow-key
// navigation, grouping and screen-reader announcements all come for free.
export function ReasonPicker<T extends string>({
  legend,
  options,
  value,
  onChange,
  note,
  onNoteChange,
  otherValue = "OTHER" as T,
  minNoteLength = 3,
}: ReasonPickerProps<T>) {
  const name = useId();
  const noteId = useId();
  const needsNote = value === otherValue;
  const noteTooShort = note.trim().length < minNoteLength;

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-[13px] font-medium text-text-primary">{legend}</legend>
      {options.map((option) => (
        <label
          key={option.value}
          className={clsx(
            "flex min-h-11 cursor-pointer flex-col justify-center rounded-lg border px-3.5 py-2.5 transition-colors duration-150",
            "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-400",
            value === option.value
              ? "border-brand-500 bg-brand-50"
              : "border-border-strong bg-surface-raised hover:bg-surface-sunken",
          )}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="sr-only"
          />
          <span className="text-[14px] font-medium text-text-primary">{option.label}</span>
          {option.description && <span className="text-[12.5px] text-text-secondary">{option.description}</span>}
        </label>
      ))}
      {needsNote && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={noteId} className="text-[13px] font-medium text-text-primary">
            Add a note <span className="text-danger-500">*</span>
          </label>
          <textarea
            id={noteId}
            rows={3}
            required
            autoFocus
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
            aria-invalid={noteTooShort}
            aria-describedby={`${noteId}-hint`}
            className="w-full rounded-lg border border-border-strong bg-surface-raised px-3.5 py-2.5 text-[15px] text-text-primary outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
          <p id={`${noteId}-hint`} className="text-[13px] text-text-secondary">
            Required: at least {minNoteLength} characters.
          </p>
        </div>
      )}
    </fieldset>
  );
}
