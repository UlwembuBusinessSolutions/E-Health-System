import type { PharmacyProduct } from "@/shared/api/pharmacyStock";
import { useProductSearch } from "../lib/productSearch";
import { useDebouncedValue } from "../lib/useDebouncedValue";

const MIN_NAME_LENGTH = 4;
// Archived products count as duplicates too: their SKU is still taken.
const CATALOG_SEARCH = { activeOnly: false, size: 10 };

function useCatalogSearch(term: string) {
  const debounced = useDebouncedValue(term.trim());
  return useProductSearch(debounced, CATALOG_SEARCH).data?.items;
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
  const skuMatches = useCatalogSearch(sku);
  const nameTerm = checkName && displayName.trim().length >= MIN_NAME_LENGTH ? displayName : "";
  const nameMatches = useCatalogSearch(nameTerm);

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
