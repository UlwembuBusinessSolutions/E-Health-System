import type { DispenseLot, Prescription, PrescriptionItem } from "@/shared/api/pharmacy";
import { daysUntil, formatDate, pluralise } from "../lib/format";

// Tighter than the shelf-wide 90-day "expires soon" colour: at the counter the
// question is whether the patient can finish the course before it expires.
const SHORT_DATED_DAYS = 30;

/** The lot stock will come from: the one the pharmacist picked, else first-expiring-first-out. */
export function activeLot(item: PrescriptionItem, chosenBatchId: string | null): DispenseLot | null {
  const chosen = item.usableLots.find((lot) => lot.batchId === chosenBatchId);
  return chosen ?? item.suggestedLot;
}

export function isFullyDispensed(item: PrescriptionItem): boolean {
  return item.status === "DISPENSED";
}

export function isPartlyDispensed(item: PrescriptionItem): boolean {
  return item.dispensedQuantity > 0 && item.remainingQuantity > 0;
}

/** Units handed over and not yet brought back. */
export function returnableQuantity(item: PrescriptionItem): number {
  return item.dispensedQuantity - item.returnedQuantity;
}

/** Unmapped items cannot be dispensed: there is no stock product to deduct from. */
export function isMapped(item: PrescriptionItem): boolean {
  return item.productId !== null;
}

/** True when the chosen lot covers everything still owed. */
export function canDispenseWhole(item: PrescriptionItem, lot: DispenseLot | null): boolean {
  return isMapped(item) && lot !== null && lot.available >= item.remainingQuantity;
}

export function hasUsableStock(item: PrescriptionItem): boolean {
  return isMapped(item) && item.usableLots.some((lot) => lot.available > 0);
}

/** Why the pharmacist should look twice at this item's stock, or null when nothing is wrong. */
export function lotAdvice(item: PrescriptionItem, lot: DispenseLot | null): string | null {
  if (isFullyDispensed(item)) return null;
  const expired = item.skippedExpiredLots;
  if (expired.length > 0) {
    const names = expired.map((l) => `${l.lot}${l.expiryDate ? ` (${formatDate(l.expiryDate)})` : ""}`).join(", ");
    return `Expired lot ${names} skipped. It can't be dispensed. Remove it from stock.`;
  }
  if (lot?.expiryDate) {
    const days = daysUntil(lot.expiryDate);
    if (days >= 0 && days <= SHORT_DATED_DAYS) {
      return `Lot ${lot.lot} expires ${formatDate(lot.expiryDate)} (${pluralise(days, "day")}). Tell the patient to use it soon.`;
    }
  }
  return null;
}

/** Items a "Confirm collection" would hand over right now. */
export function collectableItems(prescription: Prescription): PrescriptionItem[] {
  return prescription.items.filter((item) => !isFullyDispensed(item) && hasUsableStock(item));
}

/** Items still owed that the collection will skip for lack of stock or a product link. */
export function blockedItems(prescription: Prescription): PrescriptionItem[] {
  return prescription.items.filter((item) => !isFullyDispensed(item) && !hasUsableStock(item));
}
