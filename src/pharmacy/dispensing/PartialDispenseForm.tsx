import { useState } from "react";
import type { DispenseLot, PrescriptionItem } from "@/shared/api/pharmacy";
import { QuantityInput } from "../components/QuantityInput";
import { InlinePanel } from "./InlinePanel";

interface PartialDispenseFormProps {
  item: PrescriptionItem;
  lot: DispenseLot;
  loading: boolean;
  onConfirm: (quantity: number) => void;
  onCancel: () => void;
}

// For when the shelf holds less than the script asks for, or the patient only
// wants part now. The remainder stays owed on the item.
export function PartialDispenseForm({ item, lot, loading, onConfirm, onCancel }: PartialDispenseFormProps) {
  const max = Math.min(lot.available, item.remainingQuantity);
  const [quantity, setQuantity] = useState(max);

  const valid = quantity >= 1 && quantity <= max;
  const outcome =
    quantity >= item.remainingQuantity
      ? "This completes the item."
      : `${item.remainingQuantity - quantity} will stay owed.`;

  return (
    <InlinePanel
      title="Dispense part"
      confirmLabel={valid ? `Dispense ${quantity} now` : "Dispense now"}
      confirmDisabled={!valid}
      loading={loading}
      onConfirm={() => onConfirm(quantity)}
      onCancel={onCancel}
    >
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-text-primary">Quantity to dispense now (max {max})</span>
        <QuantityInput label="Quantity to dispense now" value={quantity} min={0} max={max} onChange={setQuantity} />
        <p className="text-[13px] text-text-secondary" role="status">
          In lot {lot.lot}: {lot.available}. Still to give: {item.remainingQuantity}.{" "}
          {valid ? outcome : `Enter a whole number from 1 to ${max}.`}
        </p>
      </div>
    </InlinePanel>
  );
}
