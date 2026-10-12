import { useState } from "react";
import { Minus, Pill, Plus, ShoppingBag, Split, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/shared/components/Button";
import { MedicinePicker } from "./MedicinePicker";
import { StockBadge } from "./StockBadge";
import {
  DOSAGE_PRESETS,
  addBuyLine,
  addStockLine,
  draftProblems,
  maxQuantityFor,
  removeBuyLine,
  removeStockLine,
  shortfallOf,
  splitShortfall,
  updateBuyLine,
  updateStockLine,
  type BuyLine,
  type PrescriptionDraft,
  type StockLine,
} from "./prescriptionDraft";

interface PrescriptionBuilderProps {
  draft: PrescriptionDraft;
  onChange: (draft: PrescriptionDraft) => void;
}

const FIELD_CLASS =
  "h-11 w-full rounded-lg border border-border-strong bg-surface-raised px-3 text-[14.5px] text-text-primary outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

function QuantityStepper({ value, max, label, onChange }: { value: number; max?: number; label: string; onChange: (value: number) => void }) {
  const clamp = (next: number) => onChange(Math.max(1, max === undefined ? next : Math.min(next, Math.max(max, 1))));
  return (
    <div role="group" aria-label={label} className="inline-flex items-center rounded-lg border border-border-strong bg-surface-raised">
      <button type="button" aria-label="One less" disabled={value <= 1} onClick={() => clamp(value - 1)} className="grid size-11 place-items-center rounded-l-lg text-text-secondary hover:bg-surface-sunken disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400">
        <Minus className="size-4" aria-hidden />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        aria-label={label}
        value={value}
        onChange={(event) => onChange(Math.max(1, Number(event.target.value) || 1))}
        className="h-11 w-16 border-x border-border-strong bg-transparent text-center text-[15px] font-semibold tabular-nums text-text-primary outline-none focus:bg-brand-50"
      />
      <button type="button" aria-label="One more" disabled={max !== undefined && value >= max} onClick={() => clamp(value + 1)} className="grid size-11 place-items-center rounded-r-lg text-text-secondary hover:bg-surface-sunken disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400">
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  );
}

function DosageField({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[12.5px] font-medium text-text-secondary">
        How it is taken
      </label>
      <input id={id} value={value} onChange={(event) => onChange(event.target.value)} placeholder="e.g. 1 three times daily" className={FIELD_CLASS} />
      <div className="flex flex-wrap gap-1.5">
        {DOSAGE_PRESETS.map((preset) => (
          <button key={preset} type="button" onClick={() => onChange(preset)} className="min-h-8 rounded-full border border-border-subtle bg-surface-sunken px-2.5 text-[12px] text-text-secondary hover:border-brand-300 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400">
            {preset}
          </button>
        ))}
      </div>
    </div>
  );
}

function StockLineCard({ draft, line, onChange }: { draft: PrescriptionDraft; line: StockLine; onChange: (draft: PrescriptionDraft) => void }) {
  const max = maxQuantityFor(draft, line);
  const shortfall = shortfallOf(draft, line);
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border-subtle bg-surface-raised p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[15px] font-semibold text-text-primary">{line.name}</p>
          <div className="mt-1">
            <StockBadge level={line.level} available={line.available} />
          </div>
        </div>
        <button type="button" aria-label={`Remove ${line.name}`} onClick={() => onChange(removeStockLine(draft, line.key))} className="grid size-11 place-items-center rounded-lg text-text-secondary hover:bg-danger-50 hover:text-danger-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400">
          <Trash2 className="size-4" aria-hidden />
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <DosageField id={`dosage-${line.key}`} value={line.dosage} onChange={(dosage) => onChange(updateStockLine(draft, line.key, { dosage }))} />
        <div className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-medium text-text-secondary">Quantity</span>
          <QuantityStepper label={`Quantity of ${line.name}`} value={line.quantity} max={max} onChange={(quantity) => onChange(updateStockLine(draft, line.key, { quantity }))} />
          <span className="text-[12px] text-text-secondary">Up to {max} available</span>
        </div>
      </div>
      {shortfall > 0 && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-amber-50 px-3.5 py-2.5 text-[13.5px] text-amber-600">
          <span>
            The pharmacy holds {max}, you asked for {line.quantity}.
          </span>
          <Button variant="secondary" icon={<Split className="size-4" aria-hidden />} onClick={() => onChange(splitShortfall(draft, line.key))}>
            Take {max}, patient buys {shortfall}
          </Button>
        </div>
      )}
    </li>
  );
}

function BuyLineCard({ draft, line, onChange }: { draft: PrescriptionDraft; line: BuyLine; onChange: (draft: PrescriptionDraft) => void }) {
  const fromList = line.productId !== null;
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-dashed border-border-strong bg-surface-sunken p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {fromList ? (
            <p className="text-[15px] font-semibold text-text-primary">{line.name}</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`name-${line.key}`} className="text-[12.5px] font-medium text-text-secondary">
                Medicine
              </label>
              <input id={`name-${line.key}`} value={line.name} onChange={(event) => onChange(updateBuyLine(draft, line.key, { name: event.target.value }))} placeholder="Medicine name and strength" className={FIELD_CLASS} />
            </div>
          )}
          <p className="mt-1 inline-flex items-center gap-1.5 text-[12.5px] text-text-secondary">
            <ShoppingBag className="size-3.5" aria-hidden />
            {fromList ? "Out of stock or short at the pharmacy. The patient buys it." : "Not from the pharmacy's stock. The patient buys it."}
          </p>
        </div>
        <button type="button" aria-label={`Remove ${line.name || "medicine"}`} onClick={() => onChange(removeBuyLine(draft, line.key))} className="grid size-11 place-items-center rounded-lg text-text-secondary hover:bg-danger-50 hover:text-danger-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400">
          <Trash2 className="size-4" aria-hidden />
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <DosageField id={`buy-dosage-${line.key}`} value={line.dosage} onChange={(dosage) => onChange(updateBuyLine(draft, line.key, { dosage }))} />
        <div className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-medium text-text-secondary">Quantity</span>
          <QuantityStepper label={`Quantity of ${line.name || "medicine"} to buy`} value={line.quantity} onChange={(quantity) => onChange(updateBuyLine(draft, line.key, { quantity }))} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`note-${line.key}`} className="text-[12.5px] font-medium text-text-secondary">
          Note for the patient (optional)
        </label>
        <input id={`note-${line.key}`} value={line.note} maxLength={300} onChange={(event) => onChange(updateBuyLine(draft, line.key, { note: event.target.value }))} className={FIELD_CLASS} />
      </div>
    </li>
  );
}

// The doctor's prescribing workspace: search what the pharmacy really holds,
// add it with a quantity the shelf can cover, and put anything that is out or
// short on the "patient buys" list. The prescription prints and reaches the
// pharmacist exactly as it is built here.
export function PrescriptionBuilder({ draft, onChange }: PrescriptionBuilderProps) {
  const [pharmacyName, setPharmacyName] = useState("");
  const problems = draftProblems(draft);
  const pickedProductIds = new Set([...draft.stockLines.map((line) => line.productId), ...draft.buyLines.flatMap((line) => (line.productId ? [line.productId] : []))]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="inline-flex items-center gap-2 text-[13.5px] text-text-secondary">
          <Pill className="size-4 text-brand-500" aria-hidden />
          {pharmacyName ? `Stock is checked live at ${pharmacyName}.` : "Stock is checked live at the pharmacy."}
        </p>
        <p className="text-[13px] font-medium text-text-primary" aria-live="polite">
          {draft.stockLines.length} from the pharmacy · {draft.buyLines.length} to buy
        </p>
      </div>

      <MedicinePicker
        pickedProductIds={pickedProductIds}
        onPharmacyKnown={setPharmacyName}
        onPickFromStock={(medicine) => onChange(addStockLine(draft, medicine))}
        onPickToBuy={(medicine, typedName) =>
          onChange(addBuyLine(draft, { productId: medicine?.productId ?? null, name: medicine?.name ?? typedName }))
        }
        onPickAlternative={(alternative) => onChange(addStockLine(draft, { ...alternative, level: "IN_STOCK" }))}
      />

      {draft.stockLines.length > 0 && (
        <section aria-labelledby="rx-from-pharmacy" className="flex flex-col gap-3">
          <h3 id="rx-from-pharmacy" className="text-[14.5px] font-semibold text-text-primary">
            From the pharmacy
          </h3>
          <ul className="flex flex-col gap-3">
            {draft.stockLines.map((line) => (
              <StockLineCard key={line.key} draft={draft} line={line} onChange={onChange} />
            ))}
          </ul>
        </section>
      )}

      {draft.buyLines.length > 0 && (
        <section aria-labelledby="rx-to-buy" className="flex flex-col gap-3">
          <h3 id="rx-to-buy" className="text-[14.5px] font-semibold text-text-primary">
            For the patient to buy
          </h3>
          <ul className="flex flex-col gap-3">
            {draft.buyLines.map((line) => (
              <BuyLineCard key={line.key} draft={draft} line={line} onChange={onChange} />
            ))}
          </ul>
        </section>
      )}

      {problems.length > 0 && draft.stockLines.length + draft.buyLines.length > 0 && (
        <ul role="status" className="flex flex-col gap-1 rounded-lg bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-600">
          {problems.map((problem) => (
            <li key={problem} className="flex items-center gap-2">
              <TriangleAlert className="size-3.5 shrink-0" aria-hidden /> {problem}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
