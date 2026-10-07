import { Printer, Undo2 } from "lucide-react";
import { ErrorState } from "@/pharmacy/components/ErrorState";
import { ExpiryText } from "@/pharmacy/components/ExpiryText";
import { SkeletonRows } from "@/pharmacy/components/SkeletonRows";
import { describeError } from "@/pharmacy/lib/problem";
import { Button } from "@/shared/components/Button";
import type { ReceiptDetail, ReceiptSummary } from "@/shared/api/pharmacyLedger";
import { useReceiptDetail } from "./hooks/useReceipts";
import { ReceiptStatusPill } from "./ReceiptStatusPill";

interface ReceiptRowProps {
  receipt: ReceiptSummary;
  onPrint: (receipt: ReceiptDetail) => void;
  onReverse: (receipt: ReceiptSummary) => void;
}

function reverseBlockedNote(receipt: ReceiptSummary): string | null {
  if (receipt.status === "REVERSED") return "This receipt has already been reversed.";
  if (receipt.usedStock) {
    return "Some of this stock has already been used, so the whole receipt can't be reversed. Remove what is left with a stock adjustment instead.";
  }
  return null;
}

// The expanded part of a receipt: its lines, and the two receipt-level actions.
export function ReceiptRow({ receipt, onPrint, onReverse }: ReceiptRowProps) {
  const detail = useReceiptDetail(receipt.id, true);
  const blockedNote = reverseBlockedNote(receipt);

  if (detail.isLoading) return <SkeletonRows rows={3} />;
  if (detail.isError || !detail.data) {
    return <ErrorState message={describeError(detail.error)} onRetry={() => void detail.refetch()} />;
  }
  const lines = detail.data.lines;

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto">
        <table aria-label={`Lines on receipt ${receipt.receiptNumber}`} className="w-full min-w-[28rem] text-[13.5px]">
          <thead>
            <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
              <th scope="col" className="py-2 pr-4">Product</th>
              <th scope="col" className="py-2 pr-4">Lot</th>
              <th scope="col" className="py-2 pr-4">Expiry</th>
              <th scope="col" className="py-2 pr-4 text-right">Quantity</th>
              <th scope="col" className="py-2">State</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {lines.map((line) => (
              <tr key={line.id}>
                <td className="py-2 pr-4 font-medium text-text-primary">{line.productName}</td>
                <td className="py-2 pr-4">{line.lotNumber}</td>
                <td className="py-2 pr-4">{line.expiryDate ? <ExpiryText date={line.expiryDate} /> : "—"}</td>
                <td className="py-2 pr-4 text-right tabular-nums">{line.quantity.toLocaleString("en-ZA")}</td>
                <td className="py-2">
                  <ReceiptStatusPill state={line.state} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          icon={<Printer className="size-4" aria-hidden />}
          onClick={() => onPrint(detail.data)}
        >
          Print goods-received note
        </Button>
        <Button
          variant="danger"
          icon={<Undo2 className="size-4" aria-hidden />}
          disabled={blockedNote !== null}
          aria-describedby={blockedNote ? `reverse-note-${receipt.id}` : undefined}
          onClick={() => onReverse(receipt)}
        >
          Reverse whole receipt
        </Button>
      </div>
      {blockedNote && (
        <p id={`reverse-note-${receipt.id}`} className="text-[13px] text-text-secondary">
          {blockedNote}
        </p>
      )}
    </div>
  );
}
