import { useId } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listSupplierOptions,
  updateProduct,
  type PharmacyProduct,
  type StockRow,
} from "@/shared/api/pharmacyStock";
import { Button } from "@/shared/components/Button";
import { FormRow } from "@/shared/components/FormRow";
import { Input } from "@/shared/components/Input";
import { Select } from "@/shared/components/Select";
import { useToast } from "@/shared/components/toast/ToastProvider";
import { ErrorState } from "../components/ErrorState";
import { Modal } from "../components/Modal";
import { SkeletonRows } from "../components/SkeletonRows";
import { describeError } from "../lib/problem";
import { unitLabel } from "../lib/units";
import { stockKeys, useProductDetails } from "./stockQueries";

const NO_SUPPLIER = "NONE";

const whole = (message: string) => z.string().regex(/^\d*$/, message);

const editSchema = z.object({
  displayName: z.string().trim().min(1, "Give the product a name").max(200),
  reorderThreshold: whole("Use a whole number"),
  packSize: whole("Use a whole number").refine((value) => value === "" || Number(value) >= 1, "Must be at least 1"),
  barcode: z.string().trim().max(64),
  storageInstructions: z.string().trim().max(500),
  preferredSupplierId: z.string(),
});
type EditValues = z.infer<typeof editSchema>;

interface EditProductDialogProps {
  row: StockRow;
  facilityId: string;
  onClose: () => void;
}

// Mounted by the parent only while open. The form needs the full product
// (the stock row carries only what the list shows), so this loads it first.
export function EditProductDialog({ row, facilityId, onClose }: EditProductDialogProps) {
  const productQuery = useProductDetails(row.productId, true);

  if (!productQuery.data) {
    return (
      <Modal open title="Edit product" description={row.displayName} onClose={onClose}>
        {productQuery.isError ? (
          <ErrorState
            message={describeError(productQuery.error)}
            retrying={productQuery.isFetching}
            onRetry={() => void productQuery.refetch()}
          />
        ) : (
          <SkeletonRows rows={4} />
        )}
      </Modal>
    );
  }
  return <EditProductForm row={row} product={productQuery.data} facilityId={facilityId} onClose={onClose} />;
}

interface EditProductFormProps extends EditProductDialogProps {
  product: PharmacyProduct;
}

function EditProductForm({ row, product, facilityId, onClose }: EditProductFormProps) {
  const formId = useId();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const suppliersQuery = useQuery({ queryKey: ["pharmacy", "supplier-options"], queryFn: listSupplierOptions, staleTime: 5 * 60_000 });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      displayName: product.displayName,
      reorderThreshold: row.reorderThreshold?.toString() ?? "",
      packSize: product.packSize?.toString() ?? "",
      barcode: product.barcode ?? "",
      storageInstructions: product.storageInstructions ?? "",
      preferredSupplierId: product.preferredSupplierId ?? NO_SUPPLIER,
    },
  });

  const mutation = useMutation({
    mutationFn: (values: EditValues) =>
      updateProduct(product.id, {
        // The endpoint replaces the product, so untouched fields travel along unchanged.
        displayName: values.displayName,
        genericName: product.genericName ?? undefined,
        strength: product.strength ?? undefined,
        dosageForm: product.dosageForm ?? undefined,
        manufacturer: product.manufacturer ?? undefined,
        packSize: values.packSize ? Number(values.packSize) : undefined,
        barcode: values.barcode || undefined,
        storageInstructions: values.storageInstructions || undefined,
        preferredSupplierId: values.preferredSupplierId === NO_SUPPLIER ? null : values.preferredSupplierId,
        facilityId,
        reorderThreshold: values.reorderThreshold ? Number(values.reorderThreshold) : undefined,
      }),
    onSuccess: (updated) => {
      showToast(`Saved changes to ${updated.displayName}.`, "success");
      void queryClient.invalidateQueries({ queryKey: stockKeys.list(facilityId) });
      void queryClient.invalidateQueries({ queryKey: stockKeys.product(product.id) });
      onClose();
    },
  });

  const supplierOptions = [
    { value: NO_SUPPLIER, label: "No usual supplier" },
    ...(suppliersQuery.data ?? []).map((supplier) => ({ value: supplier.id, label: supplier.name })),
  ];

  return (
    <Modal
      open
      title="Edit product"
      description={product.code}
      onClose={onClose}
      dismissible={!mutation.isPending}
      footer={
        <>
          <Button variant="secondary" disabled={mutation.isPending} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={mutation.isPending}>
            Save changes
          </Button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={handleSubmit((values) => mutation.mutate(values))} className="flex flex-col gap-4">
        <Input label="Display name" required error={errors.displayName?.message} {...register("displayName")} />
        <FormRow>
          <Input label="Reorder at" inputMode="numeric" error={errors.reorderThreshold?.message} hint="Flags low stock at or below this." {...register("reorderThreshold")} />
          <Input label="Units per pack" inputMode="numeric" error={errors.packSize?.message} {...register("packSize")} />
        </FormRow>
        <Input label="Barcode" className="font-mono" placeholder="Scan it here" error={errors.barcode?.message} {...register("barcode")} />
        <Input label="Storage" placeholder="e.g. Keep refrigerated 2–8 °C" error={errors.storageInstructions?.message} {...register("storageInstructions")} />
        <Select label="Usual supplier" options={supplierOptions} {...register("preferredSupplierId")} />

        <p className="rounded-lg bg-surface-sunken px-3.5 py-3 text-[13px] text-text-secondary">
          Locked after the first receipt, because changing them would break the history: SKU{" "}
          <span className="font-mono text-text-primary">{product.code}</span>, counted in {unitLabel(product.baseUnit, 2)},{" "}
          {describeTracking(product)}.
        </p>

        {mutation.isError && (
          <p role="alert" className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-[13.5px] text-danger-600">
            {describeError(mutation.error)}
          </p>
        )}
      </form>
    </Modal>
  );
}

function describeTracking(product: PharmacyProduct): string {
  if (product.serialTracked) return "tracked by serial number";
  if (product.batchTracked) return "tracked by lot and expiry";
  return "tracked by quantity only";
}
