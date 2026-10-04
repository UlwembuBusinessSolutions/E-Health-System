import { useId, type FormEvent } from "react";
import type { AdjustmentMode, BatchRow, StockRow } from "@/shared/api/pharmacyStock";
import { Button } from "@/shared/components/Button";
import { ErrorState } from "../components/ErrorState";
import { Modal } from "../components/Modal";
import { QuantityInput } from "../components/QuantityInput";
import { ReasonPicker } from "../components/ReasonPicker";
import { SkeletonRows } from "../components/SkeletonRows";
import { describeError } from "../lib/problem";
import { formatQuantity, unitLabel } from "../lib/units";
import { AdjustModeToggle } from "./AdjustModeToggle";
import { reasonOptionsFor } from "./adjustStockModel";
import { LotPicker } from "./LotPicker";
import { SerialAddInput } from "./SerialAddInput";
import { SerialRemovePicker } from "./SerialRemovePicker";
import { useAdjustStockForm } from "./useAdjustStockForm";
import { useAdjustStockSubmit } from "./useAdjustStockSubmit";
import { useProductLots } from "./stockQueries";

interface AdjustStockDialogProps {
  product: StockRow;
  facilityId: string;
  initialMode?: AdjustmentMode;
  /** Opened from a lot's own remove icon: that lot is already chosen. */
  initialBatchId?: string;
  onClose: () => void;
}

// Mounted by the parent only while open. It needs the product's lots before
// the form can make sense, so it shows its own loading and error states.
export function AdjustStockDialog(props: AdjustStockDialogProps) {
  const { product, onClose } = props;
  const lotsQuery = useProductLots(product.productId);
  const description = `${product.displayName} · ${product.code}`;

  if (!lotsQuery.data) {
    return (
      <Modal open title="Adjust stock" description={description} onClose={onClose}>
        {lotsQuery.isError ? (
          <ErrorState
            message={describeError(lotsQuery.error)}
            retrying={lotsQuery.isFetching}
            onRetry={() => void lotsQuery.refetch()}
          />
        ) : (
          <SkeletonRows rows={3} />
        )}
      </Modal>
    );
  }
  return <AdjustStockForm {...props} lots={lotsQuery.data} description={description} />;
}

interface AdjustStockFormProps extends AdjustStockDialogProps {
  lots: BatchRow[];
  description: string;
}

function AdjustStockForm({
  product,
  facilityId,
  lots,
  description,
  initialMode = "REMOVE",
  initialBatchId,
  onClose,
}: AdjustStockFormProps) {
  const formId = useId();
  const form = useAdjustStockForm({ product, facilityId, lots, initialMode, initialBatchId });
  const submission = useAdjustStockSubmit({
    successMessage: successMessage(form.mode, form.payload?.quantity ?? 0, product, form.lot),
    onDone: onClose,
  });

  const removing = form.mode === "REMOVE";
  const nothingToRemove = removing && (product.serialTracked ? form.serialsInStock.length === 0 : product.available === 0);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (form.payload) submission.submit(form.payload);
  }

  return (
    <Modal
      open
      title="Adjust stock"
      description={description}
      onClose={onClose}
      dismissible={!submission.isSubmitting}
      footer={
        <>
          <Button variant="secondary" disabled={submission.isSubmitting} onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form={formId}
            variant={removing ? "danger" : "primary"}
            disabled={!form.payload}
            loading={submission.isSubmitting}
          >
            {confirmLabel(form.mode, form.payload?.quantity, product.baseUnit)}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-5">
        <AdjustModeToggle mode={form.mode} onChange={form.setMode} />

        {nothingToRemove ? (
          <p className="rounded-lg bg-surface-sunken px-3.5 py-3 text-[13.5px] text-text-secondary">
            There is nothing on the shelf to remove. Use &ldquo;Add stock found&rdquo; if you have found some.
          </p>
        ) : (
          <>
            <QuantitySection form={form} product={product} lots={lots} />
            <ReasonPicker
              legend={removing ? "Why are you removing this stock?" : "Where did this stock come from?"}
              options={reasonOptionsFor(form.mode)}
              value={form.reason}
              onChange={form.setReason}
              note={form.note}
              onNoteChange={form.setNote}
            />
          </>
        )}

        {!nothingToRemove && (
          <p role="status" className="rounded-lg bg-surface-sunken px-3.5 py-3 text-[13.5px] text-text-secondary">
            {form.payload ? form.preview : `Still needed: ${form.missingStep}.`}
          </p>
        )}

        {submission.errorMessage && (
          <p role="alert" className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-[13.5px] text-danger-600">
            {submission.errorMessage}
          </p>
        )}
      </form>
    </Modal>
  );
}

interface QuantitySectionProps {
  form: ReturnType<typeof useAdjustStockForm>;
  product: StockRow;
  lots: BatchRow[];
}

// Serial-tracked products pick units by serial number; everything else picks a
// lot (when there are lots) and a typed quantity.
function QuantitySection({ form, product, lots }: QuantitySectionProps) {
  const removing = form.mode === "REMOVE";

  if (product.serialTracked) {
    return removing ? (
      <SerialRemovePicker serialsInStock={form.serialsInStock} selected={form.serials} onChange={form.setSerials} />
    ) : (
      <SerialAddInput added={form.serials} serialsInStock={form.serialsInStock} onChange={form.setSerials} />
    );
  }

  return (
    <>
      {lots.length > 0 && (
        <LotPicker
          lots={lots}
          baseUnit={product.baseUnit}
          selectedBatchId={form.lot?.batchId ?? null}
          onChange={form.chooseLot}
        />
      )}
      <div className="flex flex-col gap-2">
        <p className="text-[13px] font-medium text-text-primary">How many {unitLabel(product.baseUnit, 2)}?</p>
        <div className="flex flex-wrap items-center gap-3">
          <QuantityInput
            label="Quantity"
            value={form.quantity}
            min={1}
            max={form.maxQuantity}
            onChange={form.setQuantity}
          />
          {removing && form.lot && (
            <Button variant="secondary" onClick={() => form.setQuantity(form.lot?.quantity ?? 1)}>
              Whole lot ({form.lot.quantity})
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

function confirmLabel(mode: AdjustmentMode, quantity: number | undefined, baseUnit: string): string {
  const verb = mode === "REMOVE" ? "Remove" : "Add";
  return quantity ? `${verb} ${formatQuantity(quantity, baseUnit)}` : `${verb} stock`;
}

function successMessage(mode: AdjustmentMode, quantity: number, product: StockRow, lot: BatchRow | null): string {
  const amount = formatQuantity(quantity, product.baseUnit);
  const place = lot ? `lot ${lot.lotNumber} of ${product.displayName}` : product.displayName;
  return mode === "REMOVE" ? `Removed ${amount} from ${place}.` : `Added ${amount} to ${place}.`;
}
