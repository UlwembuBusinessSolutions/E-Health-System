import { useEffect } from "react";
import { PrintArea } from "@/pharmacy/components/PrintArea";
import { formatDate, formatDateTime } from "@/pharmacy/lib/format";
import type { ReceiptDetail } from "@/shared/api/pharmacyLedger";
import { receiptStanding, receiptStateLabel } from "./ReceiptStatusPill";

interface ReceiptPrintViewProps {
  receipt: ReceiptDetail;
  /** Called once the print dialog closes, whether printed or cancelled. */
  onDone: () => void;
}

const CELL = "py-1 pr-3";

// Rendered on paper only (PrintArea hides everything else), so it needs no
// route and, unlike a separate window, works with popup blockers.
export function ReceiptPrintView({ receipt, onDone }: ReceiptPrintViewProps) {
  useEffect(() => {
    window.addEventListener("afterprint", onDone, { once: true });
    window.print();
    return () => window.removeEventListener("afterprint", onDone);
  }, [onDone]);

  return (
    <PrintArea className="p-6 text-[12pt]">
      <h1 className="text-[18pt] font-bold">Goods-received note</h1>
      <p className="mb-4">Receipt {receipt.receiptNumber}</p>
      <dl className="mb-4 grid grid-cols-[10rem_1fr] gap-x-4 gap-y-1">
        <dt>Supplier</dt>
        <dd>{receipt.supplierName ?? "—"}</dd>
        <dt>Invoice number</dt>
        <dd>{receipt.invoiceNumber ?? "—"}</dd>
        <dt>Received</dt>
        <dd>{formatDateTime(receipt.receivedAt)}</dd>
        <dt>Received by</dt>
        <dd>{receipt.receivedByName}</dd>
        <dt>Status</dt>
        <dd>{receiptStateLabel(receiptStanding(receipt))}</dd>
      </dl>
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-left">
            {["Product", "Lot", "Expiry", "Quantity"].map((heading) => (
              <th key={heading} className={`border-b border-black ${CELL}`}>
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {receipt.lines.map((line) => (
            <tr key={line.id}>
              <td className={CELL}>{line.productName}</td>
              <td className={CELL}>{line.lotNumber}</td>
              <td className={CELL}>{line.expiryDate ? formatDate(line.expiryDate) : "—"}</td>
              <td className="py-1">{line.quantity.toLocaleString("en-ZA")}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4">Total units: {receipt.totalUnits.toLocaleString("en-ZA")}</p>
      <p className="mt-12">Checked by (signature): ______________________________</p>
    </PrintArea>
  );
}
