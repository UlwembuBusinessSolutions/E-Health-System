import { useState } from "react";
import type { ReturnCondition, ReturnItemPayload } from "@/shared/api/pharmacy";
import { FilterChips, type FilterChipOption } from "../components/FilterChips";
import { QuantityInput } from "../components/QuantityInput";
import { InlinePanel } from "./InlinePanel";
import { TextAreaField } from "./TextAreaField";

interface RecordReturnFormProps {
  patientName: string;
  maxQuantity: number;
  loading: boolean;
  onConfirm: (payload: ReturnItemPayload) => void;
  onCancel: () => void;
}

const CONDITIONS: FilterChipOption<ReturnCondition>[] = [
  { value: "UNOPENED", label: "Unopened" },
  { value: "DAMAGED", label: "Damaged" },
  { value: "WRONG_ITEM", label: "Wrong item" },
];

// Tells the pharmacist what the choice will do before they commit to it.
const OUTCOMES: Record<ReturnCondition, string> = {
  UNOPENED: "Goes back on the shelf in its original lot.",
  DAMAGED: "Recorded as waste. It does not return to stock.",
  WRONG_ITEM: "Goes back on the shelf after you check it.",
};

export function RecordReturnForm({ patientName, maxQuantity, loading, onConfirm, onCancel }: RecordReturnFormProps) {
  const [quantity, setQuantity] = useState(maxQuantity);
  const [condition, setCondition] = useState<ReturnCondition | null>(null);
  const [reason, setReason] = useState("");

  const valid = quantity >= 1 && quantity <= maxQuantity && condition !== null && reason.trim() !== "";

  return (
    <InlinePanel
      title="Record a return"
      confirmLabel="Confirm return"
      confirmDisabled={!valid}
      loading={loading}
      onConfirm={() => condition && onConfirm({ quantity, condition, reason: reason.trim() })}
      onCancel={onCancel}
    >
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-text-primary">Quantity returned (max {maxQuantity})</span>
        <QuantityInput label="Quantity returned" value={quantity} min={0} max={maxQuantity} onChange={setQuantity} />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-text-primary">Condition of the returned pack</span>
        <FilterChips label="Condition of the returned pack" options={CONDITIONS} value={condition} onChange={setCondition} />
        <p className="text-[13px] text-text-secondary" role="status">
          {condition ? `Outcome: ${OUTCOMES[condition]}` : "Choose the condition of the returned pack."}
        </p>
      </div>
      <TextAreaField
        label="Reason"
        required
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        hint={`Logged to ${patientName}'s record.`}
      />
    </InlinePanel>
  );
}
