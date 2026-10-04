import type { PharmacyProduct } from "@/shared/api/pharmacyStock";
import type { ProductTrackingFlags, ReceiptFlagReason } from "@/shared/api/pharmacyReceiving";

/**
 * The slice of a catalog product the receiving screen needs. It is also what a
 * saved draft stores, so a resumed draft needs no product lookups.
 */
export interface ReceivableProduct {
  id: string;
  code: string;
  displayName: string;
  strength: string | null;
  dosageForm: string | null;
  baseUnit: PharmacyProduct["baseUnit"];
  packSize: number | null;
  batchTracked: boolean;
  expiryTracked: boolean;
  serialTracked: boolean;
  coldChain: boolean;
}

export function toReceivableProduct(product: PharmacyProduct & ProductTrackingFlags): ReceivableProduct {
  return {
    id: product.id,
    code: product.code,
    displayName: product.displayName,
    strength: product.strength,
    dosageForm: product.dosageForm,
    baseUnit: product.baseUnit,
    packSize: product.packSize,
    batchTracked: product.batchTracked,
    expiryTracked: product.expiryTracked,
    serialTracked: product.serialTracked ?? false,
    coldChain: product.coldChain ?? false,
  };
}

/** What staff record when this product arrives. */
export type TrackingMode = "LOT" | "SERIAL" | "QUANTITY";

export interface LineFlagDraft {
  /** Null while the pharmacist has opened the flag but not yet said what is wrong. */
  reason: ReceiptFlagReason | null;
  note: string;
  acceptedQuantity: number;
}

export interface ReceiptLineDraft {
  /** Stable React key; the same product can appear on several lines (different lots). */
  key: string;
  product: ReceivableProduct;
  /** Packs received, or units when the product has no pack size. */
  packs: number;
  lotNumber: string;
  /** `YYYY-MM-DD` from a native date input, or "". */
  expiryDate: string;
  serials: string[];
  /** Kept as typed so "-" and "4." survive while the user is mid-entry. */
  temperature: string;
  /** Null until the pharmacist answers. */
  coldBoxIntact: boolean | null;
  flag: LineFlagDraft | null;
}

export const FLAG_REASON_LABELS: Record<ReceiptFlagReason, string> = {
  DAMAGED: "Damaged",
  SHORT: "Short delivery",
  WRONG_ITEM: "Wrong item",
  NEAR_EXPIRY: "Near expiry",
};

export const FLAG_REASONS = Object.keys(FLAG_REASON_LABELS) as ReceiptFlagReason[];

export function newReceiptLine(product: ReceivableProduct): ReceiptLineDraft {
  return {
    key: crypto.randomUUID(),
    product,
    packs: 1,
    lotNumber: "",
    expiryDate: "",
    serials: [],
    temperature: "",
    coldBoxIntact: null,
    flag: null,
  };
}
