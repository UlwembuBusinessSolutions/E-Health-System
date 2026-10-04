import { useState } from "react";
import { ArrowLeft, Copy, Printer } from "lucide-react";
import type { PurchaseOrder } from "@/shared/api/pharmacyPlanning";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { Input } from "@/shared/components/Input";
import { useToast } from "@/shared/components/toast/ToastProvider";
import { PrintArea } from "../components/PrintArea";
import { formatDate } from "../lib/format";
import { purchaseOrderEmailText } from "./purchaseOrderText";

interface PurchaseOrderViewProps {
  order: PurchaseOrder;
  onBack: () => void;
}

export function PurchaseOrderView({ order, onBack }: PurchaseOrderViewProps) {
  const { showToast } = useToast();
  // The expected date is typed after the order exists, so it only shapes what
  // is printed or copied for the supplier; the order record itself is unchanged.
  const [expected, setExpected] = useState(order.expectedDelivery ?? "");

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(purchaseOrderEmailText(order, expected));
      showToast("Email text copied.", "success");
    } catch {
      showToast("Couldn't copy. Select the order and copy it by hand.", "error");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <Button variant="ghost" icon={<ArrowLeft className="size-4" aria-hidden />} onClick={onBack}>
          Back to the list
        </Button>
        <div className="flex flex-wrap items-end gap-3">
          <Input label="Expected delivery" type="date" value={expected} onChange={(event) => setExpected(event.target.value)} />
          <Button variant="secondary" icon={<Copy className="size-4" aria-hidden />} onClick={() => void copyEmail()}>
            Copy as email text
          </Button>
          <Button icon={<Printer className="size-4" aria-hidden />} onClick={() => window.print()}>
            Print
          </Button>
        </div>
      </div>

      <PrintArea visibleOnScreen>
        <Card className="p-6 print:border-0 print:p-8 print:shadow-none">
          <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border-subtle pb-4">
            <div>
              <h2 className="text-[20px] font-semibold text-text-primary">Purchase order</h2>
              <p className="text-[15px] font-semibold tabular-nums text-text-primary">{order.poNumber}</p>
            </div>
            <div className="text-[13.5px] text-text-secondary sm:text-right">
              <p>{order.facilityName}</p>
              <p>Date: {formatDate(order.createdAt)}</p>
              <p>Raised by: {order.raisedByName}</p>
            </div>
          </header>

          <div className="grid gap-4 py-4 text-[13.5px] sm:grid-cols-2">
            <section aria-label="Supplier">
              <h3 className="text-[12px] font-semibold uppercase tracking-wide text-text-secondary">Supplier</h3>
              <p className="font-medium text-text-primary">{order.supplier.name}</p>
              <p className="text-text-secondary">{[order.supplier.phone, order.supplier.email].filter(Boolean).join(" · ")}</p>
            </section>
            <section aria-label="Deliver to">
              <h3 className="text-[12px] font-semibold uppercase tracking-wide text-text-secondary">Deliver to</h3>
              <p className="font-medium text-text-primary">{order.facilityName}</p>
              <p className="text-text-secondary">
                {expected ? `Expected ${formatDate(expected)}. ` : ""}Please quote {order.poNumber} on the invoice.
              </p>
            </section>
          </div>

          <table aria-label="Items ordered" className="w-full text-[13.5px]">
            <thead>
              <tr className="border-b border-border-subtle text-left text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                <th scope="col" className="py-2 pr-3">Item</th>
                <th scope="col" className="py-2 pr-3">Packs</th>
                <th scope="col" className="py-2 text-right">Units</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {order.lines.map((line) => (
                <tr key={line.productId}>
                  <td className="py-2.5 pr-3">
                    <span className="font-medium text-text-primary">{line.name}</span>
                    {line.sub && <span className="block text-[12.5px] text-text-secondary">{line.sub}</span>}
                  </td>
                  <td className="py-2.5 pr-3 tabular-nums">{line.packs} &times; {line.packSize}</td>
                  <td className="py-2.5 text-right tabular-nums">{line.quantity}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border-strong font-semibold">
                <td className="py-2.5" colSpan={2}>
                  Total &middot; {order.lines.length} {order.lines.length === 1 ? "line" : "lines"}
                </td>
                <td className="py-2.5 text-right tabular-nums">{order.totalUnits} units</td>
              </tr>
            </tfoot>
          </table>
          <p className="mt-4 text-[12.5px] text-text-secondary">Prices follow your agreed supplier terms.</p>
        </Card>
      </PrintArea>
    </div>
  );
}
