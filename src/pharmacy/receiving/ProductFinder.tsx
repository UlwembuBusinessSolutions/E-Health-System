import { useRef, useState, type KeyboardEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, ScanLine, TriangleAlert } from "lucide-react";
import { listProducts, type PharmacyProduct } from "@/shared/api/pharmacyStock";
import { ErrorState } from "@/pharmacy/components/ErrorState";
import { SkeletonRows } from "@/pharmacy/components/SkeletonRows";
import { describeError } from "@/pharmacy/lib/problem";
import { useDebouncedValue } from "@/pharmacy/lib/useDebouncedValue";
import { toReceivableProduct, type ReceivableProduct } from "./receiptTypes";

const MAX_RESULTS = 8;
const SEARCH_STALE_MS = 30_000;

interface ProductFinderProps {
  /** Products shown as "Often received" chips while the box is empty. */
  recent: ReceivableProduct[];
  onSelect: (product: ReceivableProduct) => void;
  /** `typedName` pre-fills the new product's name. */
  onAddNew: (typedName: string) => void;
}

function searchQuery(text: string) {
  return {
    queryKey: ["pharmacy", "products", "receive-finder", text],
    queryFn: () => listProducts({ q: text, activeOnly: true, size: MAX_RESULTS }),
    staleTime: SEARCH_STALE_MS,
  };
}

// A barcode scanner types the code and presses Enter within a few
// milliseconds, before the debounce fires. Enter therefore asks the server
// itself (and reuses the cache when the debounced search already did).
function pickOnEnter(items: PharmacyProduct[], text: string): PharmacyProduct | null {
  const typed = text.trim().toLowerCase();
  const exact = items.find((item) => item.barcode?.toLowerCase() === typed || item.code.toLowerCase() === typed);
  if (exact) return exact;
  return items.length === 1 ? items[0] : null;
}

export function ProductFinder({ recent, onSelect, onAddNew }: ProductFinderProps) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const debounced = useDebouncedValue(text.trim());
  const typed = text.trim();

  const results = useQuery({ ...searchQuery(debounced), enabled: debounced !== "" });
  const settled = debounced === typed && results.isSuccess;
  const items = settled ? results.data.items : [];
  const nothingFound = settled && items.length === 0;

  function select(product: PharmacyProduct) {
    onSelect(toReceivableProduct(product));
    setText("");
    // Ready for the next scan without reaching for the mouse.
    inputRef.current?.focus();
  }

  async function handleEnter() {
    if (typed === "") return;
    try {
      const response = await queryClient.fetchQuery(searchQuery(typed));
      const match = pickOnEnter(response.items, typed);
      if (match) select(match);
    } catch {
      // The visible search query reports the same failure with a Retry button.
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    void handleEnter();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <ScanLine className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-text-secondary" aria-hidden />
        <label htmlFor="receive-product-finder" className="sr-only">
          Add a product
        </label>
        <input
          id="receive-product-finder"
          ref={inputRef}
          type="search"
          autoComplete="off"
          placeholder="Add a product: scan a barcode, or type a name or code"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
          aria-invalid={nothingFound}
          className="h-12 w-full rounded-lg border border-border-strong bg-surface-raised pl-10 pr-3.5 text-[15px] text-text-primary outline-none placeholder:text-text-secondary/70 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 aria-invalid:border-danger-500"
        />
      </div>

      {typed === "" && recent.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Often received">
          <span className="text-[13px] text-text-secondary">Often received:</span>
          {recent.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => onSelect(product)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border-strong bg-surface-raised px-4 text-[13.5px] font-medium text-text-primary hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              <Plus className="size-3.5" aria-hidden />
              {product.displayName}
            </button>
          ))}
        </div>
      )}

      {typed !== "" && (
        <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-raised">
          {results.isError && <ErrorState message={describeError(results.error)} onRetry={() => void results.refetch()} />}
          {!settled && !results.isError && <SkeletonRows rows={2} />}
          {nothingFound && (
            <p role="alert" className="flex items-start gap-2 bg-danger-50 px-3.5 py-3 text-[13.5px] text-danger-600">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                <strong>No product found for "{typed}".</strong> It is not in the catalog yet, so it can't be received.
                Check the spelling or barcode, or add it.
              </span>
            </p>
          )}
          <ul>
            {items.map((product) => (
              <li key={product.id} className="border-b border-border-subtle">
                <button
                  type="button"
                  onClick={() => select(product)}
                  className="flex min-h-11 w-full items-center justify-between gap-3 px-3.5 py-2 text-left hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-medium text-text-primary">{product.displayName}</span>
                    <span className="block truncate text-[12.5px] text-text-secondary">
                      {[product.strength, product.dosageForm].filter(Boolean).join(" ")}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-[12px] text-text-secondary">{product.code}</span>
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => onAddNew(typed)}
            className="flex min-h-11 w-full items-center gap-2 px-3.5 py-2 text-left text-[14px] font-medium text-brand-600 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400"
          >
            <Plus className="size-4 shrink-0" aria-hidden />
            Not in the catalog? Add "{typed}" as a new product
          </button>
        </div>
      )}
    </div>
  );
}
