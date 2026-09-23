import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Package } from "lucide-react";
import { createProduct, type StockBaseUnit, type StockCategory } from "@/shared/api/pharmacyStock";
import { getFacilities } from "@/shared/api/facilities";
import { ApiError } from "@/shared/api/client";
import { Card } from "@/shared/components/Card";
import { Button } from "@/shared/components/Button";
import { Input } from "@/shared/components/Input";
import { Select } from "@/shared/components/Select";
import { Switch } from "@/shared/components/Switch";
import { FormRow } from "@/shared/components/FormRow";
import { PageHeader } from "@/shared/components/PageHeader";
import { useToast } from "@/shared/components/toast/ToastProvider";

const CATEGORY_OPTIONS: { value: StockCategory; label: string }[] = [
  { value: "MEDICINE", label: "Medicine" },
  { value: "SUPPLY", label: "Supply" },
];

const BASE_UNIT_OPTIONS: { value: StockBaseUnit; label: string }[] = [
  { value: "TABLET", label: "Tablet" },
  { value: "CAPSULE", label: "Capsule" },
  { value: "BOTTLE", label: "Bottle" },
  { value: "VIAL", label: "Vial" },
  { value: "SEALED_PACK", label: "Sealed pack" },
  { value: "EACH", label: "Each" },
];

// Plan section 4's add workflow — code/name/unit up front, batch/expiry
// tracking defaulting to on for medicines (step 2's own "medicines default
// to both" rule), and the facility this product joins the assortment of
// immediately (step 5) so it's ready to receive stock against as soon as
// it's created (step 6).
const productSchema = z.object({
  code: z.string().trim().min(1, "Code is required").max(50),
  displayName: z.string().trim().min(1, "Display name is required").max(200),
  genericName: z.string().max(200).optional(),
  strength: z.string().max(100).optional(),
  dosageForm: z.string().max(100).optional(),
  category: z.string().min(1, "Select a category"),
  baseUnit: z.string().min(1, "Select a base unit"),
  packSize: z.string().max(10).optional(),
  barcode: z.string().max(64).optional(),
  manufacturer: z.string().max(200).optional(),
  batchTracked: z.boolean(),
  expiryTracked: z.boolean(),
  storageInstructions: z.string().max(500).optional(),
  facilityId: z.string().min(1, "Select a facility"),
  reorderThreshold: z.string().max(10).optional(),
});
type ProductValues = z.infer<typeof productSchema>;

export function AddProductScreen() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  const facilitiesQuery = useQuery({ queryKey: ["facilities"], queryFn: getFacilities });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<ProductValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      code: "", displayName: "", category: "MEDICINE", baseUnit: "TABLET", batchTracked: true, expiryTracked: true,
      facilityId: "",
    },
  });
  const batchTracked = watch("batchTracked");
  const expiryTracked = watch("expiryTracked");

  // Defaults to the first facility once the list loads, same "don't
  // clobber a choice already made" guard as PharmacyQueuePage's own
  // facility-default effect — only fires while the field is still empty.
  useEffect(() => {
    if (facilitiesQuery.data && facilitiesQuery.data.length > 0 && !getValues("facilityId")) {
      setValue("facilityId", facilitiesQuery.data[0].id);
    }
  }, [facilitiesQuery.data, getValues, setValue]);

  const mutation = useMutation({
    mutationFn: (values: ProductValues) =>
      createProduct({
        code: values.code,
        displayName: values.displayName,
        genericName: values.genericName || undefined,
        strength: values.strength || undefined,
        dosageForm: values.dosageForm || undefined,
        category: values.category as StockCategory,
        baseUnit: values.baseUnit as StockBaseUnit,
        packSize: values.packSize ? Number(values.packSize) : undefined,
        barcode: values.barcode || undefined,
        manufacturer: values.manufacturer || undefined,
        batchTracked: values.batchTracked,
        expiryTracked: values.expiryTracked,
        storageInstructions: values.storageInstructions || undefined,
        facilityId: values.facilityId,
        reorderThreshold: values.reorderThreshold ? Number(values.reorderThreshold) : undefined,
      }),
    onSuccess: (product) => {
      showToast(`"${product.displayName}" added to the catalog.`, "success");
      navigate(`/app/pharmacy/products/${product.id}`);
    },
    onError: (error) => {
      setFormError(error instanceof ApiError ? error.message : "Couldn't add that product. Try again.");
    },
  });

  return (
    <div className="mx-auto max-w-2xl">
      <button
        type="button"
        onClick={() => navigate("/app/pharmacy/products")}
        className="mb-5 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to products
      </button>
      <PageHeader title="Add product" description="Create a new catalog entry. This doesn't add any stock yet." />

      <form onSubmit={handleSubmit((v) => mutation.mutate(v))} noValidate className="flex flex-col gap-5">
        {formError && (
          <div role="alert" className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-[13.5px] text-danger-600">
            {formError}
          </div>
        )}

        <Card className="p-6">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <Package className="size-[18px]" aria-hidden />
            </span>
            <h2 className="text-[14.5px] font-semibold text-text-primary">Identity</h2>
          </div>
          <div className="flex flex-col gap-4">
            <FormRow>
              <Input label="Code / SKU" required placeholder="PARA500" error={errors.code?.message} {...register("code")} />
              <Input label="Display name" required placeholder="Paracetamol 500mg" error={errors.displayName?.message} {...register("displayName")} />
            </FormRow>
            <FormRow>
              <Input label="Generic / ingredient name" placeholder="Paracetamol" {...register("genericName")} />
              <Input label="Manufacturer" placeholder="Optional" {...register("manufacturer")} />
            </FormRow>
            <FormRow>
              <Input label="Strength" placeholder="500mg" {...register("strength")} />
              <Input label="Dosage form" placeholder="Tablet" {...register("dosageForm")} />
            </FormRow>
            <FormRow>
              <Select label="Category" required options={CATEGORY_OPTIONS} error={errors.category?.message} {...register("category")} />
              <Select label="Base stock unit" required options={BASE_UNIT_OPTIONS} hint="Frozen after the first receipt." error={errors.baseUnit?.message} {...register("baseUnit")} />
            </FormRow>
            <FormRow>
              <Input label="Pack size" inputMode="numeric" placeholder="e.g. 30 tablets per box" hint="Optional — used when receiving by the pack." {...register("packSize")} />
              <Input label="Barcode / GTIN" placeholder="Optional" {...register("barcode")} />
            </FormRow>
            <Input label="Storage instructions" placeholder="Optional" {...register("storageInstructions")} />
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 text-[14.5px] font-semibold text-text-primary">Tracking</h2>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[13.5px] font-medium text-text-primary">Track by batch</p>
                <p className="text-[12.5px] text-text-secondary">Frozen after the first receipt.</p>
              </div>
              <Switch checked={batchTracked} onChange={(v) => setValue("batchTracked", v)} label="Track by batch" />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[13.5px] font-medium text-text-primary">Track expiry</p>
                <p className="text-[12.5px] text-text-secondary">Every batch requires an expiry date once on.</p>
              </div>
              <Switch checked={expiryTracked} onChange={(v) => setValue("expiryTracked", v)} label="Track expiry" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 text-[14.5px] font-semibold text-text-primary">Facility assortment</h2>
          <FormRow>
            <Select
              label="Facility"
              required
              options={(facilitiesQuery.data ?? []).map((f) => ({ value: f.id, label: f.name }))}
              error={errors.facilityId?.message}
              {...register("facilityId")}
            />
            <Input label="Reorder threshold" inputMode="numeric" hint="Optional — flags low stock at or below this." {...register("reorderThreshold")} />
          </FormRow>
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            Add product
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate("/app/pharmacy/products")}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
