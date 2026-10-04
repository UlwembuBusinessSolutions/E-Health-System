import { useRef } from "react";
import { formatDate, pluralise } from "@/pharmacy/lib/format";
import { describeError } from "@/pharmacy/lib/problem";
import { useToast } from "@/shared/components/toast/ToastProvider";
import type { ReceiptSummary, ReversePayload } from "@/shared/api/pharmacyLedger";
import { useReverseReceipt } from "./hooks/useReversals";
import { ReverseDialog } from "./ReverseDialog";

interface ReverseReceiptDialogProps {
  receipt: ReceiptSummary;
  onClose: () => void;
}

// Mounted only while open, so each opening gets a fresh idempotency key.
export function ReverseReceiptDialog({ receipt, onClose }: ReverseReceiptDialogProps) {
  const { showToast } = useToast();
  const idempotencyKey = useRef(crypto.randomUUID());
  const mutation = useReverseReceipt();

  function reverse(payload: ReversePayload) {
    mutation.mutate(
      { id: receipt.id, payload, idempotencyKey: idempotencyKey.current },
      {
        onSuccess: () => {
          showToast(`Receipt ${receipt.receiptNumber} reversed.`, "success");
          onClose();
        },
      },
    );
  }

  return (
    <ReverseDialog
      title="Reverse the whole receipt"
      summary={
        <>
          Receipt <strong>{receipt.receiptNumber}</strong>
          {receipt.supplierName && <> from {receipt.supplierName}</>}, received {formatDate(receipt.receivedAt)}:{" "}
          {pluralise(receipt.lineCount, "product")}, {pluralise(receipt.totalUnits, "unit")}.
        </>
      }
      preview="Every line comes off the shelf together, or none do."
      confirmLabel="Reverse receipt"
      pending={mutation.isPending}
      errorMessage={mutation.isError ? describeError(mutation.error) : null}
      onConfirm={reverse}
      onClose={onClose}
    />
  );
}
