import { useEffect } from "react";
import { createPortal } from "react-dom";
import { formatDate, formatDateTime } from "@/pharmacy/lib/format";
import type { ReceiptDetail } from "@/shared/api/pharmacyLedger";
import { receiptStatusLabel } from "./ReceiptStatusPill";

const PRINT_ROOT_ID = "goods-received-note";

// Hides the whole app during printing and shows only the note. Done with a
// scoped style rather than a separate window so it needs no new route and
// works with popup blockers.
const PRINT_ONLY_CSS = `
  #${PRINT_ROOT_ID} { display: none; }
  @media print {
    body > *:not(#${PRINT_ROOT_ID}) { display: none !important; }
    #${PRINT_ROOT_ID} { display: block; color: #000; background: #fff; padding: 24px; font-size: 12pt; }
  }
`;

interface ReceiptPrintViewProps {
  receipt: ReceiptDetail;
  /** Called once the print dialog closes, whether printed or cancelled. */
  onDone: () => void;
}

export function ReceiptPrintView({ receipt, onDone }: ReceiptPrintViewProps) {
  useEffect(() => {
    window.addEventListener("afterprint", onDone, { once: true });
    window.print();
    return () => window.removeEventListener("afterprint", onDone);
  }, [onDone]);

  return createPortal(
    <section id={PRINT_ROOT_ID} aria-hidden>
      <style>{PRINT_ONLY_CSS}</style>
      <h1 style={{ fontSize: "18pt", fontWeight: 700 }}>Goods-received note</h1>
      <p style={{ marginBottom: 16 }}>Receipt {receipt.receiptNumber}</p>
      <dl style={{ display: "grid", gridTemplateColumns: "10rem 1fr", gap: "4px 16px", marginBottom: 16 }}>
        <dt>Supplier</dt>
        <dd>{receipt.supplierName ?? "—"}</dd>
        <dt>Invoice number</dt>
        <dd>{receipt.invoiceNumber ?? "—"}</dd>
        <dt>Received</dt>
        <dd>{formatDateTime(receipt.receivedAt)}</dd>
        <dt>Received by</dt>
        <dd>{receipt.receivedByName}</dd>
        <dt>Status</dt>
        <dd>{receiptStatusLabel(receipt.status)}</dd>
      </dl>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {["Product", "Lot", "Expiry", "Quantity"].map((heading) => (
              <th key={heading} style={{ textAlign: "left", borderBottom: "1px solid #000", padding: "4px 8px 4px 0" }}>
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {receipt.lines.map((line) => (
            <tr key={line.id}>
              <td style={{ padding: "4px 8px 4px 0" }}>{line.productName}</td>
              <td style={{ padding: "4px 8px 4px 0" }}>{line.lotNumber ?? "—"}</td>
              <td style={{ padding: "4px 8px 4px 0" }}>{line.expiryDate ? formatDate(line.expiryDate) : "—"}</td>
              <td style={{ padding: "4px 0" }}>{line.quantity.toLocaleString("en-ZA")}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ marginTop: 16 }}>Total units: {receipt.totalUnits.toLocaleString("en-ZA")}</p>
      <p style={{ marginTop: 48 }}>Checked by (signature): ______________________________</p>
    </section>,
    document.body,
  );
}
