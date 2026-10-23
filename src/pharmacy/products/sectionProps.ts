import type { ProductFormValues } from "./productFormModel";

/** What every form section receives: the current answers and a way to change some of them. */
export interface SectionProps {
  values: ProductFormValues;
  update: (patch: Partial<ProductFormValues>) => void;
}
