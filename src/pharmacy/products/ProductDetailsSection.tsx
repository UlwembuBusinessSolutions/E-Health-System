import type { PharmacyProduct } from "@/shared/api/pharmacyStock";
import { Input } from "@/shared/components/Input";
import { OptionCards } from "./OptionCards";
import { categoryPatch, CATEGORY_OPTIONS, type ProductFormErrors } from "./productFormModel";
import type { SectionProps } from "./sectionProps";

interface ProductDetailsSectionProps extends SectionProps {
  errors: ProductFormErrors;
  similarProduct: PharmacyProduct | null;
}

export function ProductDetailsSection({ values, update, errors, similarProduct }: ProductDetailsSectionProps) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border-subtle bg-surface-raised p-4 sm:p-5">
      <h3 className="text-[15px] font-semibold text-text-primary">1 · Product details</h3>
      <OptionCards
        legend="Type"
        options={CATEGORY_OPTIONS}
        value={values.category}
        onChange={(category) => update(categoryPatch(category))}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Input
          label="Product name"
          required
          placeholder="e.g. Ibuprofen"
          value={values.name}
          error={errors.name}
          onChange={(event) => update({ name: event.target.value })}
        />
        <Input
          label="Strength or size"
          placeholder="e.g. 400 mg"
          value={values.strength}
          onChange={(event) => update({ strength: event.target.value })}
        />
        <Input
          label="Form"
          placeholder="e.g. tablets"
          value={values.dosageForm}
          onChange={(event) => update({ dosageForm: event.target.value })}
        />
      </div>
      {similarProduct && (
        <p role="status" className="rounded-lg bg-amber-50 px-3.5 py-2.5 text-[13.5px] text-amber-600">
          Already in the catalog: <strong>{similarProduct.displayName}</strong>. Keep going only if this is a different product.
        </p>
      )}
    </section>
  );
}
