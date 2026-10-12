import { useQuery } from "@tanstack/react-query";
import { listProducts } from "@/shared/api/pharmacyStock";
import { pharmacyKeys } from "./queryKeys";

interface ProductSearchOptions {
  /** Archived products are only worth finding when checking for duplicates. */
  activeOnly?: boolean;
  size?: number;
}

const DEFAULT_SIZE = 8;

// The one definition of "search the product catalog by text", so every picker
// (receiving, reorder, dispensing, copy-from, duplicate check) shares the same
// request and the same cache entry for the same words.
export function productSearchQuery(text: string, { activeOnly = true, size = DEFAULT_SIZE }: ProductSearchOptions = {}) {
  const scope = `${activeOnly ? "active" : "all"}-${size}`;
  return {
    queryKey: pharmacyKeys.products.search(scope, text),
    queryFn: () => listProducts({ q: text, activeOnly, size }),
    staleTime: 30_000,
  };
}

/** Nothing is requested until there is something to search for. */
export function useProductSearch(text: string, options?: ProductSearchOptions) {
  const trimmed = text.trim();
  return useQuery({ ...productSearchQuery(trimmed, options), enabled: trimmed !== "" });
}
