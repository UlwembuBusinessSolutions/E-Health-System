import clsx from "clsx";
import { ChevronRight } from "lucide-react";
import type { StockRow } from "@/shared/api/pharmacyStock";
import { Button } from "@/shared/components/Button";
import { ExpiryText } from "../components/ExpiryText";
import type { TableColumn } from "../components/ResponsiveTable";
import { StockStatusPill, type StockStatus } from "../components/StockStatusPill";
import { formatQuantity } from "../lib/units";

/** The pill shows the most pressing state; expiry has its own column. */
function pillStatus(row: StockRow): StockStatus {
  if (row.archived) return "ARCHIVED";
  if (row.available === 0) return "OUT";
  if (row.status === "Low stock") return "LOW";
  return "IN_STOCK";
}

interface StockColumnHandlers {
  expandedProductId: string | null;
  onToggleExpanded: (productId: string) => void;
  onAdjust: (row: StockRow) => void;
}

export function buildStockColumns({ expandedProductId, onToggleExpanded, onAdjust }: StockColumnHandlers): TableColumn<StockRow>[] {
  return [
    {
      key: "product",
      header: "Product",
      role: "primary",
      cell: (row) => {
        const expanded = row.productId === expandedProductId;
        return (
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={`${row.displayName}, show lots and history`}
            onClick={() => onToggleExpanded(row.productId)}
            className="-ml-2 flex min-h-11 items-center gap-2 rounded-lg px-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            <ChevronRight
              className={clsx("size-4 shrink-0 text-text-secondary transition-transform duration-150 motion-reduce:transition-none", expanded && "rotate-90")}
              aria-hidden
            />
            <span className="min-w-0">
              <span className="block font-medium text-text-primary">{row.displayName}</span>
              <span className="block font-mono text-[12px] text-text-secondary">
                {row.code}
                {row.serialTracked && " · serial numbers"}
                {row.schedule && ` · ${row.schedule}`}
              </span>
            </span>
          </button>
        );
      },
    },
    {
      key: "onHand",
      header: "On hand",
      align: "right",
      cell: (row) => <span className="font-semibold tabular-nums text-text-primary">{formatQuantity(row.available, row.baseUnit)}</span>,
    },
    {
      key: "reorder",
      header: "Reorder at",
      align: "right",
      cell: (row) => <span className="tabular-nums text-text-secondary">{row.reorderThreshold ?? "—"}</span>,
    },
    { key: "expiry", header: "Next expiry", cell: (row) => <ExpiryText date={row.nextExpiry} /> },
    { key: "status", header: "Status", role: "secondary", cell: (row) => <StockStatusPill status={pillStatus(row)} /> },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      cell: (row) => (
        <Button variant="secondary" disabled={row.archived} aria-label={`Adjust stock of ${row.displayName}`} onClick={() => onAdjust(row)}>
          Adjust
        </Button>
      ),
    },
  ];
}
