import { useState } from "react";
import { Check, PackagePlus, Pill, TriangleAlert } from "lucide-react";
import type { ImportRow, ImportRowResult } from "@/shared/api/pharmacyImport";
import { Button } from "@/shared/components/Button";
import { StatusPill } from "@/shared/components/StatusPill";
import { ResponsiveTable, type TableColumn } from "../components/ResponsiveTable";
import { PROBLEM_LABELS } from "./importCsv";

type EditableField = Exclude<keyof ImportRow, "confirmNewProduct">;

export interface ReviewItem {
  index: number;
  row: ImportRow;
  result: ImportRowResult | undefined;
}

interface ImportReviewTableProps {
  items: ReviewItem[];
  refreshing: boolean;
  onEdit: (index: number, changes: Partial<ImportRow>) => void;
  onSkip: (index: number, reason: string) => void;
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

function WhatHappens({ result }: { result: ImportRowResult | undefined }) {
  if (!result) return null;
  if (result.status === "PROBLEM") {
    return (
      <StatusPill tone="danger" icon={<TriangleAlert className="size-3.5" aria-hidden />}>
        {result.problem ? PROBLEM_LABELS[result.problem] : "Needs a decision"}
      </StatusPill>
    );
  }
  if (result.status === "NEW_PRODUCT") {
    return (
      <StatusPill tone="success" icon={<PackagePlus className="size-3.5" aria-hidden />}>
        {result.quantity > 0 ? "New product" : "New, no stock"}
      </StatusPill>
    );
  }
  return (
    <StatusPill tone="neutral" icon={<Check className="size-3.5" aria-hidden />}>
      Restock
    </StatusPill>
  );
}

// The one-click decisions a problem row offers, as edits to the row. Every
// decision is just a change to the sheet, so the server stays the only judge.
function Decisions({ item, onEdit, onSkip }: { item: ReviewItem; onEdit: ImportReviewTableProps["onEdit"]; onSkip: ImportReviewTableProps["onSkip"] }) {
  const { result, row, index } = item;
  if (!result || result.status !== "PROBLEM") return null;
  const suggestion = result.suggestion;
  return (
    <div className="flex flex-wrap gap-2">
      {result.problem === "SIMILAR_SKU" && suggestion && (
        <Button variant="secondary" onClick={() => onEdit(index, { sku: suggestion })}>
          Use {suggestion}
        </Button>
      )}
      {result.problem === "SIMILAR_SKU" && row.name && (
        <Button variant="secondary" onClick={() => onEdit(index, { confirmNewProduct: true })}>
          It is a new product
        </Button>
      )}
      {result.problem === "SIMILAR_SUPPLIER" && suggestion && (
        <Button variant="secondary" onClick={() => onEdit(index, { supplier: suggestion })}>
          Use {suggestion}
        </Button>
      )}
      {(result.problem === "SIMILAR_SUPPLIER" || result.problem === "UNKNOWN_SUPPLIER") && (
        <Button variant="secondary" onClick={() => onEdit(index, { supplier: "" })}>
          Use the file supplier
        </Button>
      )}
      <Button variant="secondary" onClick={() => onSkip(index, result.hint)}>
        Skip row
      </Button>
    </div>
  );
}

export function ImportReviewTable({ items, refreshing, onEdit, onSkip }: ImportReviewTableProps) {
  function cell(field: EditableField, label: string, badProblems: ImportRowResult["problem"][]) {
    return (item: ReviewItem) => (
      <EditableCell
        value={item.row[field]}
        label={`${label}, row ${item.index + 1}`}
        invalid={item.result?.status === "PROBLEM" && badProblems.includes(item.result.problem)}
        onCommit={(value) => onEdit(item.index, { [field]: value })}
      />
    );
  }

  const columns: TableColumn<ReviewItem>[] = [
    { key: "n", header: "#", cell: (item) => <span className="tabular-nums text-text-secondary">{item.index + 1}</span> },
    { key: "what", header: "What happens", role: "secondary", cell: (item) => <div className="min-w-28 whitespace-nowrap"><WhatHappens result={item.result} /></div> },
    {
      key: "sku",
      header: "SKU and product",
      role: "primary",
      cell: (item) => (
        <div className="flex flex-col gap-1.5">
          {cell("sku", "SKU", ["MISSING_SKU", "UNKNOWN_SKU", "SIMILAR_SKU"])(item)}
          {item.result?.productName && <span className="text-[12.5px] text-text-secondary">{item.result.productName}</span>}
          {item.result?.scheduled && (
            <span className="inline-flex items-center gap-1 text-[12.5px] text-amber-600">
              <Pill className="size-3.5" aria-hidden /> Goes into the scheduled register
            </span>
          )}
          {item.result?.status === "PROBLEM" && (
            <span role="note" className="text-[12.5px] text-danger-600">
              {item.result.hint}
            </span>
          )}
          {item.result?.warning && (
            <span role="note" className="text-[12.5px] text-amber-600">
              {item.result.warning}
            </span>
          )}
          <Decisions item={item} onEdit={onEdit} onSkip={onSkip} />
        </div>
      ),
    },
    { key: "lot", header: "Lot", cell: cell("lot", "Lot", ["MISSING_LOT", "DUPLICATE_LOT", "LOT_EXPIRY_MISMATCH"]) },
    { key: "expiry", header: "Expiry", cell: cell("expiry", "Expiry", ["BAD_EXPIRY", "EXPIRED", "LOT_EXPIRY_MISMATCH"]) },
    { key: "quantity", header: "Quantity", cell: cell("quantity", "Quantity", ["BAD_QUANTITY"]) },
    { key: "supplier", header: "Supplier", cell: cell("supplier", "Supplier", ["UNKNOWN_SUPPLIER", "SIMILAR_SUPPLIER"]) },
  ];

  return (
    <ResponsiveTable
      label="Rows to import"
      columns={columns}
      rows={items}
      getRowKey={(item) => String(item.index)}
      refreshing={refreshing}
      empty={<p className="px-5 py-10 text-center text-[13.5px] text-text-secondary">No rows here.</p>}
    />
  );
}
