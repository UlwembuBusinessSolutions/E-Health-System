import { useId } from "react";
import clsx from "clsx";
import { Snowflake, TriangleAlert } from "lucide-react";
import { Input } from "@/shared/components/Input";
import type { ReceiptLineDraft } from "./receiptTypes";
import { COLD_CHAIN_MAX_C, COLD_CHAIN_MIN_C, coldChainProblem } from "./receiptValidation";

interface ColdChainFieldsProps {
  line: ReceiptLineDraft;
  onChange: (patch: Partial<ReceiptLineDraft>) => void;
}

const BOX_OPTIONS = [
  { value: true, label: "Intact" },
  { value: false, label: "Not intact" },
] as const;

export function ColdChainFields({ line, onChange }: ColdChainFieldsProps) {
  const groupName = useId();
  const problem = coldChainProblem(line);

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-brand-50 p-3.5">
      <p className="flex items-center gap-2 text-[13px] font-medium text-brand-700">
        <Snowflake className="size-4" aria-hidden />
        Cold chain: must arrive between {COLD_CHAIN_MIN_C} and {COLD_CHAIN_MAX_C} °C
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          label="Temperature on arrival (°C)"
          required
          type="number"
          step="0.1"
          inputMode="decimal"
          placeholder={`Safe range ${COLD_CHAIN_MIN_C} to ${COLD_CHAIN_MAX_C}`}
          value={line.temperature}
          onChange={(event) => onChange({ temperature: event.target.value })}
        />
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-[13px] font-medium text-text-primary">
            Cold box <span className="text-danger-500">*</span>
          </legend>
          <div className="flex gap-2">
            {BOX_OPTIONS.map((option) => (
              <label
                key={option.label}
                className={clsx(
                  "flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-lg border px-3 text-[14px] font-medium",
                  "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-400",
                  line.coldBoxIntact === option.value
                    ? "border-brand-500 bg-surface-raised text-brand-700"
                    : "border-border-strong bg-surface-raised text-text-secondary hover:text-text-primary",
                )}
              >
                <input
                  type="radio"
                  name={groupName}
                  checked={line.coldBoxIntact === option.value}
                  onChange={() => onChange({ coldBoxIntact: option.value })}
                  className="sr-only"
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      {problem && (
        <p role="alert" className="flex items-start gap-2 text-[13.5px] text-amber-600">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{problem} Flag this line below so the supplier is told and unsafe units are not stocked.</span>
        </p>
      )}
    </div>
  );
}
