import { pluralise } from "./format";

interface UnitLabel {
  singular: string;
  plural: string;
}

// Keyed by the backend enum name. Typed as a string map (not the API's
// StockBaseUnit) so BOX and KIT work as soon as the backend sends them,
// independent of when the API types catch up.
const UNIT_LABELS: Record<string, UnitLabel> = {
  TABLET: { singular: "tablet", plural: "tablets" },
  CAPSULE: { singular: "capsule", plural: "capsules" },
  BOTTLE: { singular: "bottle", plural: "bottles" },
  VIAL: { singular: "vial", plural: "vials" },
  SEALED_PACK: { singular: "pack", plural: "packs" },
  BOX: { singular: "box", plural: "boxes" },
  KIT: { singular: "kit", plural: "kits" },
  EACH: { singular: "unit", plural: "units" },
};

function labelFor(unit: string): UnitLabel {
  const known = UNIT_LABELS[unit];
  if (known) return known;
  const readable = unit.toLowerCase().replace(/_/g, " ");
  return { singular: readable, plural: `${readable}s` };
}

/** `unitLabel("SEALED_PACK", 2)` -> `packs`; omit `count` for the singular form. */
export function unitLabel(unit: string, count = 1): string {
  const label = labelFor(unit);
  return count === 1 ? label.singular : label.plural;
}

/** `formatQuantity(90, "TABLET")` -> `90 tablets`. */
export function formatQuantity(quantity: number, unit: string): string {
  const label = labelFor(unit);
  return pluralise(quantity, label.singular, label.plural);
}

/** Whole packs needed to cover `quantity`. */
export function packsFor(quantity: number, packSize: number): number {
  if (quantity <= 0) return 0;
  return Math.ceil(quantity / Math.max(packSize, 1));
}

/** Smallest multiple of `packSize` that covers `quantity` (suppliers sell whole packs). */
export function roundUpToPack(quantity: number, packSize: number): number {
  return packsFor(quantity, packSize) * Math.max(packSize, 1);
}
