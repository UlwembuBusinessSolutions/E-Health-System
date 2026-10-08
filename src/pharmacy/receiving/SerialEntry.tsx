import { useId, useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { addSerial } from "./receiptValidation";

interface SerialEntryProps {
  serials: string[];
  onChange: (serials: string[]) => void;
}

// Scanners "type" the serial and press Enter, so Enter is the commit key.
export function SerialEntry({ serials, onChange }: SerialEntryProps) {
  const inputId = useId();
  const errorId = useId();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  function commit() {
    const result = addSerial(serials, text);
    setError(result.error);
    if (result.error) return;
    onChange(result.serials);
    setText("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    // Without this Enter would submit any surrounding form.
    event.preventDefault();
    commit();
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-[13px] font-medium text-text-primary">
        Serial numbers <span className="font-normal text-text-secondary">· scan each unit, or type and press Enter</span>
      </label>
      <input
        id={inputId}
        value={text}
        autoComplete="off"
        maxLength={100}
        placeholder="e.g. GM-20440"
        aria-invalid={error !== null}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => {
          setText(event.target.value);
          setError(null);
        }}
        onKeyDown={handleKeyDown}
        className="h-11 w-full rounded-lg border border-border-strong bg-surface-raised px-3.5 text-[15px] text-text-primary outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 aria-invalid:border-danger-500"
      />
      {error && (
        <p id={errorId} role="alert" className="text-[13px] text-danger-600">
          {error}
        </p>
      )}
      {serials.length > 0 && (
        <ul aria-label="Scanned serial numbers" className="flex flex-wrap gap-2">
          {serials.map((serial) => (
            <li
              key={serial}
              className="inline-flex items-center gap-1 rounded-full bg-surface-sunken py-1 pl-3 pr-1 font-mono text-[13px] text-text-primary"
            >
              {serial}
              <button
                type="button"
                aria-label={`Remove serial ${serial}`}
                onClick={() => onChange(serials.filter((value) => value !== serial))}
                className="grid size-9 place-items-center rounded-full text-text-secondary hover:bg-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
