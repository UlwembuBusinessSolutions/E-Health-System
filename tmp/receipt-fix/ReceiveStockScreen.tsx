import { useEffect, useMemo, useState } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Package, Plus, Trash2 } from "lucide-react";
import { listFacilityProducts, receiveStock, type ReceiveStockPayload } from "@/shared/api/pharmacyStock";
import { getFacilities } from "@/shared/api/facilities";
import { ApiError } from "@/shared/api/client";
import { Card } from "@/shared/components/Card";
import { Button } from "@/shared/components/Button";
import { Input } from "@/shared/components/Input";
import { Select } from "@/shared/components/Select";
import { FormRow } from "@/shared/components/FormRow";
import { PageHeader } from "@/shared/components/PageHeader";
import { useToast } from "@/shared/components/toast/ToastProvider";

const optionalPositiveInteger = z.string().max(10).refine((value) => {
  if (value === "") return true;
  const number = Number(value);
  return /^\d+$/.test(value) && Number.isSafeInteger(number) && number > 0 && number <= 2147483647;
}, "Enter a positive whole number");

const lineSchema = z.object({
  productId: z.string().min(1, "Select a product"),
  manufacturer: z.string().max(200).optional(),
  lotNumber: z.string().max(100).optional(),
  expiryDate: z.string().optional(),
  packs: optionalPositiveInteger.optional(),
  packSizeUsed: optionalPositiveInteger.optional(),
  baseQuantity: z.string().min(1, "Enter a quantity").max(10).refine((v) => {
    const n = Number(v);
    return /^\d+$/.test(v) && Number.isSafeInteger(n) && n > 0 && n <= 2147483647;
  }, "Enter a positive whole number"),
}).superRefine((line, context) => {
  const hasPacks = Boolean(line.packs);
  const hasPackSize = Boolean(line.packSizeUsed);
  if (hasPacks !== hasPackSize) {
    context.addIssue({
      code: "custom",
      message: "Enter both packs received and units per pack.",
      path: [hasPacks ? "packSizeUsed" : "packs"],
    });
  } else if (hasPacks && Number(line.packs) * Number(line.packSizeUsed) !== Number(line.baseQuantity)) {
    context.addIssue({
      code: "custom",
      message: "Packs multiplied by units per pack must equal the base quantity.",
      path: ["baseQuantity"],
    });
  }
});

const receiveSchema = z.object({
  sourceReference: z.string().max(200).optional(),
  supplierName: z.string().max(200).optional(),
  lines: z.array(lineSchema).min(1, "Add at least one line"),
});
type ReceiveValues = z.infer<typeof receiveSchema>;

function emptyLine() {
  return { productId: "", manufacturer: "", lotNumber: "", expiryDate: "", packs: "", packSizeUsed: "", baseQuantity: "" };
}

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

// Plan section 8/11 — "Review before posting" is this screen's own second
// step (below), not a persisted server-side draft (PharmacyReceiptService's
// own why-note on that Phase 1 simplification): the form's values are
// captured into reviewedValues on "Continue to review," and only the
// Confirm button on the review step actually calls the API.
export function ReceiveStockScreen() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  const initialFacilityId = searchParams.get("facilityId") ?? "";
  const [facilityId, setFacilityId] = useState(initialFacilityId);
  const [reviewing, setReviewing] = useState(false);
  const [reviewedValues, setReviewedValues] = useState<ReceiveValues | null>(null);
  // One idempotency key per submit ATTEMPT (shared/api/pharmacyStock.ts's
  // own why-note) — regenerated only when the person goes back and starts
  // a genuinely new attempt, not on every render, so retrying after a
  // network error reuses the same key instead of risking a double-post.
  const [idempotencyKey, setIdempotencyKey] = useState(createIdempotencyKey);

  const facilitiesQuery = useQuery({ queryKey: ["facilities"], queryFn: getFacilities });
  const productsQuery = useQuery({
    queryKey: ["pharmacy", "products", "for-receiving", facilityId],
    queryFn: () => listFacilityProducts(facilityId),
    enabled: Boolean(facilityId),
  });
  const productOptions = useMemo(
    () => (productsQuery.data ?? []).map((p) => ({ value: p.id, label: `${p.displayName} (${p.code})` })),
    [productsQuery.data],
  );
  const productsById = useMemo(
    () => new Map((productsQuery.data ?? []).map((p) => [p.id, p])),
    [productsQuery.data],
  );

  useEffect(() => {
    if (facilitiesQuery.data?.length && !facilitiesQuery.data.some((facility) => facility.id === facilityId)) {
      setFacilityId(facilitiesQuery.data[0].id);
    }
  }, [facilityId, facilitiesQuery.data]);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    trigger,
    setError,
    clearErrors,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ReceiveValues>({
    resolver: zodResolver(receiveSchema),
    defaultValues: { sourceReference: "", supplierName: "", lines: [emptyLine()] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "lines" });
  const watchedLines = useWatch({ control, name: "lines" });

  async function updatePackQuantity(index: number, field: "packs" | "packSizeUsed", value: string) {
    setValue(`lines.${index}.${field}`, value, { shouldDirty: true });
    const line = getValues(`lines.${index}`);
    clearErrors([`lines.${index}.packs`, `lines.${index}.packSizeUsed`, `lines.${index}.baseQuantity`]);
    if (line.packs && line.packSizeUsed) {
      const quantity = Number(line.packs) * Number(line.packSizeUsed);
      const valid = /^\d+$/.test(line.packs) && /^\d+$/.test(line.packSizeUsed) &&
        Number(line.packs) > 0 && Number(line.packSizeUsed) > 0 &&
        Number.isSafeInteger(quantity) && quantity <= 2147483647;
      setValue(`lines.${index}.baseQuantity`, valid ? String(quantity) : "", { shouldDirty: true });
      await trigger([`lines.${index}.packs`, `lines.${index}.packSizeUsed`, `lines.${index}.baseQuantity`]);
      if (!valid) setError(`lines.${index}.baseQuantity`, { type: "validate", message: "Pack total must be a positive whole number no greater than 2,147,483,647." });
    }
  }

  function clearLineDetails(index: number) {
    for (const field of ["manufacturer", "lotNumber", "expiryDate", "packs", "packSizeUsed", "baseQuantity"] as const) {
      setValue(`lines.${index}.${field}`, "");
      clearErrors(`lines.${index}.${field}`);
    }
  }

  const mutation = useMutation({
    mutationFn: (values: ReceiveValues) => {
      const payload: ReceiveStockPayload = {
        facilityId,
        sourceReference: values.sourceReference?.trim() || undefined,
        supplierName: values.supplierName?.trim() || undefined,
        lines: values.lines.map((line) => ({
          productId: line.productId,
          manufacturer: line.manufacturer?.trim() || undefined,
          lotNumber: line.lotNumber?.trim() || undefined,
          expiryDate: line.expiryDate || undefined,
          expiryPrecision: line.expiryDate ? "DAY" : undefined,
          packs: line.packs ? Number(line.packs) : undefined,
          packSizeUsed: line.packSizeUsed ? Number(line.packSizeUsed) : undefined,
          baseQuantity: Number(line.baseQuantity),
        })),
      };
      return receiveStock(payload, idempotencyKey);
    },
    onSuccess: () => {
      showToast("Stock received.", "success");
      void queryClient.invalidateQueries({ queryKey: ["pharmacy", "stock", facilityId] });
      void queryClient.invalidateQueries({ queryKey: ["pharmacy", "stock-alerts", facilityId] });
      void queryClient.invalidateQueries({ queryKey: ["pharmacy", "ledger"] });
      navigate(`/app/pharmacy/stock?facilityId=${facilityId}`);
    },
    onError: (error) => {
      showToast(error instanceof ApiError ? error.message : "Couldn't receive that stock. Try again.", "error");
    },
  });

  function goToReview(values: ReceiveValues) {
    if (reviewedValues && JSON.stringify(values) !== JSON.stringify(reviewedValues)) {
      setIdempotencyKey(createIdempotencyKey());
    }
    let valid = true;
    values.lines.forEach((line, index) => {
      clearErrors(`lines.${index}.productId`);
      clearErrors(`lines.${index}.lotNumber`);
      clearErrors(`lines.${index}.expiryDate`);
      const product = productsById.get(line.productId);
      if (!product) {
        setError(`lines.${index}.productId`, { type: "validate", message: "Select an active product for this facility." });
        valid = false;
        return;
      }
      if ((product.batchTracked || product.expiryTracked) && !(line.lotNumber ?? "").trim()) {
        setError(`lines.${index}.lotNumber`, { type: "validate", message: "Lot or batch number is required." });
        valid = false;
      }
      if (product.expiryTracked && !line.expiryDate) {
        setError(`lines.${index}.expiryDate`, { type: "validate", message: "Expiry date is required for this product." });
        valid = false;
      }
    });
    if (!valid) return;
    setReviewedValues(values);
    setReviewing(true);
  }

  function backToEdit() {
    setReviewing(false);
  }

  function confirmPost() {
    if (reviewedValues) mutation.mutate(reviewedValues);
  }

  function startOver() {
    setReviewing(false);
    setReviewedValues(null);
    setIdempotencyKey(createIdempotencyKey());
    reset({ sourceReference: "", supplierName: "", lines: [emptyLine()] });
  }

  const totalUnits = reviewedValues?.lines.reduce((sum, l) => sum + (Number(l.baseQuantity) || 0), 0) ?? 0;

  return (
    <div className="mx-auto max-w-3xl">
      <button
        type="button"
        onClick={() => (reviewing ? backToEdit() : navigate("/app/pharmacy/stock"))}
        className="mb-5 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {reviewing ? "Back" : "Back to stock"}
      </button>

      <PageHeader
        title={reviewing ? "Review receipt" : "Receive stock"}
        description={
          reviewing
            ? "Check the details below before posting. Once posted, this can't be edited or deleted."
            : "Record stock arriving at this facility, by batch and expiry."
        }
      />

      {!reviewing ? (
        <form onSubmit={handleSubmit(goToReview)} noValidate className="flex flex-col gap-5">
          {facilitiesQuery.isError && (
            <div role="alert" className="flex items-center justify-between gap-3 text-[13px] text-danger-600">
              <p>Facilities couldn't be loaded.</p>
              <Button type="button" variant="secondary" loading={facilitiesQuery.isFetching} onClick={() => void facilitiesQuery.refetch()}>
                Retry
              </Button>
            </div>
          )}
          {facilitiesQuery.isSuccess && facilitiesQuery.data.length === 0 && (
            <p role="status" className="text-[13px] text-text-secondary">No facilities are available for stock receiving.</p>
          )}
          <Card className="p-6">
            <FormRow>
              <Select
                label="Facility"
                required
                disabled={facilitiesQuery.isLoading || facilitiesQuery.isError}
                options={(facilitiesQuery.data ?? []).map((f) => ({ value: f.id, label: f.name }))}
                value={facilityId}
                onChange={(e) => {
                  const nextFacilityId = e.target.value;
                  if (nextFacilityId !== facilityId) {
                    setIdempotencyKey(createIdempotencyKey());
                    fields.forEach((_, index) => {
                      setValue(`lines.${index}.productId`, "");
                      clearErrors(`lines.${index}.productId`);
                      clearLineDetails(index);
                    });
                  }
                  setFacilityId(nextFacilityId);
                }}
              />
              <Input label="Source / delivery reference" placeholder="e.g. PO-1001" {...register("sourceReference")} />
            </FormRow>
            <div className="mt-4">
              <Input label="Supplier" placeholder="Optional" {...register("supplierName")} />
            </div>
          </Card>

          {productsQuery.isError && (
            <div role="alert" className="flex items-center justify-between gap-3 text-[13px] text-danger-600">
              <p>Products for this facility couldn't be loaded.</p>
              <Button type="button" variant="secondary" loading={productsQuery.isFetching} onClick={() => void productsQuery.refetch()}>
                Retry
              </Button>
            </div>
          )}
          {!productsQuery.isLoading && !productsQuery.isError && facilityId && productOptions.length === 0 && (
            <p className="text-[13px] text-text-secondary">No active products are assigned to this facility.</p>
          )}

          {errors.lines?.root && (
            <p role="alert" className="text-[13px] text-danger-600">
              {errors.lines.root.message}
            </p>
          )}

          {fields.map((field, index) => {
            const product = productsById.get(watchedLines?.[index]?.productId ?? "");
            const productRegistration = register(`lines.${index}.productId`);
            const tracksBatch = product?.batchTracked || product?.expiryTracked;
            const calculatedQuantity = Boolean(watchedLines?.[index]?.packs && watchedLines?.[index]?.packSizeUsed);
            const quantityHint = calculatedQuantity
              ? "Calculated from packs received × units per pack. Change either pack field to update."
              : "Enter individual units, or fill in both pack fields below to calculate the total.";
            return (
              <Card key={field.id} className="p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-[14px] font-semibold text-text-primary">Line {index + 1}</h3>
                  {fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="flex size-7 items-center justify-center rounded-md text-danger-600 hover:bg-danger-50"
                      aria-label="Remove line"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  )}
                </div>
                <div className="flex flex-col gap-4">
                  <Select
                    label="Product"
                    required
                    options={productOptions}
                    error={errors.lines?.[index]?.productId?.message}
                    {...productRegistration}
                    onChange={(event) => {
                      void productRegistration.onChange(event);
                      clearLineDetails(index);
                    }}
                  />
                  {tracksBatch && (
                    <FormRow>
                      <Input label="Manufacturer" placeholder="Optional" {...register(`lines.${index}.manufacturer`)} />
                      <Input
                        label="Lot / batch number"
                        required
                        placeholder="Enter lot or batch number"
                        error={errors.lines?.[index]?.lotNumber?.message}
                        {...register(`lines.${index}.lotNumber`)}
                      />
                    </FormRow>
                  )}
                  {product?.expiryTracked ? (
                    <FormRow>
                      <Input
                        label="Expiry date"
                        type="date"
                        required
                        error={errors.lines?.[index]?.expiryDate?.message}
                        {...register(`lines.${index}.expiryDate`)}
                      />
                      <Input
                        label="Quantity (base units)"
                        readOnly={calculatedQuantity}
                        hint={quantityHint}
                        required
                        inputMode="numeric"
                        placeholder="e.g. 90"
                        error={errors.lines?.[index]?.baseQuantity?.message}
                        {...register(`lines.${index}.baseQuantity`)}
                      />
                    </FormRow>
                  ) : (
                    <Input
                      label="Quantity (base units)"
                      readOnly={calculatedQuantity}
                      hint={quantityHint}
                      required
                      inputMode="numeric"
                      placeholder="e.g. 90"
                      error={errors.lines?.[index]?.baseQuantity?.message}
                      {...register(`lines.${index}.baseQuantity`)}
                    />
                  )}
                  <FormRow>
                    <Input
                      label="Packs received"
                      inputMode="numeric"
                      placeholder="Optional — e.g. 3"
                      error={errors.lines?.[index]?.packs?.message}
                      {...register(`lines.${index}.packs`)}
                      onChange={event => updatePackQuantity(index, "packs", event.target.value)}
                    />
                    <Input
                      label="Units per pack"
                      inputMode="numeric"
                      placeholder="Optional — e.g. 30"
                      error={errors.lines?.[index]?.packSizeUsed?.message}
                      {...register(`lines.${index}.packSizeUsed`)}
                      onChange={event => updatePackQuantity(index, "packSizeUsed", event.target.value)}
                    />
                  </FormRow>
                  <p className="text-xs text-text-secondary">Pack details are optional. Leave both blank when receiving individual units.</p>
                </div>
              </Card>
            );
          })}

          <Button type="button" variant="secondary" icon={<Plus className="size-4" aria-hidden />} onClick={() => append(emptyLine())}>
            Add another line
          </Button>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={!facilityId || facilitiesQuery.isLoading || facilitiesQuery.isError || productsQuery.isLoading || productsQuery.isError || productOptions.length === 0}>
              Continue to review
            </Button>
            <Button type="button" variant="secondary" onClick={() => navigate("/app/pharmacy/stock")}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-5">
          <Card className="overflow-hidden p-0">
            <div className="border-b border-border-subtle px-5 py-4">
              <p className="text-[13.5px] text-text-secondary">
                {reviewedValues?.sourceReference || "No reference"}
                {reviewedValues?.supplierName ? ` · ${reviewedValues.supplierName}` : ""}
              </p>
            </div>
            <div className="divide-y divide-border-subtle">
              {reviewedValues?.lines.map((line, i) => {
                const product = productsById.get(line.productId);
                const tracksBatch = product?.batchTracked || product?.expiryTracked;
                return (
                  <div key={i} className="flex items-center justify-between gap-4 px-5 py-3.5">
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-medium text-text-primary">
                        {product?.displayName ?? "Unknown product"}
                      </p>
                      <p className="text-[12.5px] text-text-secondary">
                        {tracksBatch ? `Lot ${line.lotNumber}` : "Batch not tracked"}
                        {line.manufacturer ? ` · ${line.manufacturer}` : ""}
                        {line.expiryDate ? ` · Expires ${line.expiryDate}` : ""}
                        {line.packs && line.packSizeUsed ? ` · ${line.packs} packs × ${line.packSizeUsed} units` : ""}
                      </p>
                    </div>
                    <p className="shrink-0 text-[14px] font-semibold text-text-primary">
                      {line.baseQuantity} {product?.baseUnit.toLowerCase()}
                    </p>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between border-t border-border-subtle bg-surface-sunken px-5 py-3">
              <p className="text-[13px] font-medium text-text-primary">Total units</p>
              <p className="text-[14px] font-semibold text-text-primary">{totalUnits}</p>
            </div>
          </Card>

          <div className="flex items-center gap-3">
            <Button
              icon={<CheckCircle2 className="size-4" aria-hidden />}
              loading={isSubmitting || mutation.isPending}
              onClick={confirmPost}
            >
              Confirm & post
            </Button>
            <Button type="button" variant="secondary" onClick={backToEdit}>
              Back to edit
            </Button>
            <Button type="button" variant="secondary" onClick={startOver}>
              Start over
            </Button>
          </div>
        </div>
      )}

      {productsQuery.isLoading && (
        <p className="mt-4 flex items-center gap-2 text-[12.5px] text-text-secondary">
          <Package className="size-3.5" aria-hidden /> Loading products…
        </p>
      )}
    </div>
  );
}
