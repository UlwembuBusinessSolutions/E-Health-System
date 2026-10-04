import { useState } from "react";
import { Plus, Printer } from "lucide-react";
import type { CountLine, FoundLotPayload } from "@/shared/api/pharmacyCounts";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { useToast } from "@/shared/components/toast/ToastProvider";
import { ErrorState } from "../components/ErrorState";
import { SkeletonRows } from "../components/SkeletonRows";
import { describeError } from "../lib/problem";
import { totalsOf } from "./countMath";
import { AddFoundLotDialog } from "./AddFoundLotDialog";
import { CancelCountDialog } from "./CancelCountDialog";
import { CountSheet } from "./CountSheet";
import { PrintableCountSheet } from "./PrintableCountSheet";
import { useStockCount } from "./useStockCount";

interface CountStepProps {
  countId: string;
  onFinish: () => void;
  /** Leave the count as a draft to resume later. */
  onSaveForLater: () => void;
  onCancelled: () => void;
}

export function CountStep({ countId, onFinish, onSaveForLater, onCancelled }: CountStepProps) {
  const { showToast } = useToast();
  const { detail, setCounted, addFound, cancel, removeAsExpired } = useStockCount(countId, false);
  const [addingLot, setAddingLot] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  if (detail.isLoading) return <SkeletonRows rows={6} />;
  if (detail.error || !detail.data) {
    return <ErrorState message={describeError(detail.error)} onRetry={() => void detail.refetch()} />;
  }

  const count = detail.data;
  const { counted, total } = totalsOf(count.lines);
  const percent = total === 0 ? 0 : Math.round((counted / total) * 100);

  function addLot(lot: FoundLotPayload) {
    addFound.mutate(lot, {
      onSuccess: () => {
        setAddingLot(false);
        showToast("Lot added to the count.", "success");
      },
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[15px] font-semibold text-text-primary">
            {counted} of {total} lots counted
          </p>
          <p className="text-[13px] text-text-secondary">
            {count.reference} &middot; {count.scopeLabel}
          </p>
        </div>
        <div
          role="progressbar"
          aria-label="Lots counted"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={counted}
          className="mt-3 h-2 overflow-hidden rounded-full bg-surface-sunken"
        >
          <div className="h-full rounded-full bg-brand-500 transition-[width] duration-200" style={{ width: `${percent}%` }} />
        </div>
        <p className="mt-3 text-[13px] text-text-secondary">
          Count what is physically on the shelf, lot by lot. Enter 0 if a lot is gone.
          {count.blind && " The system quantity is hidden until the review step."}
        </p>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" icon={<Plus className="size-4" aria-hidden />} onClick={() => setAddingLot(true)}>
          Add a lot I found
        </Button>
        <Button variant="secondary" icon={<Printer className="size-4" aria-hidden />} onClick={() => window.print()}>
          Print count sheet
        </Button>
      </div>

      <CountSheet
        lines={count.lines}
        savingLineId={setCounted.isPending ? (setCounted.variables?.lineId ?? null) : null}
        onCount={(line: CountLine, quantity) => setCounted.mutate({ lineId: line.id, quantity })}
        onRemoveExpired={(line) => void removeAsExpired(line)}
      />

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle bg-surface-raised/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        <Button variant="ghost" onClick={() => setConfirmingCancel(true)}>
          Cancel count
        </Button>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={onSaveForLater}>
            Save and continue later
          </Button>
          <Button disabled={counted === 0} onClick={onFinish}>
            Finish counting
          </Button>
        </div>
      </div>

      <AddFoundLotDialog open={addingLot} saving={addFound.isPending} onSubmit={addLot} onClose={() => setAddingLot(false)} />
      <CancelCountDialog
        open={confirmingCancel}
        loading={cancel.isPending}
        onConfirm={() => cancel.mutate(undefined, { onSuccess: onCancelled })}
        onCancel={() => setConfirmingCancel(false)}
      />
      <PrintableCountSheet count={count} />
    </div>
  );
}
