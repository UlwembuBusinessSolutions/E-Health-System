import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createProduct, getProduct, type PharmacyProduct } from "@/shared/api/pharmacyStock";
import { Button } from "@/shared/components/Button";
import { SkeletonRows } from "../components/SkeletonRows";
import { describeError } from "../lib/problem";
import { stockKeys } from "../stock/stockQueries";
import { MoreDetailsSection } from "./MoreDetailsSection";
import { ProductDetailsSection } from "./ProductDetailsSection";
import { ProductPreview } from "./ProductPreview";
import { QuickStartSection } from "./QuickStartSection";
import { StockSettingsSection } from "./StockSettingsSection";
import {
  applyPreset,
  composeDisplayName,
  emptyProductValues,
  generateSku,
  toCreatePayload,
  validateProduct,
  valuesFromProduct,
  type ProductFormValues,
  type ProductPreset,
} from "./productFormModel";
import { useProductDuplicates } from "./useProductDuplicates";

interface ProductFormProps {
  variant: "page" | "panel";
  facilityId: string;
  initialName?: string;
  copyFromProductId?: string;
  onCreated: (product: PharmacyProduct) => void;
  onCancel?: () => void;
}

// Shared by the full Add product page and the Receive screen's side panel.
// When copying, the source product is loaded first so the form can start
// from its values instead of flashing empty and then jumping.
export function ProductForm(props: ProductFormProps) {
  const { copyFromProductId, initialName } = props;
  const source = useQuery({
    queryKey: ["pharmacy", "products", copyFromProductId],
    queryFn: () => getProduct(copyFromProductId ?? ""),
    enabled: !!copyFromProductId,
    staleTime: 30_000,
  });

  if (copyFromProductId && source.isLoading) return <SkeletonRows rows={4} />;

  const startValues = source.data ? valuesFromProduct(source.data) : emptyProductValues(initialName);
  return (
    <ProductFormBody
      key={source.data?.id ?? "blank"}
      {...props}
      startValues={startValues}
      startedFromTemplate={!!source.data}
      copyFailed={!!copyFromProductId && source.isError}
    />
  );
}

interface ProductFormBodyProps extends ProductFormProps {
  startValues: ProductFormValues;
  startedFromTemplate: boolean;
  copyFailed: boolean;
}

function ProductFormBody({
  variant,
  facilityId,
  onCreated,
  onCancel,
  startValues,
  startedFromTemplate,
  copyFailed,
}: ProductFormBodyProps) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState(startValues);
  // null means "follow the generated SKU"; typing one switches to the user's own.
  const [skuOverride, setSkuOverride] = useState<string | null>(null);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [fromTemplate, setFromTemplate] = useState(startedFromTemplate);
  const [showErrors, setShowErrors] = useState(false);

  const sku = skuOverride ?? generateSku(values);
  const errors = showErrors ? validateProduct(values, sku) : {};
  // A template's name is only a starting point, so similar-name warnings wait until the strength is filled in.
  const duplicates = useProductDuplicates({
    sku,
    displayName: composeDisplayName(values),
    checkName: !fromTemplate || values.strength.trim() !== "",
  });

  function update(patch: Partial<ProductFormValues>) {
    setValues((current) => ({ ...current, ...patch }));
  }

  function choosePreset(preset: ProductPreset) {
    setValues((current) => applyPreset(current, preset));
    setActivePresetId(preset.id);
    setFromTemplate(true);
  }

  function copyProduct(product: PharmacyProduct) {
    setValues(valuesFromProduct(product));
    setSkuOverride(null);
    setActivePresetId(null);
    setFromTemplate(true);
  }

  const mutation = useMutation({
    mutationFn: () => createProduct(toCreatePayload(values, sku, facilityId)),
    onSuccess: (product) => {
      void queryClient.invalidateQueries({ queryKey: stockKeys.list(facilityId) });
      void queryClient.invalidateQueries({ queryKey: stockKeys.dashboard(facilityId) });
      void queryClient.invalidateQueries({ queryKey: ["pharmacy", "products", "catalog-search"] });
      onCreated(product);
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setShowErrors(true);
    if (Object.keys(validateProduct(values, sku)).length > 0 || duplicates.skuOwner) return;
    mutation.mutate();
  }

  const form = (
    <form onSubmit={handleSubmit} noValidate className="flex min-w-0 flex-col gap-4">
      {copyFailed && (
        <p role="alert" className="rounded-lg bg-amber-50 px-3.5 py-2.5 text-[13.5px] text-amber-600">
          The product to copy couldn't be loaded, so you are starting from a blank form.
        </p>
      )}
      <QuickStartSection
        defaultOpen={variant === "page" && !startedFromTemplate}
        activePresetId={activePresetId}
        onPreset={choosePreset}
        onCopy={copyProduct}
      />
      <ProductDetailsSection values={values} update={update} errors={errors} similarProduct={duplicates.similarProduct} />
      <StockSettingsSection
        values={values}
        update={update}
        errors={errors}
        sku={sku}
        onSkuChange={setSkuOverride}
        skuOwner={duplicates.skuOwner}
      />
      <MoreDetailsSection values={values} update={update} />

      {mutation.isError && (
        <p role="alert" className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-[13.5px] text-danger-600">
          {describeError(mutation.error, "Couldn't add that product. Try again.")}
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button variant="secondary" disabled={mutation.isPending} onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={mutation.isPending} disabled={!!duplicates.skuOwner}>
          Add product
        </Button>
      </div>
    </form>
  );

  if (variant === "panel") return form;
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      {form}
      <aside className="hidden lg:block">
        <div className="sticky top-4">
          <ProductPreview values={values} sku={sku} />
        </div>
      </aside>
    </div>
  );
}
