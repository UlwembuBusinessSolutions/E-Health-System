import clsx from "clsx";
import { CircleCheck, CircleDashed, Undo2, type LucideIcon } from "lucide-react";
import type { ReceiptStatus } from "@/shared/api/pharmacyLedger";

const STATUS: Record<ReceiptStatus, { label: string; icon: LucideIcon; classes: string }> = {
  ON_SHELF: { label: "On shelf", icon: CircleCheck, classes: "bg-success-50 text-success-600" },
  PARTLY_USED: { label: "Partly used", icon: CircleDashed, classes: "bg-amber-50 text-amber-600" },
  REVERSED: { label: "Reversed", icon: Undo2, classes: "bg-surface-sunken text-text-secondary" },
};

export function receiptStatusLabel(status: ReceiptStatus): string {
  return STATUS[status].label;
}

// Used for both a whole receipt and each of its lines - they share one vocabulary.
export function ReceiptStatusPill({ status }: { status: ReceiptStatus }) {
  const { label, icon: Icon, classes } = STATUS[status];
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
