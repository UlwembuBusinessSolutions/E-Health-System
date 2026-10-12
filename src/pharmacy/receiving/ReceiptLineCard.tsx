import { Trash2 } from "lucide-react";
import { Card } from "@/shared/components/Card";
import { Input } from "@/shared/components/Input";
import { QuantityInput } from "@/pharmacy/components/QuantityInput";
import { formatQuantity, unitLabel } from "@/pharmacy/lib/units";
import { ColdChainFields } from "./ColdChainFields";
import { FlagLineControl } from "./FlagLineControl";
import type { ReceiptLineDraft } from "./receiptTypes";
import { SerialEntry } from "./SerialEntry";
import {
  isoToday,
  receivedQuantity,
  trackingModeOf,
  unitsPerPack,
  type LineIssues,
} from "./receiptValidation";

interface ReceiptLineCardProps {
  line: ReceiptLineDraft;
  issues: LineIssues;
  onChange: (patch: Partial<ReceiptLineDraft>) => void;
  onRemove: () => void;
}

const TRACKING_LABELS = { LOT: "Lot + expiry", SERIAL: "Serial number", QUANTITY: "Quantity only" } as const;

// Stacks vertically on phones and spreads into a grid from `sm` up.
export function ReceiptLineCard({ line, issues, onChange, onRemove }: ReceiptLineCardProps) {
  const { product } = line;
  const mode = trackingModeOf(product);
  const pending = Object.values(issues);

  return (
    <Card role="group" className="flex flex-col gap-4 p-4 sm:p-5" aria-label={`Line: ${product.displayName}`}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-text-primary">{product.displayName}</h3>
          <p className="text-[13px] text-text-secondary">
            {[product.strength, product.dosageForm].filter(Boolean).join(" ")}
            {" · "}
            <span className="font-mono text-[12px]">{product.code}</span>
            {" · "}
            {TRACKING_LABELS[mode]}
          </p>
        </div>
        <div className="flex shrink-0 items-start gap-1">
          <p className="pt-2 text-right text-[13px] text-text-secondary">
            Total
            <span className="block text-[16px] font-semibold tabular-nums text-text-primary">
              {formatQuantity(receivedQuantity(line), product.baseUnit)}
            </span>
          </p>
          <button
            type="button"
            aria-label={`Remove line ${product.displayName}`}
            onClick={onRemove}
            className="grid size-11 place-items-center rounded-lg text-danger-600 hover:bg-danger-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>
      </header>

      {mode === "SERIAL" ? (
        <SerialEntry serials={line.serials} onChange={(serials) => onChange({ serials })} />
      ) : (
        <ReceivedAmountFields line={line} onChange={onChange} showLotFields={mode === "LOT"} />
      )}

      {product.coldChain && <ColdChainFields line={line} onChange={onChange} />}

      <FlagLineControl line={line} onChange={onChange} />

      {pending.length > 0 && (
        <p className="text-[13px] text-amber-600">
          <span className="font-semibold">Still needed:</span> {pending.join(". ")}.
        </p>
      )}
    </Card>
  );
}

interface ReceivedAmountFieldsProps {
  line: ReceiptLineDraft;
  showLotFields: boolean;
  onChange: (patch: Partial<ReceiptLineDraft>) => void;
}

function ReceivedAmountFields({ line, showLotFields, onChange }: ReceivedAmountFieldsProps) {
  const { product } = line;
  const perPack = unitsPerPack(product);
  const quantityLabel = perPack > 1 ? "Packs received" : "Quantity received";

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-text-primary">
          {quantityLabel}
          {perPack > 1 && (
            <span className="font-normal text-text-secondary">
              {" "}
              ({perPack} {unitLabel(product.baseUnit, perPack)} per pack)
            </span>
          )}
        </span>
        <QuantityInput
          label={quantityLabel}
          min={1}
          value={line.packs}
          onChange={(packs) => onChange({ packs })}
          className="self-start"
        />
      </div>

      {showLotFields && (
        <>
          <Input
            label="Lot / batch number"
            required={product.batchTracked}
            autoComplete="off"
            maxLength={100}
            placeholder="Printed on the box"
            value={line.lotNumber}
            onChange={(event) => onChange({ lotNumber: event.target.value })}
          />
          {product.expiryTracked && (
            <Input
              label="Expiry date"
              required
              type="date"
              min={isoToday()}
              value={line.expiryDate}
              onChange={(event) => onChange({ expiryDate: event.target.value })}
            />
          )}
        </>
      )}
    </div>
  );
}
