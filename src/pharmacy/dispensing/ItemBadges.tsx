import type { PrescriptionItem } from "@/shared/api/pharmacy";
import { StatusPill } from "@/shared/components/StatusPill";
import { isFullyDispensed, isPartlyDispensed } from "./itemState";

// Every state is words as well as colour. Order is roughly "what needs attention first".
export function ItemBadges({ item }: { item: PrescriptionItem }) {
  const outOfStock = item.status === "OUT_OF_STOCK" && item.substitutionStatus !== "REQUESTED";
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {item.schedule && <StatusPill tone="neutral">{`Schedule ${item.schedule.slice(1)}`}</StatusPill>}
      {isPartlyDispensed(item) && <StatusPill tone="warning">{`Owing ${item.remainingQuantity}`}</StatusPill>}
      {item.returnedQuantity > 0 && <StatusPill tone="neutral">{`Returned ${item.returnedQuantity}`}</StatusPill>}
      {item.substitutionStatus === "REQUESTED" && <StatusPill tone="warning">Waiting for prescriber</StatusPill>}
      {outOfStock && <StatusPill tone="danger">Out of stock</StatusPill>}
      {isFullyDispensed(item) && <StatusPill tone="success">Dispensed</StatusPill>}
    </div>
  );
}

// One sentence that explains the badges above in plain language.
export function itemStatusNote(item: PrescriptionItem): string | null {
  if (item.substitutionStatus === "REQUESTED") return "Substitute not given until the prescriber approves.";
  if (isPartlyDispensed(item)) {
    return `Part dispensed: ${item.dispensedQuantity} of ${item.quantity}, ${item.remainingQuantity} still owed.`;
  }
  if (item.returnedQuantity > 0) {
    return `${item.returnedQuantity} of ${item.quantity} came back to the pharmacy.`;
  }
  if (item.status === "OUT_OF_STOCK" && item.outOfStockNote) return `Out of stock: ${item.outOfStockNote}`;
  return null;
}
