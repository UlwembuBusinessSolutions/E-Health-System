import { useId, useState, type FormEvent, type KeyboardEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Plus, Split, TriangleAlert } from "lucide-react";
import { MIN_SEARCH_LENGTH, searchMedicines, type Medicine } from "@/shared/api/prescribing";
import { Button } from "@/shared/components/Button";
import { useDebouncedValue } from "../pharmacy/lib/useDebouncedValue";
import { StockBadge } from "./StockBadge";
import {
  FREQUENCIES,
  ROUTES,
  UNITS,
  findDuplicate,
  newKey,
  shelfLeftFor,
  unitForBaseUnit,
  type Entry,
  type Supply,
} from "./entries";

interface MedicineFormProps {
  entries: Entry[];
  /** The entry being edited, or null when adding a new one. */
  editing: Entry | null;
  onSave: (saved: Entry[], replacingKey: string | null) => void;
  onPharmacyKnown: (name: string) => void;
  onCancelEdit: () => void;
}

interface Fields {
  name: string;
  strengthForm: string;
  dose: string;
  route: string;
  frequency: string;
  duration: string;
  quantity: string;
  unit: string;
  supply: Supply;
  instructions: string;
}

/** What was picked from the pharmacy's list, which decides whether the pharmacy can supply it. */
interface Picked {
  productId: string;
  available: number;
}

const EMPTY: Fields = {
  name: "", strengthForm: "", dose: "", route: "", frequency: "", duration: "", quantity: "", unit: "", supply: "BUY", instructions: "",
};

const INPUT_CLASS =
  "h-11 w-full rounded-lg border border-border-strong bg-surface-raised px-3 text-[14.5px] text-text-primary outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

function fieldsOf(entry: Entry): Fields {
  return {
    name: entry.name, strengthForm: entry.strengthForm, dose: entry.dose, route: entry.route, frequency: entry.frequency,
    duration: entry.duration, quantity: String(entry.quantity), unit: entry.unit, supply: entry.supply, instructions: entry.instructions,
  };
}

function Field({ label, note, className = "", children }: { label: string; note?: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`flex flex-col gap-1.5 text-[13px] font-medium text-text-primary ${className}`}>
      {label}
      {children}
      {note && <span className="text-[12px] font-normal text-text-secondary">{note}</span>}
    </label>
  );
}

// Step 1 of the prescription: one medicine at a time, with every direction written out. The name box
// searches the pharmacy's live stock; a medicine picked from it can be supplied by the pharmacy, one
// typed by hand can only be bought by the patient.
export function MedicineForm({ entries, editing, onSave, onPharmacyKnown, onCancelEdit }: MedicineFormProps) {
  const listId = useId();
  const [fields, setFields] = useState<Fields>(() => (editing ? fieldsOf(editing) : EMPTY));
  const [picked, setPicked] = useState<Picked | null>(() =>
    editing?.productId && editing.available !== null ? { productId: editing.productId, available: editing.available } : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [splitOffer, setSplitOffer] = useState<{ left: number; extra: number } | null>(null);
  const [searching, setSearching] = useState(false);
  const [active, setActive] = useState(0);

  const query = useDebouncedValue(fields.name.trim(), 250);
  const canSearch = searching && query.length >= MIN_SEARCH_LENGTH;
  const search = useQuery({
    queryKey: ["prescribing", "medicines", query],
    queryFn: async () => {
      const result = await searchMedicines(query);
      onPharmacyKnown(result.facilityName);
      return result;
    },
    enabled: canSearch,
    staleTime: 10_000,
  });
  const results = canSearch ? (search.data?.medicines ?? []) : [];
  const waiting = canSearch && (search.isFetching || query !== fields.name.trim());

  const pharmacyAllowed = picked !== null && picked.available > 0;

  function set<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields((current) => ({ ...current, [key]: value }));
    setError(null);
    setSplitOffer(null);
  }

  function typeName(name: string) {
    // Changing the name after picking makes it a hand-typed medicine again.
    setPicked(null);
    setFields((current) => ({ ...current, name, supply: "BUY" }));
    setSearching(true);
    setActive(0);
    setError(null);
    setSplitOffer(null);
  }

  function pick(medicine: Medicine) {
    const strengthForm = [medicine.strength, medicine.dosageForm].filter(Boolean).join(" ");
    setPicked({ productId: medicine.productId, available: medicine.available });
    setFields((current) => ({
      ...current,
      name: medicine.name,
      strengthForm: strengthForm || current.strengthForm,
      unit: unitForBaseUnit(medicine.unit),
      supply: medicine.available > 0 ? "PHARMACY" : "BUY",
    }));
    setSearching(false);
    setError(null);
    setSplitOffer(null);
  }

  function onNameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!searching || results.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      pick(results[active]);
    } else if (event.key === "Escape") {
      setSearching(false);
    }
  }

  function clear() {
    setFields(EMPTY);
    setPicked(null);
    setError(null);
    setSplitOffer(null);
    setSearching(false);
  }

  function buildEntry(quantity: number, supply: Supply, key: string): Entry {
    return {
      key,
      productId: picked?.productId ?? null,
      name: fields.name.trim(),
      strengthForm: fields.strengthForm.trim(),
      dose: fields.dose.trim(),
      route: fields.route,
      frequency: fields.frequency.trim(),
      duration: fields.duration.trim(),
      quantity,
      unit: fields.unit,
      supply,
      instructions: fields.instructions.trim(),
      available: picked?.available ?? null,
    };
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const quantity = Number(fields.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) return setError("Quantity must be a whole number of 1 or more.");
    const duplicate = findDuplicate(entries, { name: fields.name, strengthForm: fields.strengthForm, supply: fields.supply }, editing?.key);
    if (duplicate) {
      return setError(`${duplicate.name} ${duplicate.strengthForm} is already on this prescription. Edit that row instead.`);
    }
    if (fields.supply === "PHARMACY") {
      if (!pharmacyAllowed || !picked) return setError("Only a medicine picked from the pharmacy's list can be supplied by the pharmacy.");
      const left = shelfLeftFor(entries, { productId: picked.productId, available: picked.available }, editing?.key);
      if (quantity > left) {
        setSplitOffer({ left, extra: quantity - left });
        return setError(`The pharmacy holds ${left}, you asked for ${quantity}.`);
      }
    }
    onSave([buildEntry(quantity, fields.supply, editing?.key ?? newKey())], editing?.key ?? null);
    clear();
  }

  function splitAndSave() {
    if (!splitOffer) return;
    const pharmacyPart = splitOffer.left > 0 ? [buildEntry(splitOffer.left, "PHARMACY", editing?.key ?? newKey())] : [];
    onSave([...pharmacyPart, buildEntry(splitOffer.extra, "BUY", newKey())], editing?.key ?? null);
    clear();
  }

  const supplyNote = picked === null
    ? "Not from the pharmacy's list, so the patient buys it."
    : pharmacyAllowed ? `In stock: ${picked.available} available.` : "Out of stock at the pharmacy, so the patient buys it.";

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-xl border border-border-subtle bg-surface-sunken/50 p-4 sm:p-5">
      <h3 className="flex items-center gap-2.5 text-[15px] font-semibold text-text-primary">
        <span className="grid size-6 place-items-center rounded-full bg-brand-500 text-[12px] font-bold text-white">1</span>
        {editing ? `Edit ${editing.name}` : "Add a medicine"}
      </h3>

      <div className="grid gap-4 sm:grid-cols-6">
        <div className="relative sm:col-span-3">
          <label htmlFor={`${listId}-name`} className="flex flex-col gap-1.5 text-[13px] font-medium text-text-primary">
            Medicine name *
            <div className="relative">
              <input
                id={`${listId}-name`}
                role="combobox"
                aria-expanded={searching && results.length > 0}
                aria-controls={listId}
                aria-autocomplete="list"
                autoComplete="off"
                required
                maxLength={160}
                value={fields.name}
                onChange={(event) => typeName(event.target.value)}
                onKeyDown={onNameKeyDown}
                onBlur={() => window.setTimeout(() => setSearching(false), 150)}
                placeholder="Search the pharmacy's medicines or enter your own"
                className={INPUT_CLASS}
              />
              {waiting && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-text-secondary" aria-hidden />}
            </div>
            <span className="text-[12px] font-normal text-text-secondary">Stock is checked live. Picked medicines show how many are on the shelf.</span>
          </label>
          {searching && canSearch && (
            <ul
              id={listId}
              role="listbox"
              aria-label="Medicines"
              className="absolute left-0 right-0 z-20 mt-1 max-h-80 divide-y divide-border-subtle overflow-y-auto rounded-xl border border-border-subtle bg-surface-raised shadow-card"
            >
              {results.map((medicine, index) => (
                <li
                  key={medicine.productId}
                  role="option"
                  aria-selected={index === active}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    pick(medicine);
                  }}
                  onMouseEnter={() => setActive(index)}
                  className={`flex cursor-pointer flex-col gap-1.5 px-3.5 py-2.5 ${index === active ? "bg-brand-50" : ""}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[14px] font-semibold text-text-primary">{medicine.name}</span>
                    <StockBadge level={medicine.level} available={medicine.available} />
                  </div>
                  {medicine.available === 0 && medicine.alternatives.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-brand-700">
                      In stock, same medicine:
                      {medicine.alternatives.map((alternative) => (
                        <button
                          key={alternative.productId}
                          type="button"
                          onMouseDown={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            const full = results.find((candidate) => candidate.productId === alternative.productId);
                            pick(full ?? { ...medicine, productId: alternative.productId, name: alternative.name, available: alternative.available, level: "IN_STOCK", alternatives: [] });
                          }}
                          className="min-h-9 rounded-full border border-brand-300 bg-surface-raised px-3 text-[12.5px] font-semibold hover:bg-brand-100"
                        >
                          {alternative.name} · {alternative.available}
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              ))}
              {!waiting && results.length === 0 && (
                <li className="px-3.5 py-3 text-[13px] text-text-secondary">Not in the pharmacy&apos;s list. Keep typing to enter it yourself; the patient will buy it.</li>
              )}
            </ul>
          )}
        </div>
        <Field label="Strength & form *" note="Include the strength and dosage form." className="sm:col-span-3">
          <input required maxLength={100} value={fields.strengthForm} onChange={(event) => set("strengthForm", event.target.value)} placeholder="e.g. 500 mg tablet" className={INPUT_CLASS} />
        </Field>

        <Field label="Dose *" className="sm:col-span-2">
          <input required maxLength={100} value={fields.dose} onChange={(event) => set("dose", event.target.value)} placeholder="e.g. 1 tablet" className={INPUT_CLASS} />
        </Field>
        <Field label="Route *" className="sm:col-span-2">
          <select required value={fields.route} onChange={(event) => set("route", event.target.value)} className={INPUT_CLASS}>
            <option value="">Select route</option>
            {ROUTES.map((route) => (
              <option key={route}>{route}</option>
            ))}
          </select>
        </Field>
        <Field label="Frequency *" className="sm:col-span-2">
          <input required maxLength={120} list={`${listId}-frequency`} value={fields.frequency} onChange={(event) => set("frequency", event.target.value)} placeholder="Select or type frequency" className={INPUT_CLASS} />
          <datalist id={`${listId}-frequency`}>
            {FREQUENCIES.map((frequency) => (
              <option key={frequency} value={frequency} />
            ))}
          </datalist>
        </Field>

        <Field label="Duration *" className="sm:col-span-2">
          <input required maxLength={100} value={fields.duration} onChange={(event) => set("duration", event.target.value)} placeholder="e.g. 5 days, or ongoing" className={INPUT_CLASS} />
        </Field>
        <Field label="Quantity *" className="sm:col-span-2">
          <input required type="number" min={1} max={99999} step={1} value={fields.quantity} onChange={(event) => set("quantity", event.target.value)} placeholder="0" className={INPUT_CLASS} />
        </Field>
        <Field label="Quantity unit *" className="sm:col-span-2">
          <select required value={fields.unit} onChange={(event) => set("unit", event.target.value)} className={INPUT_CLASS}>
            <option value="">Select unit</option>
            {UNITS.map((unit) => (
              <option key={unit}>{unit}</option>
            ))}
          </select>
        </Field>

        <Field label="Who supplies it *" note={supplyNote} className="sm:col-span-3">
          <select required value={fields.supply} onChange={(event) => set("supply", event.target.value as Supply)} className={INPUT_CLASS}>
            <option value="PHARMACY" disabled={!pharmacyAllowed}>Pharmacy</option>
            <option value="BUY">Patient buys</option>
          </select>
        </Field>
        <Field label="Patient instructions (optional)" className="sm:col-span-3">
          <input maxLength={200} value={fields.instructions} onChange={(event) => set("instructions", event.target.value)} placeholder="Additional directions for the patient" className={INPUT_CLASS} />
        </Field>
      </div>

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-amber-50 px-3.5 py-2.5 text-[13.5px] text-amber-600">
          <span className="flex items-center gap-2"><TriangleAlert className="size-4 shrink-0" aria-hidden />{error}</span>
          {splitOffer && (
            <Button type="button" variant="secondary" icon={<Split className="size-4" aria-hidden />} onClick={splitAndSave}>
              {splitOffer.left > 0 ? `Take ${splitOffer.left} from the pharmacy, patient buys ${splitOffer.extra}` : `Patient buys all ${splitOffer.extra}`}
            </Button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[12.5px] text-text-secondary">* Required. You enter the quantity yourself.</span>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={clear}>Clear entry</Button>
          {editing && <Button type="button" variant="secondary" onClick={() => { clear(); onCancelEdit(); }}>Cancel edit</Button>}
          <Button type="submit" icon={editing ? undefined : <Plus className="size-4" aria-hidden />}>{editing ? "Update medicine" : "Add to prescription"}</Button>
        </div>
      </div>
    </form>
  );
}
