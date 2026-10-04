import type { ReorderLine } from "@/shared/api/pharmacyPlanning";
import { packsFor } from "../lib/units";

// Order quantities are kept in units (tablets, vials...), but suppliers sell
// whole packs, so the rules about packs live here, away from the screen.

/** Units the person has chosen per product; a missing entry means "use the suggestion". */
export type QuantityOverrides = Readonly<Record<string, number>>;

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
        brokenPackLines: totals.brokenPackLines + (isWholePacks(quantity, line.packSize) ? 0 : 1),
      };
    },
    { lineCount: 0, units: 0, brokenPackLines: 0 },
  );
}

/** The lines that will actually go on the order: anything set to 0 stays off. */
export function orderedLines(lines: ReorderLine[], overrides: QuantityOverrides) {
  return lines
    .map((line) => ({ line, quantity: quantityFor(line, overrides) }))
    .filter(({ quantity }) => quantity > 0);
}

export function packNote(quantity: number, packSize: number): string {
  if (quantity <= 0) return "Not on this order";
  const packs = packsFor(quantity, packSize);
  return isWholePacks(quantity, packSize)
    ? `${packs} × pack of ${packSize}`
    : `Not whole packs. Packs come in ${packSize}.`;
}
