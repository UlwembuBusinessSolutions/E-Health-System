import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { Link2 } from "lucide-react";
import { searchMappableProducts, type ProductRef } from "@/shared/api/pharmacy";
import { Button } from "@/shared/components/Button";
import { SearchInput } from "../components/SearchInput";
import { describeError } from "../lib/problem";

interface ProductPickerProps {
  drugName: string;
  /** The server's best match; preselected so the common case is one tap. */
  suggestion: ProductRef | null;
  loading: boolean;
  onConfirm: (productId: string) => void;
}

// Shown for an item that is not yet linked to a stock product. Until it is,
// there is nothing to deduct stock from, so dispensing is held back.
export function ProductPicker({ drugName, suggestion, loading, onConfirm }: ProductPickerProps) {
  const [selected, setSelected] = useState<ProductRef | null>(suggestion);
  const [query, setQuery] = useState("");

  const searching = query.trim().length >= 2;
  const results = useQuery({
    queryKey: ["pharmacy", "products", "for-mapping", query],
    queryFn: () => searchMappableProducts(query),
    enabled: searching,
    staleTime: 30_000,
  });
  // Before the pharmacist types, the only choice on offer is the server's suggestion.
  const suggestionOnly = suggestion ? [suggestion] : [];
  const options = searching ? (results.data ?? []) : suggestionOnly;

  return (
    <div className="mt-3 flex flex-col gap-2.5 rounded-lg border border-amber-500/40 bg-amber-50 p-3.5">
      <p className="text-[13.5px] font-medium text-text-primary">
        Choose the stock product for {drugName}
      </p>
      <p className="text-[13px] text-text-secondary">
        {suggestion ? "We suggest the product below. Search to pick another." : "Search for the product on the shelf."}
      </p>
      <SearchInput label="Search stock products" onSearch={setQuery} />
      {results.isError && (
        <p role="alert" className="text-[13px] text-danger-600">
          {describeError(results.error)}
        </p>
      )}
      <ul className="flex flex-col gap-1.5">
        {options.map((product) => (
          <li key={product.id}>
            <button
              type="button"
              aria-pressed={selected?.id === product.id}
              onClick={() => setSelected(product)}
              className={clsx(
                "min-h-11 w-full rounded-lg border px-3.5 py-2 text-left text-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
                selected?.id === product.id
                  ? "border-brand-500 bg-brand-50 font-medium text-brand-700"
                  : "border-border-strong bg-surface-raised text-text-primary hover:bg-surface-sunken",
              )}
            >
              {product.name}
            </button>
          </li>
        ))}
      </ul>
      {searching && results.data?.length === 0 && (
        <p className="text-[13px] text-text-secondary">No product matches. Check the spelling.</p>
      )}
      <Button
        className="sm:self-end"
        disabled={!selected}
        loading={loading}
        icon={<Link2 className="size-4" aria-hidden />}
        onClick={() => selected && onConfirm(selected.id)}
      >
        {selected ? `Use ${selected.name}` : "Choose a product"}
      </Button>
    </div>
  );
}
