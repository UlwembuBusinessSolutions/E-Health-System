import { useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { Plus } from "lucide-react";
import { MIN_DIAGNOSIS_SEARCH_LENGTH, searchDiagnoses, type DiagnosisOption } from "@/shared/api/diagnoses";
import { useDebouncedValue } from "@/pharmacy/lib/useDebouncedValue";

/** What the clinician chose: a diagnosis from the catalogue, or a name to add to it. */
export type DiagnosisChoice = { diagnosisId: string; name: string } | { diagnosisText: string };

interface DiagnosisSearchInputProps {
  label: string;
  value: string;
  placeholder?: string;
  /** Called on every keystroke. */
  onChangeText: (text: string) => void;
  onChoose: (choice: DiagnosisChoice) => void;
}

const NEW_ENTRY = "new";

// Searches the diagnosis catalogue as the clinician types. When nothing matches the name exactly, the last
// option adds what they typed as a new diagnosis, so the catalogue grows instead of filling up with free text.
export function DiagnosisSearchInput({ label, value, placeholder, onChangeText, onChoose }: DiagnosisSearchInputProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const wrapper = useRef<HTMLDivElement>(null);

  const typed = value.trim();
  const debounced = useDebouncedValue(typed, 200);
  const searching = debounced.length >= MIN_DIAGNOSIS_SEARCH_LENGTH;
  const { data: matches = [], isFetching } = useQuery({
    queryKey: ["diagnosis-search", debounced],
    queryFn: () => searchDiagnoses(debounced),
    enabled: searching,
    staleTime: 60_000,
  });

  const canAddNew =
    typed.length >= MIN_DIAGNOSIS_SEARCH_LENGTH &&
    !matches.some((match) => match.name.toLowerCase() === typed.toLowerCase());
  const optionCount = matches.length + (canAddNew ? 1 : 0);
  const showList = open && typed.length >= MIN_DIAGNOSIS_SEARCH_LENGTH;

  useEffect(() => {
    setHighlighted(0);
  }, [debounced]);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  function choose(option: DiagnosisOption | typeof NEW_ENTRY) {
    setOpen(false);
    onChoose(option === NEW_ENTRY ? { diagnosisText: typed } : { diagnosisId: option.id, name: option.name });
  }

  function optionAt(index: number): DiagnosisOption | typeof NEW_ENTRY | undefined {
    return index < matches.length ? matches[index] : canAddNew ? NEW_ENTRY : undefined;
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      if (optionCount > 0) {
        const step = event.key === "ArrowDown" ? 1 : -1;
        setHighlighted((current) => (current + step + optionCount) % optionCount);
      }
    } else if (event.key === "Enter" && showList) {
      const option = optionAt(highlighted);
      if (option) {
        event.preventDefault();
        choose(option);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  const optionId = (index: number) => `${id}-option-${index}`;

  return (
    <div ref={wrapper} className="relative flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-text-primary">
        {label}
      </label>
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={`${id}-listbox`}
        aria-autocomplete="list"
        aria-activedescendant={showList && optionCount > 0 ? optionId(highlighted) : undefined}
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(event) => {
          onChangeText(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className={clsx(
          "h-11 w-full rounded-lg border border-border-strong bg-surface-raised px-3.5 text-[15px] text-text-primary",
          "placeholder:text-text-secondary/70 outline-none transition-colors duration-150",
          "focus:border-brand-400 focus:ring-2 focus:ring-brand-100",
        )}
      />
      {showList && (
        <ul
          id={`${id}-listbox`}
          role="listbox"
          aria-label="Matching diagnoses"
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-auto rounded-xl border border-border-subtle bg-surface-raised py-1.5 shadow-card"
        >
          {matches.map((match, index) => (
            <li
              key={match.id}
              id={optionId(index)}
              role="option"
              aria-selected={index === highlighted}
              onMouseEnter={() => setHighlighted(index)}
              onMouseDown={(event) => {
                event.preventDefault();
                choose(match);
              }}
              className={clsx(
                "flex cursor-pointer items-center gap-2.5 px-3.5 py-2 text-[13.5px] text-text-primary",
                index === highlighted && "bg-brand-50",
              )}
            >
              <span className="w-14 shrink-0 font-mono text-[12px] font-semibold text-brand-600">{match.code ?? "—"}</span>
              <span className="min-w-0 flex-1 truncate">{match.name}</span>
              {match.source === "CUSTOM" && (
                <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10.5px] font-semibold text-ink-600">Added by clinic</span>
              )}
            </li>
          ))}
          {matches.length === 0 && canAddNew && searching && !isFetching && (
            <li role="presentation" className="px-3.5 py-1.5 text-[12.5px] text-text-secondary">
              Not in the catalogue yet.
            </li>
          )}
          {canAddNew && (
            <li
              id={optionId(matches.length)}
              role="option"
              aria-selected={highlighted === matches.length}
              onMouseEnter={() => setHighlighted(matches.length)}
              onMouseDown={(event) => {
                event.preventDefault();
                choose(NEW_ENTRY);
              }}
              className={clsx(
                "flex cursor-pointer items-center gap-2 border-t border-border-subtle px-3.5 py-2 text-[13.5px] font-medium text-brand-600",
                highlighted === matches.length && "bg-brand-50",
              )}
            >
              <Plus className="size-3.5 shrink-0" aria-hidden />
              <span className="min-w-0 truncate">Add “{typed}” as a new diagnosis</span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
