import { useEffect, useMemo, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Package, Plus, Trash2 } from "lucide-react";
import { listProducts, receiveStock, type ReceiveStockPayload } from "@/shared/api/pharmacyStock";
import { getFacilities } from "@/shared/api/facilities";
import { ApiError } from "@/shared/api/client";
import { Card } from "@/shared/components/Card";
import { Button } from "@/shared/components/Button";
import { Input } from "@/shared/components/Input";
import { Select } from "@/shared/components/Select";
import { FormRow } from "@/shared/components/FormRow";
import { PageHeader } from "@/shared/components/PageHeader";
import { useToast } from "@/shared/components/toast/ToastProvider";

const lineSchema = z.object({
  productId: z.string().min(1, "Select a product"),
  manufacturer: z.string().max(200).optional(),
  lotNumber: z.string().max(100).optional(),
  expiryDate: z.string().optional(),
  packs: z.string().max(10).optional(),
  packSizeUsed: z.string().max(10).optional(),
  baseQuantity: z.string().min(1, "Enter a quantity").refine((v) => {
    const n = Number(v);
    return Number.isInteger(n) && n > 0;
  }, "Enter a positive whole number"),
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

// Plan section 8/11 — "Review before posting" is this screen's own second
// step (below), not a persisted server-side draft (PharmacyReceiptService's
// own why-note on that Phase 1 simplification): the form's values are
// captured into reviewedValues on "Continue to review," and only the
// Confirm button on the review step actually calls the API.
export function ReceiveStockScreen() {
  const navigate = useNavigate();
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
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  const facilitiesQuery = useQuery({ queryKey: ["facilities"], queryFn: getFacilities });
  const productsQuery = useQuery({
    queryKey: ["pharmacy", "products", "for-receiving"],
    queryFn: () => listProducts({ activeOnly: true, size: 100 }),
  });
  const productOptions = useMemo(
    () => (productsQuery.data?.items ?? []).map((p) => ({ value: p.id, label: `${p.displayName} (${p.code})` })),
    [productsQuery.data],
  );
  const productsById = useMemo(
    () => new Map((productsQuery.data?.items ?? []).map((p) => [p.id, p])),
    [productsQuery.data],
  );

  useEffect(() => {
    if (!facilityId && facilitiesQuery.data && facilitiesQuery.data.length > 0) {
      setFacilityId(facilitiesQuery.data[0].id);
    }
  }, [facilityId, facilitiesQuery.data]);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ReceiveValues>({
    resolver: zodResolver(receiveSchema),
    defaultValues: { sourceReference: "", supplierName: "", lines: [emptyLine()] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "lines" });

  const mutation = useMutation({
    mutationFn: (values: ReceiveValues) => {
      const payload: ReceiveStockPayload = {
        facilityId,
        sourceReference: values.sourceReference || undefined,
        supplierName: values.supplierName || undefined,
        lines: values.lines.map((line) => ({
          productId: line.productId,
          manufacturer: line.manufacturer || undefined,
          lotNumber: line.lotNumber || undefined,
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
      navigate(`/app/pharmacy/stock?facilityId=${facilityId}`);
    },
    onError: (error) => {
      showToast(error instanceof ApiError ? error.message : "Couldn't receive that stock. Try again.", "error");
    },
  });

  function goToReview(values: ReceiveValues) {
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
    setIdempotencyKey(crypto.randomUUID());
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
          <Card className="p-6">
            <FormRow>
              <Select
                label="Facility"
                required
                options={(facilitiesQuery.data ?? []).map((f) => ({ value: f.id, label: f.name }))}
                value={facilityId}
                onChange={(e) => setFacilityId(e.target.value)}
              />
              <Input label="Source / delivery reference" placeholder="e.g. PO-1001" {...register("sourceReference")} />
            </FormRow>
            <div className="mt-4">
              <Input label="Supplier" placeholder="Optional" {...register("supplierName")} />
            </div>
          </Card>

          {errors.lines?.root && (
            <p role="alert" className="text-[13px] text-danger-600">
              {errors.lines.root.message}
            </p>
          )}

          {fields.map((field, index) => (
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
                  {...register(`lines.${index}.productId`)}
                />
                <FormRow>
                  <Input label="Manufacturer" placeholder="Optional" {...register(`lines.${index}.manufacturer`)} />
                  <Input label="Lot / batch number" placeholder="Optional" {...register(`lines.${index}.lotNumber`)} />
                </FormRow>
                <FormRow>
                  <Input label="Expiry date" type="date" {...register(`lines.${index}.expiryDate`)} />
                  <Input
                    label="Quantity (base units)"
                    required
                    inputMode="numeric"
                    placeholder="e.g. 90"
                    error={errors.lines?.[index]?.baseQuantity?.message}
                    {...register(`lines.${index}.baseQuantity`)}
                  />
                </FormRow>
                <FormRow>
                  <Input label="Packs received" inputMode="numeric" placeholder="Optional — e.g. 3" {...register(`lines.${index}.packs`)} />
                  <Input label="Units per pack" inputMode="numeric" placeholder="Optional — e.g. 30" {...register(`lines.${index}.packSizeUsed`)} />
                </FormRow>
              </div>
            </Card>
          ))}

          <Button type="button" variant="secondary" icon={<Plus className="size-4" aria-hidden />} onClick={() => append(emptyLine())}>
            Add another line
          </Button>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={!facilityId}>
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
                return (
                  <div key={i} className="flex items-center justify-between gap-4 px-5 py-3.5">
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-medium text-text-primary">
                        {product?.displayName ?? "Unknown product"}
                      </p>
                      <p className="text-[12.5px] text-text-secondary">
                        {line.lotNumber ? `Lot ${line.lotNumber}` : "No lot number"}
                        {line.manufacturer ? ` · ${line.manufacturer}` : ""}
                        {line.expiryDate ? ` · Expires ${line.expiryDate}` : ""}
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
