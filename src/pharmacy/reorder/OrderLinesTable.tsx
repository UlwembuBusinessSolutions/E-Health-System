import { Trash2 } from "lucide-react";
import type { ReorderLine, ReorderStatus } from "@/shared/api/pharmacyPlanning";
import { EmptyState } from "../components/EmptyState";
import { QuantityInput } from "../components/QuantityInput";
import { ResponsiveTable, type TableColumn } from "../components/ResponsiveTable";
import { StockStatusPill, type StockStatus } from "../components/StockStatusPill";
import { isWholePacks, packNote, packSizeOf, quantityFor, type QuantityOverrides } from "./packMath";

const PILL_STATUS: Record<ReorderStatus, StockStatus> = { OUT: "OUT", LOW: "LOW", OK: "IN_STOCK" };

interface OrderLinesTableProps {
  supplierName: string;
  lines: ReorderLine[];
  overrides: QuantityOverrides;
  onQuantityChange: (line: ReorderLine, quantity: number) => void;
  onRemove: (line: ReorderLine) => void;
}

export function OrderLinesTable({ supplierName, lines, overrides, onQuantityChange, onRemove }: OrderLinesTableProps) {
  const columns: TableColumn<ReorderLine>[] = [
    {
      key: "product",
      header: "Product",
      role: "primary",
      cell: (line) => (
        <div>
          <p className="font-medium text-text-primary">{line.name}</p>
          <p className="text-[12.5px] text-text-secondary">
            {[line.sub, line.packSize ? `pack of ${line.packSize}` : null].filter(Boolean).join(" · ")}
          </p>
        </div>
      ),
    },
    { key: "onHand", header: "On hand", align: "right", cell: (line) => <span className="tabular-nums">{line.onHand}</span> },
    {
      key: "reorderAt",
      header: "Reorder at",
      align: "right",
      cell: (line) => <span className="tabular-nums">{line.reorderThreshold ?? "—"}</span>,
    },
    { key: "status", header: "Status", role: "secondary", cell: (line) => <StockStatusPill status={PILL_STATUS[line.status]} /> },
    {
      key: "quantity",
      header: "How many to order",
      cell: (line) => {
        const quantity = quantityFor(line, overrides);
        const packSize = packSizeOf(line);
        return (
          <div className="flex flex-col items-end gap-1 md:items-start">
            <QuantityInput
              label={`Quantity of ${line.name} ${line.sub} to order`}
              value={quantity}
              step={packSize}
              onChange={(next) => onQuantityChange(line, next)}
            />
            <span className={isWholePacks(quantity, packSize) ? "text-[12.5px] text-text-secondary" : "text-[12.5px] font-medium text-amber-600"}>
              {packNote(quantity, packSize)}
            </span>
          </div>
        );
      },
    },
    {
      key: "remove",
      header: "",
      cell: (line) => (
        <button
          type="button"
          aria-label={`Remove ${line.name} from ${supplierName}'s list`}
          onClick={() => onRemove(line)}
          className="grid size-11 place-items-center rounded-lg text-text-secondary hover:bg-danger-50 hover:text-danger-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      ),
    },
  ];

  return (
    <ResponsiveTable
      label={`Order list for ${supplierName}`}
      columns={columns}
      rows={lines}
      getRowKey={(line) => line.productId}
      empty={
        <EmptyState
          title={`No products on ${supplierName}'s list yet.`}
          description="Search above to add the products you buy from them."
        />
      }
    />
  );
}
