import { CornerDownRight } from "lucide-react";
import { Card } from "@/shared/components/Card";
import { StatusPill } from "@/shared/components/StatusPill";
import { unitLabel } from "../lib/units";
import {
  CATEGORY_OPTIONS,
  composeDisplayName,
  TRACKING_OPTIONS,
  type ProductFormValues,
} from "./productFormModel";

interface ProductPreviewProps {
  values: ProductFormValues;
  sku: string;
}

function labelOf<T extends string>(options: { value: T; label: string }[], value: T): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

// A live read-back of what is being created, so a wrong unit or tracking
// choice is noticed before saving rather than after the first receipt.
export function ProductPreview({ values, sku }: ProductPreviewProps) {
  const name = composeDisplayName(values) || "New product";
  const rows: [string, string][] = [
    ["Counted in", unitLabel(values.baseUnit, 2)],
    ["Tracking", labelOf(TRACKING_OPTIONS, values.tracking)],
    ["Pack size", values.packSize ? `${values.packSize} per pack` : "Not set"],
    ["Reorder below", values.reorderThreshold || "Not set"],
  ];

  return (
    <Card aria-label="How it will look" className="p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">How it will look</p>
      <div className="mt-2 flex items-start justify-between gap-3">
        <h3 className="min-w-0 break-words text-[17px] font-semibold text-text-primary">{name}</h3>
        <StatusPill tone="neutral">{labelOf(CATEGORY_OPTIONS, values.category)}</StatusPill>
      </div>
      <p className="mt-1 font-mono text-[13px] text-text-secondary">{sku || "SKU appears here"}</p>
      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13.5px]">
        {rows.map(([term, detail]) => (
          <div key={term} className="contents">
            <dt className="text-text-secondary">{term}</dt>
            <dd className="text-right font-medium text-text-primary">{detail}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 flex gap-2 rounded-lg bg-surface-sunken p-3 text-[12.5px] text-text-secondary">
        <CornerDownRight className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          <strong className="block text-text-primary">Next: receive your first stock</strong>
          New products start with no stock, so this shows as out of stock until you receive some.
        </span>
      </p>
    </Card>
  );
}
