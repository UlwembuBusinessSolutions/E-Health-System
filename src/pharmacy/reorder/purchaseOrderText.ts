import type { PurchaseOrder } from "@/shared/api/pharmacyPlanning";
import { formatDate } from "../lib/format";

/** Plain text a pharmacist can paste into an email to the supplier. */
export function purchaseOrderEmailText(order: PurchaseOrder, facilityName: string): string {
  const lines = order.lines.map(
    (line) => `- ${line.productName}: ${line.packs} x ${line.packSize} = ${line.quantity} units`,
  );
  return [
    `Hello ${order.supplierName},`,
    "",
    `Please supply the following under purchase order ${order.poNumber}:`,
    "",
    ...lines,
    "",
    `Total: ${order.lines.length} lines, ${order.totalUnits} units.`,
    order.expectedDelivery ? `Expected delivery: ${formatDate(order.expectedDelivery)}.` : "",
    `Deliver to: ${facilityName}. Please quote ${order.poNumber} on the invoice.`,
    "",
    `Thank you,`,
    order.createdByName,
  ]
    .filter((line, index, all) => line !== "" || all[index - 1] !== "")
    .join("\n");
}
