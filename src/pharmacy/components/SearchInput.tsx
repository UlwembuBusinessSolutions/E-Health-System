import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Search, X } from "lucide-react";
import { useDebouncedValue } from "../lib/useDebouncedValue";

interface SearchInputProps {
  /** Accessible name; also used as the placeholder unless one is given. */
  label: string;
  placeholder?: string;
  initialValue?: string;
  /** Called 250 ms after typing stops, and immediately on clear. */
  onSearch: (query: string) => void;
  className?: string;
}

export function SearchInput({ label, placeholder, initialValue = "", onSearch, className }: SearchInputProps) {
  const [text, setText] = useState(initialValue);
  const debounced = useDebouncedValue(text);
  // Remembering what was last reported stops the initial mount, and a clear
  // that already reported "", from firing a duplicate search.
  const lastReported = useRef(initialValue);
  // Callers often pass an inline function; holding the latest one in a ref
  // keeps it out of the effect's dependencies.
  const onSearchRef = useRef(onSearch);

  useEffect(() => {
    onSearchRef.current = onSearch;
  });

  useEffect(() => {
    if (debounced === lastReported.current) return;
    lastReported.current = debounced;
    onSearchRef.current(debounced);
  }, [debounced]);

  function clear() {
    setText("");
    if (lastReported.current === "") return;
    lastReported.current = "";
    onSearch("");
  }

  return (
    <div className={clsx("relative", className)}>
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-text-secondary"
        aria-hidden
      />
      <input
        type="search"
        aria-label={label}
        placeholder={placeholder ?? label}
        value={text}
        onChange={(event) => setText(event.target.value)}
        className={clsx(
          "h-11 w-full rounded-lg border border-border-strong bg-surface-raised pl-10 pr-11 text-[15px] text-text-primary",
          "placeholder:text-text-secondary/70 outline-none transition-colors duration-150",
          "focus:border-brand-400 focus:ring-2 focus:ring-brand-100",
          "[&::-webkit-search-cancel-button]:hidden",
        )}
      />
      {text && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={clear}
          className="absolute right-0 top-0 grid size-11 place-items-center rounded-lg text-text-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          <X className="size-4" aria-hidden />
        </button>
      )}
    </div>
  );
}
