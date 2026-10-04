import { useQuery } from "@tanstack/react-query";
import { listProducts, type PharmacyProduct } from "@/shared/api/pharmacyStock";
import { useDebouncedValue } from "../lib/useDebouncedValue";

const MIN_NAME_LENGTH = 4;

function useCatalogSearch(term: string) {
  const debounced = useDebouncedValue(term.trim());
  return useQuery({
    queryKey: ["pharmacy", "products", "catalog-search", debounced],
    queryFn: () => listProducts({ q: debounced, activeOnly: false, size: 10 }),
    enabled: debounced.length > 0,
    staleTime: 30_000,
    select: (page) => page.items,
  });
}

export interface ProductDuplicates {
  /** Another product already uses this SKU - blocks saving. */
  skuOwner: PharmacyProduct | null;
  /** A product whose name starts the same way - only a warning. */
  similarProduct: PharmacyProduct | null;
}

interface DuplicateInput {
  sku: string;
  displayName: string;
  /** False right after a preset or copy, when the name is still just a template. */
  checkName: boolean;
}

// Both checks ask the server, debounced, instead of filtering a downloaded
// catalog: the catalog can be thousands of rows. The server has the final
// say on SKU uniqueness; this only warns early.
export function useProductDuplicates({ sku, displayName, checkName }: DuplicateInput): ProductDuplicates {
  const skuMatches = useCatalogSearch(sku).data;
  const nameTerm = checkName && displayName.trim().length >= MIN_NAME_LENGTH ? displayName : "";
  const nameMatches = useCatalogSearch(nameTerm).data;

  const normalisedSku = sku.trim().toLowerCase();
  const normalisedName = nameTerm.trim().toLowerCase();

  return {
    skuOwner: skuMatches?.find((product) => product.code.toLowerCase() === normalisedSku) ?? null,
    similarProduct:
      normalisedName === ""
        ? null
        : (nameMatches?.find((product) => product.displayName.toLowerCase().startsWith(normalisedName)) ?? null),
  };
}
