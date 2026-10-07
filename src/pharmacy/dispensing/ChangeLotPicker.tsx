import { useId } from "react";
import clsx from "clsx";
import type { DispenseLot } from "@/shared/api/pharmacy";
import { ExpiryText } from "../components/ExpiryText";

interface ChangeLotPickerProps {
  usableLots: DispenseLot[];
  expiredLots: DispenseLot[];
  /** Batch the stock will come from now (the suggestion unless overridden). */
  selectedBatchId: string | null;
  onSelect: (batchId: string) => void;
}

interface LotOptionProps {
  lot: DispenseLot;
  name: string;
  checked: boolean;
  expired: boolean;
  onSelect: () => void;
}

function LotOption({ lot, name, checked, expired, onSelect }: LotOptionProps) {
  const unavailable = expired || lot.available < 1;
  return (
    <label
      className={clsx(
        "flex min-h-11 flex-wrap items-center gap-x-3 gap-y-0.5 rounded-lg border px-3.5 py-2 text-[14px]",
        "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-400",
        checked ? "border-brand-500 bg-brand-50" : "border-border-strong bg-surface-raised",
        unavailable ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-surface-sunken",
      )}
    >
      <input
        type="radio"
        name={name}
        className="sr-only"
        checked={checked}
        disabled={unavailable}
        onChange={onSelect}
      />
      <span className="font-medium text-text-primary">Lot {lot.lot}</span>
      <ExpiryText date={lot.expiryDate} className="text-[13px]" />
      <span className="text-[13px] text-text-secondary">{lot.available} in lot</span>
      {expired && <span className="text-[12.5px] font-medium text-danger-600">Expired, can't be dispensed</span>}
    </label>
  );
}

// Expired lots are listed (so the pharmacist can see why they were skipped)
// but cannot be chosen. The ledger records whichever lot is picked, so this
// is only for when the pack in hand is not the suggested one.
export function ChangeLotPicker({ usableLots, expiredLots, selectedBatchId, onSelect }: ChangeLotPickerProps) {
  const name = useId();
  return (
    <fieldset className="mt-3 flex flex-col gap-2">
      <legend className="mb-1 text-[13px] text-text-secondary">
        Pick a different lot only if the pack in your hand is not the suggested one.
      </legend>
      {usableLots.map((lot) => (
        <LotOption
          key={lot.batchId}
          lot={lot}
          name={name}
          expired={false}
          checked={lot.batchId === selectedBatchId}
          onSelect={() => onSelect(lot.batchId)}
        />
      ))}
      {expiredLots.map((lot) => (
        <LotOption key={lot.batchId} lot={lot} name={name} expired checked={false} onSelect={() => undefined} />
      ))}
    </fieldset>
  );
}
