import type { PurchaseOrderLinePayload, ReorderLine } from "@/shared/api/pharmacyPlanning";
import { packsFor } from "../lib/units";

// Order quantities are kept in units (tablets, vials...), but suppliers sell
// whole packs, so the rules about packs live here, away from the screen.

/** Units the person has chosen per product; a missing entry means "use the suggestion". */
export type QuantityOverrides = Readonly<Record<string, number>>;

/** A product that isn't sold in packs is ordered one unit at a time. */
export function packSizeOf(line: ReorderLine): number {
  return line.packSize ?? 1;
}

export function quantityFor(line: ReorderLine, overrides: QuantityOverrides): number {
  return overrides[line.productId] ?? line.suggestedQuantity;
}

export function isWholePacks(quantity: number, packSize: number): boolean {
  return quantity % Math.max(packSize, 1) === 0;
}

export interface OrderTotals {
  lineCount: number;
  units: number;
  /** Lines with a quantity that is not a whole number of packs; the order cannot be created until fixed. */
  brokenPackLines: number;
}

export function totalsFor(lines: ReorderLine[], overrides: QuantityOverrides): OrderTotals {
  return lines.reduce<OrderTotals>(
    (totals, line) => {
      const quantity = quantityFor(line, overrides);
      if (quantity <= 0) return totals;
      return {
        lineCount: totals.lineCount + 1,
        units: totals.units + quantity,
        brokenPackLines: totals.brokenPackLines + (isWholePacks(quantity, packSizeOf(line)) ? 0 : 1),
      };
    },
    { lineCount: 0, units: 0, brokenPackLines: 0 },
  );
}

/** The lines that go on the order, as the server wants them: anything set to 0 stays off. */
export function orderLinePayloads(lines: ReorderLine[], overrides: QuantityOverrides): PurchaseOrderLinePayload[] {
  return lines.flatMap((line) => {
    const quantity = quantityFor(line, overrides);
    if (quantity <= 0) return [];
    const packSize = packSizeOf(line);
    return [{ productId: line.productId, packs: packsFor(quantity, packSize), packSize, quantity }];
  });
}

export function packNote(quantity: number, packSize: number): string {
  if (quantity <= 0) return "Not on this order";
  const packs = packsFor(quantity, packSize);
  return isWholePacks(quantity, packSize)
    ? `${packs} × pack of ${packSize}`
    : `Not whole packs. Packs come in ${packSize}.`;
}
