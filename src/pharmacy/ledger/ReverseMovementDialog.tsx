import { describeError } from "@/pharmacy/lib/problem";
import { formatDate } from "@/pharmacy/lib/format";
import { useToast } from "@/shared/components/toast/ToastProvider";
import type { LedgerMovement, ReversePayload } from "@/shared/api/pharmacyLedger";
import { useCurrentBalance } from "./hooks/useCurrentBalance";
import { useReverseTransaction } from "./hooks/useReversals";
import { EVENT_LABELS, eventKindOf, signedChange } from "./lib/movementEvents";
import { ReverseDialog } from "./ReverseDialog";

interface ReverseMovementDialogProps {
  facilityId: string;
  movement: LedgerMovement;
  onClose: () => void;
  onReversed: (movement: LedgerMovement) => void;
}

// Mounted only while a row's Reverse is open (see MovementsTab), so every
// opening starts with a blank form.
export function ReverseMovementDialog({ facilityId, movement, onClose, onReversed }: ReverseMovementDialogProps) {
  const { showToast } = useToast();
  const balance = useCurrentBalance(facilityId, movement.productId, true);
  const mutation = useReverseTransaction();

  function reverse(payload: ReversePayload) {
    // The server reverses the whole transaction this entry belongs to.
    mutation.mutate(
      { transactionId: movement.transactionId, payload },
      {
        onSuccess: () => {
          showToast(`Reversed the entry for ${movement.productName}.`, "success");
          onReversed(movement);
        },
      },
    );
  }

  const before = balance.data ?? null;
  const preview =
    before === null
      ? undefined
      : `Stock of ${movement.productName} goes from ${before.toLocaleString("en-ZA")} to ${(before - movement.quantityDelta).toLocaleString("en-ZA")}.`;

  return (
    <ReverseDialog
      title="Reverse this entry"
      summary={
        <>
          {EVENT_LABELS[eventKindOf(movement.type)]} <strong>{signedChange(movement.quantityDelta)}</strong> ×{" "}
          {movement.productName}, lot {movement.lotNumber}, on {formatDate(movement.createdAt)}.
        </>
      }
      preview={preview}
      confirmLabel="Reverse entry"
      pending={mutation.isPending}
      errorMessage={mutation.isError ? describeError(mutation.error) : null}
      onConfirm={reverse}
      onClose={onClose}
    />
  );
}
