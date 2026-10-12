import { ChevronDown, ChevronRight } from "lucide-react";
import type { TableColumn } from "@/pharmacy/components/ResponsiveTable";
import { formatDate, pluralise } from "@/pharmacy/lib/format";
import type { ReceiptSummary } from "@/shared/api/pharmacyLedger";
import { ReceiptStatusPill, receiptStanding } from "./ReceiptStatusPill";

interface ReceiptColumnOptions {
  isExpanded: (receiptId: string) => boolean;
  onToggle: (receiptId: string) => void;
}

export function receiptColumns({ isExpanded, onToggle }: ReceiptColumnOptions): TableColumn<ReceiptSummary>[] {
  return [
    {
      key: "date",
      header: "Date",
      role: "primary",
      cell: (row) => {
        const expanded = isExpanded(row.id);
        const Chevron = expanded ? ChevronDown : ChevronRight;
        return (
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={`${expanded ? "Hide" : "Show"} lines of receipt ${row.receiptNumber}`}
            onClick={() => onToggle(row.id)}
            className="-ml-2 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 font-medium text-text-primary hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            <Chevron className="size-4 text-text-secondary" aria-hidden />
            {formatDate(row.receivedAt)}
          </button>
        );
      },
    },
    { key: "status", header: "Status", role: "secondary", cell: (row) => <ReceiptStatusPill state={receiptStanding(row)} /> },
    { key: "supplier", header: "Supplier", cell: (row) => row.supplierName ?? "—" },
    { key: "invoice", header: "Invoice", cell: (row) => row.invoiceNumber ?? "—" },
    { key: "number", header: "Receipt no.", cell: (row) => row.receiptNumber },
    { key: "by", header: "By", cell: (row) => row.receivedByName },
    { key: "products", header: "Products", align: "right", cell: (row) => row.lineCount.toLocaleString("en-ZA") },
    { key: "units", header: "Units", align: "right", cell: (row) => pluralise(row.totalUnits, "unit") },
  ];
}
