import { useId, useState, type KeyboardEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { Loader2, Plus, Search, ShoppingBag } from "lucide-react";
import { MIN_SEARCH_LENGTH, searchMedicines, type Medicine, type MedicineAlternative } from "@/shared/api/prescribing";
import { useDebouncedValue } from "../pharmacy/lib/useDebouncedValue";
import { StockBadge } from "./StockBadge";

interface MedicinePickerProps {
  /** Medicines already on the prescription, so the list can say so. */
  pickedProductIds: Set<string>;
  onPickFromStock: (medicine: Medicine) => void;
  /** An out-of-stock (or short) medicine the patient will buy; `medicine` is null for a typed name. */
  onPickToBuy: (medicine: Medicine | null, typedName: string) => void;
  onPickAlternative: (alternative: MedicineAlternative, from: Medicine) => void;
  onPharmacyKnown?: (name: string) => void;
}

const SHORT_DATED_DAYS = 60;

function shortDated(isoDate: string | null): string | null {
  if (!isoDate) return null;
  const days = Math.ceil((new Date(isoDate).getTime() - Date.now()) / 86_400_000);
  return days <= SHORT_DATED_DAYS ? `Short-dated: some expires ${new Date(isoDate).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}` : null;
}

// Type a name, see what the pharmacy really holds. In stock medicines are added
// to the prescription; out-of-stock ones offer an alternative or "patient buys".
export function MedicinePicker({ pickedProductIds, onPickFromStock, onPickToBuy, onPickAlternative, onPharmacyKnown }: MedicinePickerProps) {
  const listId = useId();
  const [text, setText] = useState("");
  const [active, setActive] = useState(0);
  const query = useDebouncedValue(text.trim(), 250);
  const enabled = query.length >= MIN_SEARCH_LENGTH;

  const search = useQuery({
    queryKey: ["prescribing", "medicines", query],
    queryFn: async () => {
      const result = await searchMedicines(query);
      onPharmacyKnown?.(result.facilityName);
      return result;
    },
    enabled,
    staleTime: 10_000,
  });

  const medicines = enabled ? (search.data?.medicines ?? []) : [];
  const waiting = enabled && (search.isFetching || query !== text.trim());
  const showList = text.trim().length >= MIN_SEARCH_LENGTH;

  function choose(medicine: Medicine) {
    if (medicine.available > 0) {
      onPickFromStock(medicine);
      setText("");
    } else {
      onPickToBuy(medicine, medicine.name);
      setText("");
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, Math.max(medicines.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && medicines[active]) {
      event.preventDefault();
      choose(medicines[active]);
    } else if (event.key === "Escape") {
      setText("");
    }
  }

  return (
    <div className="relative">
      <label htmlFor={`${listId}-input`} className="mb-1.5 block text-[13px] font-medium text-text-primary">
        Search the pharmacy&apos;s medicines
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-text-secondary" aria-hidden />
        <input
          id={`${listId}-input`}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          placeholder="Type a medicine, e.g. amoxicillin"
          className="h-12 w-full rounded-xl border border-border-strong bg-surface-raised pl-10 pr-10 text-[15px] text-text-primary outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        />
        {waiting && <Loader2 className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-text-secondary" aria-hidden />}
      </div>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Medicines"
          className="mt-2 max-h-96 divide-y divide-border-subtle overflow-y-auto rounded-xl border border-border-subtle bg-surface-raised shadow-card"
        >
          {medicines.map((medicine, index) => {
            const out = medicine.available === 0;
            const picked = pickedProductIds.has(medicine.productId);
            const dated = shortDated(medicine.nearestExpiry);
            return (
              <li
                key={medicine.productId}
                role="option"
                aria-selected={index === active}
                className={clsx("flex flex-col gap-2 px-4 py-3", index === active && "bg-brand-50")}
                onMouseEnter={() => setActive(index)}
              >
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <div className="min-w-0">
                    <p className="text-[14.5px] font-semibold text-text-primary">{medicine.name}</p>
                    <p className="text-[12.5px] text-text-secondary">
                      {[medicine.code, medicine.genericName, medicine.schedule && `Schedule ${medicine.schedule.slice(1)}`].filter(Boolean).join(" · ")}
                    </p>
                    {dated && <p className="mt-0.5 text-[12.5px] text-amber-600">{dated}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <StockBadge level={medicine.level} available={medicine.available} />
                    {out ? (
                      <button
                        type="button"
                        onClick={() => choose(medicine)}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border-strong bg-surface-raised px-3 text-[13.5px] font-semibold text-text-primary hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                      >
                        <ShoppingBag className="size-4" aria-hidden /> Patient buys this
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={picked}
                        onClick={() => choose(medicine)}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-brand-500 px-3.5 text-[13.5px] font-semibold text-white hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:cursor-not-allowed disabled:bg-ink-200 disabled:text-ink-500"
                      >
                        {picked ? "Added" : (<><Plus className="size-4" aria-hidden /> Prescribe</>)}
                      </button>
                    )}
                  </div>
                </div>
                {out && medicine.alternatives.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg bg-brand-50 px-3 py-2">
                    <span className="text-[12.5px] font-medium text-brand-700">In stock, same medicine:</span>
                    {medicine.alternatives.map((alternative) => (
                      <button
                        key={alternative.productId}
                        type="button"
                        onClick={() => {
                          onPickAlternative(alternative, medicine);
                          setText("");
                        }}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-brand-300 bg-surface-raised px-3 text-[12.5px] font-semibold text-brand-700 hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                      >
                        {alternative.name} · {alternative.available} in stock
                      </button>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
          {!waiting && medicines.length === 0 && (
            <li className="px-4 py-4 text-[13.5px] text-text-secondary">No medicine called &quot;{text.trim()}&quot; in the pharmacy&apos;s list.</li>
          )}
          <li className="px-4 py-3">
            <button
              type="button"
              onClick={() => {
                onPickToBuy(null, text.trim());
                setText("");
              }}
              className="inline-flex min-h-11 items-center gap-2 text-[13.5px] font-semibold text-brand-700 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              <ShoppingBag className="size-4" aria-hidden /> Add &quot;{text.trim()}&quot; for the patient to buy
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
