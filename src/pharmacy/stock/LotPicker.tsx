import clsx from "clsx";
import type { BatchRow } from "@/shared/api/pharmacyStock";
import { ExpiryText } from "../components/ExpiryText";
import { formatQuantity } from "../lib/units";

interface LotPickerProps {
  lots: BatchRow[];
  baseUnit: string;
  selectedBatchId: string | null;
  onChange: (batchId: string) => void;
}

// Buttons with aria-pressed rather than radios: lots are few, each needs room
// for lot number, expiry and balance, and a button is a comfortable 44 px target.
export function LotPicker({ lots, baseUnit, selectedBatchId, onChange }: LotPickerProps) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-[13px] font-medium text-text-primary">Which lot?</legend>
      {lots.map((lot) => {
        const selected = lot.batchId === selectedBatchId;
        return (
          <button
            key={lot.batchId}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(lot.batchId)}
            className={clsx(
              "flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg border px-3.5 py-2.5 text-left",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
              selected ? "border-brand-500 bg-brand-50" : "border-border-strong bg-surface-raised hover:bg-surface-sunken",
            )}
          >
            <span className="font-mono text-[14px] font-semibold text-text-primary">{lot.lotNumber}</span>
            <span className="text-[13px] text-text-secondary">
              {formatQuantity(lot.quantity, baseUnit)} on hand · <ExpiryText date={lot.expiryDate} />
            </span>
          </button>
        );
      })}
    </fieldset>
  );
}
