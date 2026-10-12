import { useId } from "react";
import clsx from "clsx";
import { Flag } from "lucide-react";
import { Input } from "@/shared/components/Input";
import { Button } from "@/shared/components/Button";
import { QuantityInput } from "@/pharmacy/components/QuantityInput";
import { unitLabel } from "@/pharmacy/lib/units";
import { FLAG_REASONS, FLAG_REASON_LABELS, type LineFlagDraft, type ReceiptLineDraft } from "./receiptTypes";
import { acceptedQuantity, receivedQuantity, trackingModeOf } from "./receiptValidation";

interface FlagLineControlProps {
  line: ReceiptLineDraft;
  onChange: (patch: Partial<ReceiptLineDraft>) => void;
}

export function FlagLineControl({ line, onChange }: FlagLineControlProps) {
  const { flag } = line;
  const received = receivedQuantity(line);

  if (!flag) {
    return (
      <div>
        <Button
          variant="ghost"
          icon={<Flag className="size-4" aria-hidden />}
          // Starting with everything accepted means flagging never silently throws stock away.
          onClick={() => onChange({ flag: { reason: null, note: "", acceptedQuantity: received } })}
        >
          Flag a problem
        </Button>
      </div>
    );
  }

  function updateFlag(patch: Partial<LineFlagDraft>) {
    if (flag) onChange({ flag: { ...flag, ...patch } });
  }

  const rejected = received - acceptedQuantity(line);
  const isSerial = trackingModeOf(line.product) === "SERIAL";

  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border border-amber-500/40 bg-amber-50 p-3.5">
      <legend className="flex items-center gap-2 px-1 text-[13px] font-semibold text-amber-600">
        <Flag className="size-4" aria-hidden />
        Problem with this line
      </legend>

      <ReasonChips value={flag.reason} onChange={(reason) => updateFlag({ reason })} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[auto_1fr] sm:items-start">
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-text-primary">
            Accepted {unitLabel(line.product.baseUnit, 2)} (0 to {received})
          </span>
          <QuantityInput
            label="Accepted quantity"
            min={0}
            max={received}
            value={acceptedQuantity(line)}
            onChange={(value) => updateFlag({ acceptedQuantity: value })}
          />
        </div>
        <Input
          label="Note for the supplier"
          required
          maxLength={500}
          placeholder="What is wrong?"
          value={flag.note}
          onChange={(event) => updateFlag({ note: event.target.value })}
        />
      </div>

      <p className="text-[13px] text-text-secondary">
        {rejected > 0
          ? `${rejected} ${unitLabel(line.product.baseUnit, rejected)} will not be added to stock.`
          : "Everything on this line will be added to stock."}
        {isSerial && rejected > 0 && " The first serial numbers in the list are the ones stocked."}
      </p>

      <div>
        <Button variant="ghost" onClick={() => onChange({ flag: null })}>
          Remove flag
        </Button>
      </div>
    </fieldset>
  );
}

interface ReasonChipsProps {
  value: LineFlagDraft["reason"];
  onChange: (reason: NonNullable<LineFlagDraft["reason"]>) => void;
}

// Real radios (visually hidden) so arrow keys and screen readers work natively.
function ReasonChips({ value, onChange }: ReasonChipsProps) {
  const groupName = useId();
  return (
    <div role="radiogroup" aria-label="What is wrong?" className="flex flex-wrap gap-2">
      {FLAG_REASONS.map((reason) => (
        <label
          key={reason}
          className={clsx(
            "inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-[13.5px] font-medium",
            "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-400",
            value === reason
              ? "border-amber-500 bg-surface-raised text-amber-600"
              : "border-border-strong bg-surface-raised text-text-secondary hover:text-text-primary",
          )}
        >
          <input
            type="radio"
            name={groupName}
            checked={value === reason}
            onChange={() => onChange(reason)}
            className="sr-only"
          />
          {FLAG_REASON_LABELS[reason]}
        </label>
      ))}
    </div>
  );
}
