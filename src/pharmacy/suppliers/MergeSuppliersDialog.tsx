import { useId, useState } from "react";
import clsx from "clsx";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { mergeSuppliers, type Supplier } from "@/shared/api/pharmacyReceiving";
import { Button } from "@/shared/components/Button";
import { Modal } from "@/pharmacy/components/Modal";
import { pluralise } from "@/pharmacy/lib/format";
import { describeError } from "@/pharmacy/lib/problem";
import { pharmacyKeys } from "@/pharmacy/lib/queryKeys";

interface MergeSuppliersDialogProps {
  /** Active suppliers only: merging into or out of an archived one makes no sense. */
  suppliers: Supplier[];
  /** Skips step 1 when the dialog is opened from a specific row's "Merge". */
  initialDuplicate?: Supplier;
  onClose: () => void;
  onMerged: (kept: Supplier, mergedAway: Supplier) => void;
}

// Rendered only while open, like SupplierDialog.
export function MergeSuppliersDialog({ suppliers, initialDuplicate, onClose, onMerged }: MergeSuppliersDialogProps) {
  const queryClient = useQueryClient();
  const [duplicate, setDuplicate] = useState<Supplier | null>(initialDuplicate ?? null);
  const [keep, setKeep] = useState<Supplier | null>(null);
  // Step 2 is "a duplicate has been chosen and the user moved on"; going Back
  // must not forget the choice, so it is a flag rather than derived from `duplicate`.
  const [choosingKeeper, setChoosingKeeper] = useState(initialDuplicate !== undefined);

  const merge = useMutation({
    mutationFn: () => {
      if (!duplicate || !keep) throw new Error("Choose both suppliers first.");
      return mergeSuppliers(duplicate.id, keep.id);
    },
    onSuccess: (kept) => {
      void queryClient.invalidateQueries({ queryKey: pharmacyKeys.suppliers.all });
      // Re-pointed receipts change the "recent receipts" of both suppliers and the receipt lists elsewhere.
      void queryClient.invalidateQueries({ queryKey: pharmacyKeys.receipts.all });
      if (duplicate) onMerged(kept, duplicate);
    },
  });

  function chooseDuplicate(next: Supplier) {
    setDuplicate(next);
    setKeep(null);
  }

  const keepers = suppliers.filter((supplier) => supplier.id !== duplicate?.id);

  return (
    <Modal
      open
      title="Merge suppliers"
      description={
        choosingKeeper
          ? "Step 2 of 2. Which supplier should be kept?"
          : "Step 1 of 2. Which supplier is the duplicate? It will be archived once merged."
      }
      dismissible={!merge.isPending}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={merge.isPending}>
            Cancel
          </Button>
          {choosingKeeper ? (
            <>
              <Button variant="secondary" onClick={() => setChoosingKeeper(false)} disabled={merge.isPending}>
                Back
              </Button>
              <Button loading={merge.isPending} disabled={!keep} onClick={() => merge.mutate()}>
                Confirm merge
              </Button>
            </>
          ) : (
            <Button disabled={!duplicate} onClick={() => setChoosingKeeper(true)}>
              Next
            </Button>
          )}
        </>
      }
    >
      {choosingKeeper && duplicate ? (
        <div className="flex flex-col gap-4">
          <SupplierChoice
            legend={`Keep this supplier in place of ${duplicate.name}`}
            suppliers={keepers}
            selected={keep}
            onSelect={setKeep}
          />
          {keep && <MergeConsequence duplicate={duplicate} keep={keep} />}
          {merge.error && (
            <p role="alert" className="text-[13.5px] text-danger-600">
              {describeError(merge.error)}
            </p>
          )}
        </div>
      ) : (
        <SupplierChoice
          legend="Duplicate supplier"
          suppliers={suppliers}
          selected={duplicate}
          onSelect={chooseDuplicate}
        />
      )}
    </Modal>
  );
}

function MergeConsequence({ duplicate, keep }: { duplicate: Supplier; keep: Supplier }) {
  return (
    <p role="status" className="rounded-lg bg-brand-50 p-3.5 text-[13.5px] text-text-primary">
      <strong>All of {duplicate.name}'s receipts will be re-pointed to {keep.name}.</strong>{" "}
      {duplicate.name} will be archived and tagged "Merged into {keep.name}". Receipt history is not deleted.
    </p>
  );
}

interface SupplierChoiceProps {
  legend: string;
  suppliers: Supplier[];
  selected: Supplier | null;
  onSelect: (supplier: Supplier) => void;
}

// Real radio inputs, as in ReasonPicker: arrow keys and screen-reader grouping come for free.
function SupplierChoice({ legend, suppliers, selected, onSelect }: SupplierChoiceProps) {
  const name = useId();

  if (suppliers.length === 0) {
    return <p className="text-[13.5px] text-text-secondary">There are no other active suppliers to choose from.</p>;
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-[13px] font-medium text-text-primary">{legend}</legend>
      {suppliers.map((supplier) => (
        <label
          key={supplier.id}
          className={clsx(
            "flex min-h-11 cursor-pointer flex-col justify-center rounded-lg border px-3.5 py-2.5 transition-colors duration-150",
            "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-400",
            selected?.id === supplier.id
              ? "border-brand-500 bg-brand-50"
              : "border-border-strong bg-surface-raised hover:bg-surface-sunken",
          )}
        >
          <input
            type="radio"
            name={name}
            checked={selected?.id === supplier.id}
            onChange={() => onSelect(supplier)}
            className="sr-only"
          />
          <span className="text-[14px] font-medium text-text-primary">{supplier.name}</span>
          <span className="text-[12.5px] text-text-secondary">{describeUsage(supplier)}</span>
        </label>
      ))}
    </fieldset>
  );
}

function describeUsage(supplier: Supplier): string {
  return [supplier.phone, pluralise(supplier.productCount, "linked product")].filter(Boolean).join(" · ");
}
