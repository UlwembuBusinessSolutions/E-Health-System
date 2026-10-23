import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { Button } from "@/shared/components/Button";
import { Input } from "@/shared/components/Input";
import { pluralise } from "../lib/format";

interface SerialAddInputProps {
  added: string[];
  /** Serials already on the shelf; adding one again would double-count a unit. */
  serialsInStock: string[];
  onChange: (serials: string[]) => void;
}

// A barcode scanner types the code and presses Enter, so Enter adds. The
// server remains the authority on duplicates across the whole facility; the
// checks here only catch the obvious cases before a round trip.
export function SerialAddInput({ added, serialsInStock, onChange }: SerialAddInputProps) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  function addDraft() {
    const serial = draft.trim();
    if (!serial) return;
    const alreadyListed = added.includes(serial);
    if (alreadyListed || serialsInStock.includes(serial)) {
      setError(`${serial} is already ${alreadyListed ? "in this list" : "in stock"}.`);
      return;
    }
    setError(null);
    setDraft("");
    onChange([...added, serial]);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    // Enter must not submit the surrounding dialog.
    event.preventDefault();
    addDraft();
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <Input
            label="Serial numbers found"
            hint="Scan each unit, or type it and press Enter."
            placeholder="e.g. GM-20440"
            className="font-mono"
            value={draft}
            error={error ?? undefined}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        {/* Offset by the label's height so the button lines up with the field, not its caption. */}
        <Button variant="secondary" onClick={addDraft} className="mt-[1.625rem]">
          Add
        </Button>
      </div>
      {added.length > 0 && (
        <ul aria-label={`${pluralise(added.length, "serial number")} to add`} className="flex flex-wrap gap-2">
          {added.map((serial) => (
            <li
              key={serial}
              className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-brand-50 pl-3 font-mono text-[13px] text-brand-700"
            >
              {serial}
              <button
                type="button"
                aria-label={`Remove serial ${serial}`}
                onClick={() => onChange(added.filter((item) => item !== serial))}
                className="grid size-9 place-items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
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
