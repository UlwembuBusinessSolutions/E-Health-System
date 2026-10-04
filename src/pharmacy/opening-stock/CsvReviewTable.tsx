import { useState } from "react";
import { Check, Trash2, TriangleAlert } from "lucide-react";
import type { OpeningRowResult, OpeningStockRow } from "@/shared/api/pharmacyPlanning";
import { StatusPill } from "@/shared/components/StatusPill";
import { ResponsiveTable, type TableColumn } from "../components/ResponsiveTable";
import { FALLBACK_HINTS, STATUS_LABELS } from "./openingCsv";

type EditableField = keyof OpeningStockRow;

interface ReviewRow {
  index: number;
  row: OpeningStockRow;
  result: OpeningRowResult | undefined;
}

interface CsvReviewTableProps {
  rows: OpeningStockRow[];
  results: OpeningRowResult[];
  /** True while a re-check of edited rows is running. */
  refreshing: boolean;
  onEdit: (index: number, field: EditableField, value: string) => void;
  onRemove: (index: number) => void;
}

// Edits are committed on blur, not per keystroke, so the checker runs once
// per finished correction instead of once per character.
function EditableCell({ value, label, invalid, onCommit }: { value: string; label: string; invalid: boolean; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);

  function commit() {
    if (draft !== null && draft !== value) onCommit(draft.trim());
    setDraft(null);
  }

  return (
    <input
      aria-label={label}
      aria-invalid={invalid}
      value={draft ?? value}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
      className={`h-11 w-full min-w-24 rounded-lg border bg-surface-raised px-2.5 text-[14px] text-text-primary outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 ${
        invalid ? "border-danger-500" : "border-border-strong"
      }`}
    />
  );
}

function StatusCell({ result }: { result: OpeningRowResult | undefined }) {
  if (!result) return null;
  return result.status === "OK" ? (
    <StatusPill tone="success" icon={<Check className="size-3.5" aria-hidden />}>OK</StatusPill>
  ) : (
    <StatusPill tone="danger" icon={<TriangleAlert className="size-3.5" aria-hidden />}>{STATUS_LABELS[result.status]}</StatusPill>
  );
}

export function CsvReviewTable({ rows, results, refreshing, onEdit, onRemove }: CsvReviewTableProps) {
  const reviewRows: ReviewRow[] = rows.map((row, index) => ({ index, row, result: results[index] }));

  function cell(field: EditableField, label: string, badStatus: OpeningRowResult["status"][]) {
    return (item: ReviewRow) => (
      <EditableCell
        value={item.row[field]}
        label={`${label}, row ${item.index + 1}`}
        invalid={item.result !== undefined && badStatus.includes(item.result.status)}
        onCommit={(value) => onEdit(item.index, field, value)}
      />
    );
  }

  const columns: TableColumn<ReviewRow>[] = [
    { key: "n", header: "#", cell: (item) => <span className="tabular-nums text-text-secondary">{item.index + 1}</span> },
    { key: "status", header: "Status", role: "secondary", cell: (item) => <StatusCell result={item.result} /> },
    {
      key: "sku",
      header: "SKU and product",
      role: "primary",
      cell: (item) => (
        <div className="flex flex-col gap-1">
          {cell("sku", "SKU", ["UNKNOWN_PRODUCT"])(item)}
          {item.result?.product && <span className="text-[12.5px] text-text-secondary">{item.result.product.name} {item.result.product.sub}</span>}
          {item.result && item.result.status !== "OK" && (
            <span role="note" className="text-[12.5px] text-danger-600">{item.result.hint ?? FALLBACK_HINTS[item.result.status]}</span>
          )}
        </div>
      ),
    },
    { key: "lot", header: "Lot", cell: cell("lot", "Lot", ["DUPLICATE_LOT"]) },
    { key: "expiry", header: "Expiry", cell: cell("expiry", "Expiry", ["BAD_EXPIRY"]) },
    { key: "quantity", header: "Quantity", cell: cell("quantity", "Quantity", ["BAD_QUANTITY"]) },
    {
      key: "remove",
      header: "",
      cell: (item) => (
        <button
          type="button"
          aria-label={`Remove row ${item.index + 1}`}
          onClick={() => onRemove(item.index)}
          className="grid size-11 place-items-center rounded-lg text-text-secondary hover:bg-danger-50 hover:text-danger-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      ),
    },
  ];

  return (
    <ResponsiveTable
      label="Opening stock rows"
      columns={columns}
      rows={reviewRows}
      getRowKey={(item) => String(item.index)}
      refreshing={refreshing}
      empty={<p className="px-5 py-10 text-center text-[13.5px] text-text-secondary">No rows left. Go back and paste your stock.</p>}
    />
  );
}
