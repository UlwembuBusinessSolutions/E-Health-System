import { ArrowLeft, Copy, Printer, ShieldCheck, Send } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/auth/AuthContext";
import { authorizePurchaseOrder, rejectPurchaseOrder, submitPurchaseOrder,
  type PurchaseOrder, type ReorderSupplier } from "@/shared/api/pharmacyPlanning";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { useToast } from "@/shared/components/toast/ToastProvider";
import { PrintArea } from "../components/PrintArea";
import { formatDate } from "../lib/format";
import { purchaseOrderEmailText } from "./purchaseOrderText";
import { describeError } from "../lib/problem";

interface PurchaseOrderViewProps {
  order: PurchaseOrder;
  /** The server's order names only ids; the screen already knows these two. */
  facilityName: string;
  supplier: ReorderSupplier;
  onBack: () => void;
}

export function PurchaseOrderView({ order, facilityName, supplier, onBack }: PurchaseOrderViewProps) {
  const { showToast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [current, setCurrent] = useState(order);
  const isFacilityManager = user?.role === "Facility Manager";
  const isOrderCreator = user?.id === current.createdById;
  const procurementNotConfigured = !current.catalogueSubmissionAvailable;
  const isEligibleForSubmission = current.status === "AUTHORIZED" || current.status === "TRANSMISSION_FAILED";
  const canPrepareManualOrder = current.status === "SUBMITTED"
    || (procurementNotConfigured && isEligibleForSubmission);
  const canRetrySubmission = current.catalogueSubmissionAvailable && isEligibleForSubmission;
  const action = useMutation({
    mutationFn: (kind: "authorize" | "reject" | "submit") => kind === "authorize"
      ? authorizePurchaseOrder(current.id)
      : kind === "reject" ? rejectPurchaseOrder(current.id) : submitPurchaseOrder(current.id),
    onSuccess: async (next) => {
      setCurrent(next);
      await queryClient.invalidateQueries({ queryKey: ["pharmacy", "purchase-orders"] });
      showToast(next.status === "TRANSMISSION_FAILED"
        ? (next.transmissionError ?? "Catalogue transmission failed; order remains unsubmitted.")
        : `Purchase order is now ${next.status.toLowerCase().replaceAll("_", " ")}.`,
        next.status === "TRANSMISSION_FAILED" ? "error" : "success");
    },
    onError: (error) => showToast(describeError(error), "error"),
  });

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(purchaseOrderEmailText(current, facilityName));
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
          <Button disabled={!canPrepareManualOrder} variant="secondary" icon={<Copy className="size-4" aria-hidden />} onClick={() => void copyEmail()}>
            Copy as email text
          </Button>
          <Button disabled={!canPrepareManualOrder} icon={<Printer className="size-4" aria-hidden />} onClick={() => window.print()}>
            Print
          </Button>
        </div>
      </div>

      <Card className="p-4 no-print">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold">Approval status: {current.status.replaceAll("_", " ")}</p>
            {current.authorizedAt && <p className="text-sm text-text-secondary">Authorized by {current.authorizedByName} on {formatDate(current.authorizedAt)}</p>}
            {current.submittedAt && <p className="text-sm text-text-secondary">Submitted {formatDate(current.submittedAt)} · Catalogue reference: {current.catalogueReference}</p>}
            {current.transmissionError && !(current.catalogueSubmissionAvailable
              && (current.transmissionError === "Master Procurement Catalogue HTTPS orders URL is not configured"
                || current.transmissionError === "Master Procurement Catalogue credentials are not configured"))
              && <p role="alert" className="text-sm text-red-600">{current.transmissionError}</p>}
            {procurementNotConfigured && isEligibleForSubmission && <p className="text-sm text-text-secondary">Catalogue submission is not configured. This order has not been sent. Ask your administrator to configure the procurement gateway, then reopen the order to retry; or copy the email text or print it for manual ordering.</p>}
            {current.status === "DRAFT" && <p className="text-sm text-text-secondary">An eligible Facility Manager must authorize this order before procurement submission.</p>}
            {current.status === "DRAFT" && isOrderCreator && <p className="text-sm text-text-secondary">The person who raised this order cannot authorize it.</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {isFacilityManager && current.status === "DRAFT" && <>
              <Button variant="secondary" loading={action.isPending} onClick={() => action.mutate("reject")}>Reject</Button>
              {!isOrderCreator && <Button loading={action.isPending} icon={<ShieldCheck className="size-4"/>} onClick={() => action.mutate("authorize")}>Authorize</Button>}
            </>}
            {canRetrySubmission && <Button
              loading={action.isPending} icon={<Send className="size-4"/>} onClick={() => action.mutate("submit")}>Submit to Master Procurement Catalogue</Button>}
          </div>
        </div>
      </Card>
      <PrintArea visibleOnScreen>
        <Card className="p-6 print:border-0 print:p-8 print:shadow-none">
          <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border-subtle pb-4">
            <div>
              <h2 className="text-[20px] font-semibold text-text-primary">Purchase order</h2>
              <p className="text-[15px] font-semibold tabular-nums text-text-primary">{current.poNumber}</p>
            </div>
            <div className="text-[13.5px] text-text-secondary sm:text-right">
              <p>{facilityName}</p>
              <p>Date: {formatDate(current.createdAt)}</p>
              <p>Raised by: {current.createdByName}</p>
            </div>
          </header>

          <div className="grid gap-4 py-4 text-[13.5px] sm:grid-cols-2">
            <section aria-label="Supplier">
              <h3 className="text-[12px] font-semibold uppercase tracking-wide text-text-secondary">Supplier</h3>
              <p className="font-medium text-text-primary">{current.supplierName}</p>
              <p className="text-text-secondary">{[supplier.phone, supplier.email].filter(Boolean).join(" · ")}</p>
            </section>
            <section aria-label="Deliver to">
              <h3 className="text-[12px] font-semibold uppercase tracking-wide text-text-secondary">Deliver to</h3>
              <p className="font-medium text-text-primary">{facilityName}</p>
              <p className="text-text-secondary">
                {current.expectedDelivery ? `Expected ${formatDate(current.expectedDelivery)}. ` : ""}Please quote {current.poNumber} on the invoice.
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
              {current.lines.map((line) => (
                <tr key={line.productId}>
                  <td className="py-2.5 pr-3">
                    <span className="font-medium text-text-primary">{line.productName}</span>
                  </td>
                  <td className="py-2.5 pr-3 tabular-nums">{line.packs} &times; {line.packSize}</td>
                  <td className="py-2.5 text-right tabular-nums">{line.quantity}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border-strong font-semibold">
                <td className="py-2.5" colSpan={2}>
                  Total &middot; {current.lines.length} {current.lines.length === 1 ? "line" : "lines"}
                </td>
                <td className="py-2.5 text-right tabular-nums">{current.totalUnits} units</td>
              </tr>
            </tfoot>
          </table>
          <p className="mt-4 text-[12.5px] text-text-secondary">Prices follow your agreed supplier terms.</p>
        </Card>
      </PrintArea>
    </div>
  );
}
