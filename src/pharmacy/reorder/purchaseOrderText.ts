import type { PurchaseOrder } from "@/shared/api/pharmacyPlanning";
import { formatDate } from "../lib/format";

/** Plain text a pharmacist can paste into an email to the supplier. */
export function purchaseOrderEmailText(order: PurchaseOrder, expectedDelivery: string): string {
  const lines = order.lines.map((line) => {
    const name = [line.name, line.sub].filter(Boolean).join(" ");
    return `- ${name}: ${line.packs} x ${line.packSize} = ${line.quantity} units`;
  });
  return [
    `Hello ${order.supplier.name},`,
    "",
    `Please supply the following under purchase order ${order.poNumber}:`,
    "",
    ...lines,
    "",
    `Total: ${order.lines.length} lines, ${order.totalUnits} units.`,
    expectedDelivery ? `Expected delivery: ${formatDate(expectedDelivery)}.` : "",
    `Deliver to: ${order.facilityName}. Please quote ${order.poNumber} on the invoice.`,
    "",
    `Thank you,`,
    order.raisedByName,
  ]
    .filter((line, index, all) => line !== "" || all[index - 1] !== "")
    .join("\n");
}
