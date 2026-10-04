import { useRef } from "react";
import { describeError } from "@/pharmacy/lib/problem";
import { formatDate } from "@/pharmacy/lib/format";
import { useToast } from "@/shared/components/toast/ToastProvider";
import type { LedgerMovement, ReversePayload } from "@/shared/api/pharmacyLedger";
import { useCurrentBalance } from "./hooks/useCurrentBalance";
import { useReverseTransaction } from "./hooks/useReversals";
import { ReverseDialog } from "./ReverseDialog";

interface ReverseMovementDialogProps {
  facilityId: string;
  movement: LedgerMovement;
  onClose: () => void;
  onReversed: (movement: LedgerMovement) => void;
}

// Mounted only while a row's Reverse is open (see MovementsTab), which is what
// gives each opening its own idempotency key.
export function ReverseMovementDialog({ facilityId, movement, onClose, onReversed }: ReverseMovementDialogProps) {
  const { showToast } = useToast();
  const idempotencyKey = useRef(crypto.randomUUID());
  const balance = useCurrentBalance(facilityId, movement.productId, true);
  const mutation = useReverseTransaction();

  function reverse(payload: ReversePayload) {
    mutation.mutate(
      { id: movement.id, payload, idempotencyKey: idempotencyKey.current },
      {
        onSuccess: () => {
          showToast(`Reversed the receipt of ${movement.productName}.`, "success");
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
      title="Reverse this receipt line"
      summary={
        <>
          <strong>{movement.quantityDelta.toLocaleString("en-ZA")}</strong> × {movement.productName}
          {movement.lotNumber && <>, lot {movement.lotNumber}</>}
          {movement.supplierName && <>, from {movement.supplierName}</>}, received {formatDate(movement.createdAt)}.
        </>
      }
      preview={preview}
      confirmLabel="Reverse line"
      pending={mutation.isPending}
      errorMessage={mutation.isError ? describeError(mutation.error) : null}
      onConfirm={reverse}
      onClose={onClose}
    />
  );
}
