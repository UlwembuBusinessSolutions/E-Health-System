import type {
  AdjustmentMode,
  AdjustmentReason,
  AdjustStockPayload,
  AddReason,
  BatchRow,
  RemoveReason,
} from "@/shared/api/pharmacyStock";
import type { ReasonOption } from "../components/ReasonPicker";
import { formatQuantity } from "../lib/units";

// The reason sets are the contract's (POST /adjustments). Wording is what a
// pharmacist would say at the shelf; the descriptions disambiguate the pairs
// that are easy to confuse (expired vs damaged, lost vs wrong entry).
const REMOVE_REASONS: ReasonOption<RemoveReason>[] = [
  { value: "EXPIRED", label: "Expired", description: "Past its expiry date" },
  { value: "DAMAGED", label: "Damaged", description: "Broken, leaking or spoiled" },
  { value: "RECALLED", label: "Recalled", description: "Withdrawn by the manufacturer or the regulator" },
  { value: "LOST_OR_STOLEN", label: "Lost or stolen", description: "Cannot be found" },
  { value: "WRONG_ENTRY", label: "Entered by mistake", description: "The quantity was never really here" },
  { value: "OTHER", label: "Something else" },
];

const ADD_REASONS: ReasonOption<AddReason>[] = [
  { value: "FOUND_IN_COUNT", label: "Found in a count", description: "Turned up on the shelf" },
  { value: "RETURNED_BY_PATIENT", label: "Returned by a patient" },
  { value: "RETURNED_FROM_WARD", label: "Returned from a ward" },
  { value: "WRONG_ENTRY", label: "Removed by mistake", description: "An earlier removal was wrong" },
  { value: "OTHER", label: "Something else" },
];

export function reasonOptionsFor(mode: AdjustmentMode): ReasonOption<AdjustmentReason>[] {
  return mode === "REMOVE" ? REMOVE_REASONS : ADD_REASONS;
}

/** Plain-language name of a reason code, as stored on ledger entries. */
export function reasonLabel(reason: string): string | null {
  const known = [...REMOVE_REASONS, ...ADD_REASONS].find((option) => option.value === reason);
  return known?.label ?? null;
}

const MIN_NOTE_LENGTH = 3;

export interface AdjustFormValues {
  facilityId: string;
  productId: string;
  baseUnit: string;
  serialTracked: boolean;
  mode: AdjustmentMode;
  /** Present when the product has lots; null while none is chosen. */
  lot: BatchRow | null;
  lotsExist: boolean;
  quantity: number;
  serials: string[];
  reason: AdjustmentReason | null;
  note: string;
}

/** What is still missing before the form can be submitted, in the order a person fills it in. */
export function findMissingStep(values: AdjustFormValues): string | null {
  if (values.serialTracked) {
    if (values.serials.length === 0) return values.mode === "REMOVE" ? "Pick the serial numbers" : "Add a serial number";
  } else {
    if (values.lotsExist && !values.lot) return "Choose a lot";
    if (values.quantity < 1) return "Enter a quantity";
  }
  if (!values.reason) return "Pick a reason";
  if (values.reason === "OTHER" && values.note.trim().length < MIN_NOTE_LENGTH) return "Add a short note";
  return null;
}

export function buildAdjustmentPayload(values: AdjustFormValues): AdjustStockPayload | null {
  if (findMissingStep(values) !== null || !values.reason) return null;

  const base = {
    facilityId: values.facilityId,
    productId: values.productId,
    mode: values.mode,
    reason: values.reason,
    note: values.reason === "OTHER" ? values.note.trim() : undefined,
  };
  if (values.serialTracked) return { ...base, serialNumbers: values.serials, quantity: values.serials.length };
  return { ...base, batchId: values.lot?.batchId, quantity: values.quantity };
}

/** One sentence saying exactly which ledger entry Confirm will write. */
export function describeAdjustment(values: AdjustFormValues): string {
  const amount = values.serialTracked ? values.serials.length : values.quantity;
  const signed = `${values.mode === "REMOVE" ? "−" : "+"}${amount}`;
  const target = values.serialTracked ? `for ${formatQuantity(amount, values.baseUnit)}` : lotTarget(values.lot);
  const balance = resultingBalance(values, amount);
  const after = balance === null ? "" : `, leaving ${formatQuantity(balance, values.baseUnit)}${values.lot ? " in that lot" : ""}`;
  return `Writes a ${signed} ledger entry ${target}${after}. It can't be edited later, only corrected.`;
}

function lotTarget(lot: BatchRow | null): string {
  return lot ? `to lot ${lot.lotNumber}` : "to this product";
}

function resultingBalance(values: AdjustFormValues, amount: number): number | null {
  if (!values.lot) return null;
  return values.mode === "REMOVE" ? values.lot.quantity - amount : values.lot.quantity + amount;
}
