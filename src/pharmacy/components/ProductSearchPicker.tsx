import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { listProducts, type PharmacyProduct } from "@/shared/api/pharmacyStock";
import { describeError } from "../lib/problem";
import { SearchInput } from "./SearchInput";
import { SkeletonRows } from "./SkeletonRows";

interface ProductSearchPickerProps {
  /** Accessible name of the search box. */
  label: string;
  onPick: (product: PharmacyProduct) => void;
  /** Products that must not be offered again (already on the list). */
  excludeIds?: ReadonlySet<string>;
  /** Shown under an empty result, e.g. a link to add a new product. */
  notFoundExtra?: ReactNode;
  /** Extra text under each product name, e.g. its current stock. */
  describe?: (product: PharmacyProduct) => string;
}

const RESULT_LIMIT = 8;

// SearchInput already debounces typing by 250 ms, so a request is only sent
// once the person pauses. Nothing is requested until something is typed.
export function ProductSearchPicker({ label, onPick, excludeIds, notFoundExtra, describe }: ProductSearchPickerProps) {
  const [text, setText] = useState("");
  const results = useQuery({
    queryKey: ["pharmacy", "products", "picker", text],
    queryFn: () => listProducts({ q: text, activeOnly: true, size: RESULT_LIMIT }),
    enabled: text.trim().length > 0,
    staleTime: 30_000,
  });
  const products = (results.data?.items ?? []).filter((product) => !excludeIds?.has(product.id));

  return (
    <div className="flex flex-col gap-2">
      <SearchInput label={label} onSearch={setText} />
      {results.isLoading && <SkeletonRows rows={2} />}
      {results.error && (
        <p role="alert" className="text-[13.5px] text-danger-600">
          {describeError(results.error)}
        </p>
      )}
      {text.trim() !== "" && results.data && (
        <ul aria-label="Matching products" className="divide-y divide-border-subtle rounded-lg border border-border-subtle">
          {products.map((product) => (
            <li key={product.id}>
              <button
                type="button"
                onClick={() => onPick(product)}
                className="flex min-h-11 w-full flex-col items-start px-3.5 py-2 text-left hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400"
              >
                <span className="text-[14px] font-medium text-text-primary">{product.displayName}</span>
                <span className="text-[12.5px] text-text-secondary">
                  {[product.strength, product.dosageForm, describe?.(product)].filter(Boolean).join(" · ")}
                </span>
              </button>
            </li>
          ))}
          {products.length === 0 && (
            <li className="px-3.5 py-3 text-[13.5px] text-text-secondary">
              No product found for &ldquo;{text}&rdquo;, or it is already on the list. {notFoundExtra}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
