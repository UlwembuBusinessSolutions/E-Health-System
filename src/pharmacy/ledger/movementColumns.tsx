import type { ReactNode } from "react";
import clsx from "clsx";
import { Undo2 } from "lucide-react";
import type { TableColumn } from "@/pharmacy/components/ResponsiveTable";
import { formatDateTime } from "@/pharmacy/lib/format";
import { Button } from "@/shared/components/Button";
import type { LedgerMovement } from "@/shared/api/pharmacyLedger";
import {
  canReverse,
  counterpartyOf,
  eventKindOf,
  isReversed,
  isStockUsed,
  referenceOf,
  signedChange,
} from "./lib/movementEvents";
import { MovementEventPill } from "./MovementEventPill";

// A reversed row stays visible but struck through: the ledger is a history, so
// the original entry is never hidden, only marked as cancelled.
function Cell({ row, children, className }: { row: LedgerMovement; children: ReactNode; className?: string }) {
  return <span className={clsx(className, isReversed(row) && "text-text-secondary line-through")}>{children}</span>;
}

function ActionCell({ row, onReverse }: { row: LedgerMovement; onReverse: (movement: LedgerMovement) => void }) {
  if (canReverse(row)) {
    return (
      <Button
        variant="secondary"
        icon={<Undo2 className="size-4" aria-hidden />}
        aria-label={`Reverse receipt of ${row.productName}`}
        onClick={() => onReverse(row)}
      >
        Reverse
      </Button>
    );
  }
  return isStockUsed(row) ? <span className="text-[12.5px] text-text-secondary">Stock already used</span> : null;
}

export function movementColumns(onReverse: (movement: LedgerMovement) => void): TableColumn<LedgerMovement>[] {
  return [
    {
      key: "product",
      header: "Product",
      role: "primary",
      cell: (row) => (
        <Cell row={row} className="font-medium text-text-primary">
          {row.productName}
        </Cell>
      ),
    },
    {
      key: "event",
      header: "Event",
      role: "secondary",
      cell: (row) => (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <MovementEventPill kind={eventKindOf(row.type)} />
          {isReversed(row) && (
            <span className="rounded-full border border-border-strong px-2 py-0.5 text-[12px] text-text-secondary">
              Reversed
            </span>
          )}
        </span>
      ),
    },
    { key: "date", header: "Date", cell: (row) => <Cell row={row}>{formatDateTime(row.createdAt)}</Cell> },
    {
      key: "detail",
      header: "With",
      cell: (row) => (
        <Cell row={row}>
          {counterpartyOf(row) ?? "—"}
          {referenceOf(row) && <span className="block text-[12.5px] text-text-secondary">{referenceOf(row)}</span>}
        </Cell>
      ),
    },
    { key: "lot", header: "Lot", cell: (row) => <Cell row={row}>{row.lotNumber ?? "—"}</Cell> },
    {
      key: "change",
      header: "Change",
      align: "right",
      cell: (row) => (
        <Cell
          row={row}
          className={clsx("font-semibold tabular-nums", row.quantityDelta < 0 ? "text-danger-600" : "text-success-600")}
        >
          {signedChange(row.quantityDelta)}
        </Cell>
      ),
    },
    {
      key: "balance",
      header: "Balance",
      align: "right",
      cell: (row) => (
        <Cell row={row} className="tabular-nums">
          {row.balanceAfter.toLocaleString("en-ZA")}
        </Cell>
      ),
    },
    { key: "by", header: "By", cell: (row) => <Cell row={row}>{row.actorName}</Cell> },
    { key: "action", header: "Action", cell: (row) => <ActionCell row={row} onReverse={onReverse} /> },
  ];
}
