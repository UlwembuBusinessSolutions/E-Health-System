import clsx from "clsx";
import { CircleCheck, CircleDashed, Undo2, type LucideIcon } from "lucide-react";
import type { ReceiptLineState, ReceiptSummary } from "@/shared/api/pharmacyLedger";

const STATE: Record<ReceiptLineState, { label: string; icon: LucideIcon; classes: string }> = {
  ON_SHELF: { label: "On shelf", icon: CircleCheck, classes: "bg-success-50 text-success-600" },
  PARTLY_USED: { label: "Partly used", icon: CircleDashed, classes: "bg-amber-50 text-amber-600" },
  REVERSED: { label: "Reversed", icon: Undo2, classes: "bg-surface-sunken text-text-secondary" },
};

/**
 * Where a whole receipt stands, in the same words as its lines. The server only
 * says POSTED or REVERSED and flags separately whether any stock was used.
 */
export function receiptStanding(receipt: Pick<ReceiptSummary, "status" | "usedStock">): ReceiptLineState {
  if (receipt.status === "REVERSED") return "REVERSED";
  return receipt.usedStock ? "PARTLY_USED" : "ON_SHELF";
}

export function receiptStateLabel(state: ReceiptLineState): string {
  return STATE[state].label;
}

// Used for both a whole receipt and each of its lines - they share one vocabulary.
export function ReceiptStatusPill({ state }: { state: ReceiptLineState }) {
  const { label, icon: Icon, classes } = STATE[state];
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[12.5px] font-semibold",
        classes,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {label}
    </span>
  );
}
