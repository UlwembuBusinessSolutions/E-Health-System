import type { PharmacyItemPayload, PurchaseItemPayload } from "@/shared/api/consultations";
import type { Medicine, StockLevel } from "@/shared/api/prescribing";

// The prescription being written, kept as plain data with pure helpers so the
// rules (never more than the shelf holds, the rest goes on the buy list) are
// easy to read and change in one place.

/** A medicine the pharmacy will hand over. */
export interface StockLine {
  key: string;
  productId: string;
  name: string;
  dosage: string;
  quantity: number;
  /** What the shelf held when the medicine was picked; the server checks again on signing. */
  available: number;
  level: StockLevel;
}

/** A medicine the patient will buy instead. */
export interface BuyLine {
  key: string;
  /** Set when it was picked from the pharmacy's list (and was out or short). */
  productId: string | null;
  name: string;
  dosage: string;
  quantity: number;
  note: string;
}

export interface PrescriptionDraft {
  stockLines: StockLine[];
  buyLines: BuyLine[];
}

export const EMPTY_DRAFT: PrescriptionDraft = { stockLines: [], buyLines: [] };

export const DOSAGE_PRESETS = ["1 daily", "1 twice daily", "1 three times daily", "1 at night", "As needed"];

function newKey(): string {
  return crypto.randomUUID();
}

/** Units already asked of one product across all its lines. */
export function unitsAskedOf(draft: PrescriptionDraft, productId: string, exceptKey?: string): number {
  return draft.stockLines
    .filter((line) => line.productId === productId && line.key !== exceptKey)
    .reduce((total, line) => total + line.quantity, 0);
}

/** The most this line may ask for: what the shelf holds minus what other lines of the same product take. */
export function maxQuantityFor(draft: PrescriptionDraft, line: StockLine): number {
  return Math.max(0, line.available - unitsAskedOf(draft, line.productId, line.key));
}

/** What a stock line needs to know about a medicine; an alternative offers the same. */
export type StockSource = Pick<Medicine, "productId" | "name" | "available" | "level">;

export function addStockLine(draft: PrescriptionDraft, medicine: StockSource): PrescriptionDraft {
  if (medicine.available <= 0) return draft;
  const existing = draft.stockLines.find((line) => line.productId === medicine.productId);
  if (existing) return draft;
  const line: StockLine = {
    key: newKey(),
    productId: medicine.productId,
    name: medicine.name,
    dosage: "",
    quantity: 1,
    available: medicine.available,
    level: medicine.level,
  };
  return { ...draft, stockLines: [...draft.stockLines, line] };
}

export function addBuyLine(draft: PrescriptionDraft, partial: Partial<BuyLine> = {}): PrescriptionDraft {
  const line: BuyLine = { key: newKey(), productId: null, name: "", dosage: "", quantity: 1, note: "", ...partial };
  return { ...draft, buyLines: [...draft.buyLines, line] };
}

export function updateStockLine(draft: PrescriptionDraft, key: string, changes: Partial<StockLine>): PrescriptionDraft {
  return { ...draft, stockLines: draft.stockLines.map((line) => (line.key === key ? { ...line, ...changes } : line)) };
}

export function updateBuyLine(draft: PrescriptionDraft, key: string, changes: Partial<BuyLine>): PrescriptionDraft {
  return { ...draft, buyLines: draft.buyLines.map((line) => (line.key === key ? { ...line, ...changes } : line)) };
}

export function removeStockLine(draft: PrescriptionDraft, key: string): PrescriptionDraft {
  return { ...draft, stockLines: draft.stockLines.filter((line) => line.key !== key) };
}

export function removeBuyLine(draft: PrescriptionDraft, key: string): PrescriptionDraft {
  return { ...draft, buyLines: draft.buyLines.filter((line) => line.key !== key) };
}

/** How many more units a line asks for than the shelf can give; 0 when it fits. */
export function shortfallOf(draft: PrescriptionDraft, line: StockLine): number {
  return Math.max(0, line.quantity - maxQuantityFor(draft, line));
}

/**
 * "Take what is there, buy the rest": caps the line at what the shelf holds and
 * puts the remainder on the buy list for the same product.
 */
export function splitShortfall(draft: PrescriptionDraft, key: string): PrescriptionDraft {
  const line = draft.stockLines.find((candidate) => candidate.key === key);
  if (!line) return draft;
  const shortfall = shortfallOf(draft, line);
  if (shortfall === 0) return draft;
  const capped = line.quantity - shortfall;
  const withoutLine = capped > 0 ? updateStockLine(draft, key, { quantity: capped }) : removeStockLine(draft, key);
  const existingBuy = withoutLine.buyLines.find((buy) => buy.productId === line.productId);
  if (existingBuy) {
    return updateBuyLine(withoutLine, existingBuy.key, { quantity: existingBuy.quantity + shortfall });
  }
  return addBuyLine(withoutLine, { productId: line.productId, name: line.name, dosage: line.dosage, quantity: shortfall });
}

/** Everything that stops the prescription being sent, in plain words. Empty means it can go. */
export function draftProblems(draft: PrescriptionDraft): string[] {
  const problems: string[] = [];
  if (draft.stockLines.length === 0 && draft.buyLines.length === 0) {
    problems.push("Add at least one medicine.");
  }
  if (draft.stockLines.some((line) => !line.dosage.trim())) {
    problems.push("Say how each medicine is taken.");
  }
  if (draft.buyLines.some((line) => !line.name.trim() || !line.dosage.trim())) {
    problems.push("Give each medicine to buy a name and how it is taken.");
  }
  if (draft.stockLines.some((line) => line.quantity < 1 || shortfallOf(draft, line) > 0)) {
    problems.push("Some quantities are more than the pharmacy holds.");
  }
  if (draft.buyLines.some((line) => line.quantity < 1)) {
    problems.push("Quantities must be at least 1.");
  }
  return [...new Set(problems)];
}

export function toPayload(draft: PrescriptionDraft): { pharmacyItems: PharmacyItemPayload[]; purchaseItems: PurchaseItemPayload[] } {
  return {
    pharmacyItems: draft.stockLines.map((line) => ({
      drugName: line.name,
      dosage: line.dosage.trim(),
      quantity: line.quantity,
      productId: line.productId,
    })),
    purchaseItems: draft.buyLines.map((line) => ({
      drugName: line.name.trim(),
      dosage: line.dosage.trim(),
      quantity: line.quantity,
      productId: line.productId ?? undefined,
      note: line.note.trim() || undefined,
    })),
  };
}
