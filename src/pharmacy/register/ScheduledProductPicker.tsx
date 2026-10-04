import { useState } from "react";
import clsx from "clsx";
import type { ScheduledProduct } from "@/shared/api/pharmacyCounts";
import { StatusPill } from "@/shared/components/StatusPill";
import { EmptyState } from "../components/EmptyState";
import { SearchInput } from "../components/SearchInput";

interface ScheduledProductPickerProps {
  products: ScheduledProduct[];
  selectedId: string;
  onSelect: (productId: string) => void;
}

function matches(product: ScheduledProduct, query: string): boolean {
  const haystack = `${product.name} ${product.sub ?? ""}`.toLowerCase();
  return haystack.includes(query.trim().toLowerCase());
}

// Filtering is done in the browser: a pharmacy holds a few dozen scheduled
// medicines at most, and the full list is already loaded for the balances.
export function ScheduledProductPicker({ products, selectedId, onSelect }: ScheduledProductPickerProps) {
  const [query, setQuery] = useState("");
  const visible = products.filter((product) => matches(product, query));

  return (
    <div className="flex flex-col gap-3">
      <SearchInput label="Search scheduled medicines" onSearch={setQuery} className="max-w-md" />
      {visible.length === 0 ? (
        <EmptyState title="No scheduled medicine matches." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((product) => (
            <li key={product.productId}>
              <button
                type="button"
                aria-pressed={product.productId === selectedId}
                onClick={() => onSelect(product.productId)}
                className={clsx(
                  "flex min-h-11 w-full items-start justify-between gap-3 rounded-xl border p-4 text-left transition-colors duration-150",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
                  product.productId === selectedId
                    ? "border-brand-500 bg-brand-50"
                    : "border-border-strong bg-surface-raised hover:bg-surface-sunken",
                )}
              >
                <span>
                  <span className="block text-[14.5px] font-semibold text-text-primary">{product.name}</span>
                  <span className="block text-[13px] text-text-secondary">
                    {product.sub ? `${product.sub} · ` : ""}
                    {product.onHand} on hand
                  </span>
                </span>
                <StatusPill tone={product.schedule === "S6" ? "danger" : "warning"}>
                  {product.schedule === "S6" ? "Schedule 6" : "Schedule 5"}
                </StatusPill>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
