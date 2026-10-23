import { z } from "zod";
import type {
  CreateProductPayload,
  DrugSchedule,
  PharmacyProduct,
  StockBaseUnit,
  StockCategory,
} from "@/shared/api/pharmacyStock";

export type TrackingMode = "LOT" | "SERIAL" | "NONE";

export interface ProductFormValues {
  category: StockCategory;
  name: string;
  strength: string;
  dosageForm: string;
  baseUnit: StockBaseUnit;
  tracking: TrackingMode;
  packSize: string;
  reorderThreshold: string;
  genericName: string;
  manufacturer: string;
  barcode: string;
  storageInstructions: string;
  schedule: DrugSchedule | "";
  coldChain: boolean;
  preferredSupplierId: string;
}

interface Option<T extends string> {
  value: T;
  label: string;
  hint: string;
}

export const CATEGORY_OPTIONS: Option<StockCategory>[] = [
  { value: "MEDICINE", label: "Medicine", hint: "Tablets, syrups, injections" },
  { value: "SUPPLY", label: "Supply", hint: "Gloves, syringes, test kits, dressings" },
  { value: "DEVICE", label: "Device", hint: "Equipment such as thermometers or monitors" },
];

export const UNIT_OPTIONS: { value: StockBaseUnit; label: string }[] = [
  { value: "TABLET", label: "Tablet" },
  { value: "CAPSULE", label: "Capsule" },
  { value: "BOTTLE", label: "Bottle" },
  { value: "VIAL", label: "Vial" },
  { value: "SEALED_PACK", label: "Sealed pack" },
  { value: "BOX", label: "Box" },
  { value: "KIT", label: "Kit" },
  { value: "EACH", label: "Each" },
];

export const TRACKING_OPTIONS: Option<TrackingMode>[] = [
  { value: "LOT", label: "Lot + expiry", hint: "Medicines and most supplies" },
  { value: "SERIAL", label: "Serial number", hint: "Only for equipment you must trace one by one" },
  { value: "NONE", label: "Quantity only", hint: "Simple consumables" },
];

export const SCHEDULE_OPTIONS: { value: DrugSchedule | ""; label: string }[] = [
  { value: "", label: "Not scheduled" },
  { value: "S5", label: "Schedule 5" },
  { value: "S6", label: "Schedule 6" },
];

// What a new product of each type usually is, so changing the type already
// gets the unit and tracking right for the common case.
const TYPE_DEFAULTS: Record<StockCategory, { baseUnit: StockBaseUnit; tracking: TrackingMode }> = {
  MEDICINE: { baseUnit: "TABLET", tracking: "LOT" },
  SUPPLY: { baseUnit: "EACH", tracking: "NONE" },
  DEVICE: { baseUnit: "EACH", tracking: "SERIAL" },
};

export function categoryPatch(category: StockCategory): Partial<ProductFormValues> {
  return { category, ...TYPE_DEFAULTS[category] };
}

export interface ProductPreset {
  id: string;
  label: string;
  hint: string;
  category: StockCategory;
  baseUnit: StockBaseUnit;
  tracking: TrackingMode;
  dosageForm: string;
  packSize: string;
}

export const PRESETS: ProductPreset[] = [
  { id: "tablets", label: "Tablets or capsules", hint: "Counted in tablets, lot and expiry", category: "MEDICINE", baseUnit: "TABLET", tracking: "LOT", dosageForm: "tablets", packSize: "100" },
  { id: "bottle", label: "Bottle or syrup", hint: "Counted in bottles, lot and expiry", category: "MEDICINE", baseUnit: "BOTTLE", tracking: "LOT", dosageForm: "syrup", packSize: "" },
  { id: "vial", label: "Injection vial", hint: "Counted in vials, lot and expiry", category: "MEDICINE", baseUnit: "VIAL", tracking: "LOT", dosageForm: "injection", packSize: "10" },
  { id: "syringes", label: "Box of syringes", hint: "Supply counted in boxes, lot and expiry", category: "SUPPLY", baseUnit: "BOX", tracking: "LOT", dosageForm: "sterile, single use", packSize: "100" },
  { id: "kit", label: "Test kit", hint: "Supply counted in kits, lot and expiry", category: "SUPPLY", baseUnit: "KIT", tracking: "LOT", dosageForm: "rapid test", packSize: "25" },
  { id: "equipment", label: "Equipment", hint: "Thermometer, BP cuff. Quantity only", category: "DEVICE", baseUnit: "EACH", tracking: "NONE", dosageForm: "", packSize: "" },
];

/** A preset fills the stock settings; text the user already typed is never overwritten. */
export function applyPreset(values: ProductFormValues, preset: ProductPreset): ProductFormValues {
  return {
    ...values,
    category: preset.category,
    baseUnit: preset.baseUnit,
    tracking: preset.tracking,
    dosageForm: values.dosageForm || preset.dosageForm,
    packSize: values.packSize || preset.packSize,
  };
}

export function emptyProductValues(name = ""): ProductFormValues {
  return {
    ...TYPE_DEFAULTS.MEDICINE,
    category: "MEDICINE",
    name,
    strength: "",
    dosageForm: "",
    packSize: "",
    reorderThreshold: "",
    genericName: "",
    manufacturer: "",
    barcode: "",
    storageInstructions: "",
    schedule: "",
    coldChain: false,
    preferredSupplierId: "",
  };
}

function trackingOf(product: PharmacyProduct): TrackingMode {
  if (product.serialTracked) return "SERIAL";
  return product.batchTracked ? "LOT" : "NONE";
}

/**
 * Starting values copied from an existing product. The strength is left blank
 * on purpose: a copy is nearly always a different strength of the same thing,
 * and a blank field makes the user say which.
 */
export function valuesFromProduct(product: PharmacyProduct): ProductFormValues {
  return {
    category: product.category,
    name: product.genericName ?? product.displayName,
    strength: "",
    dosageForm: product.dosageForm ?? "",
    baseUnit: product.baseUnit,
    tracking: trackingOf(product),
    packSize: product.packSize?.toString() ?? "",
    reorderThreshold: "",
    genericName: product.genericName ?? "",
    manufacturer: product.manufacturer ?? "",
    barcode: "",
    storageInstructions: product.storageInstructions ?? "",
    schedule: product.schedule ?? "",
    coldChain: product.coldChain,
    preferredSupplierId: product.preferredSupplierId ?? "",
  };
}

/** "Amoxicillin 500 mg capsules" - how the product is shown everywhere in stock. */
export function composeDisplayName(values: Pick<ProductFormValues, "name" | "strength" | "dosageForm">): string {
  return [values.name, values.strength, values.dosageForm]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
}

const SKU_PREFIX: Record<StockCategory, string> = { MEDICINE: "", SUPPLY: "SUP-", DEVICE: "DEV-" };

/** `Amoxicillin`, `500 mg`, `capsules` -> `AMOX-500-CAP`. Empty until there is a name. */
export function generateSku(values: Pick<ProductFormValues, "category" | "name" | "strength" | "dosageForm">): string {
  const nameCode = values.name.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 4);
  if (!nameCode) return "";
  const strengthCode = /\d+/.exec(values.strength)?.[0] ?? "";
  const formCode = values.dosageForm.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 3);
  return SKU_PREFIX[values.category] + [nameCode, strengthCode, formCode].filter(Boolean).join("-");
}

const optionalWholeNumber = (minimum: number, message: string) =>
  z.string().refine((value) => value === "" || (/^\d+$/.test(value) && Number(value) >= minimum), message);

const productSchema = z.object({
  name: z.string().trim().min(1, "Give the product a name"),
  sku: z.string().trim().min(1, "A SKU code is needed").max(50, "Keep the SKU under 50 characters"),
  packSize: optionalWholeNumber(1, "Use a whole number of at least 1"),
  reorderThreshold: optionalWholeNumber(0, "Use a whole number, or leave blank"),
});

export type ProductFormErrors = Partial<Record<"name" | "sku" | "packSize" | "reorderThreshold", string>>;

export function validateProduct(values: ProductFormValues, sku: string): ProductFormErrors {
  const result = productSchema.safeParse({ ...values, sku });
  if (result.success) return {};
  const errors: ProductFormErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (field === "name" || field === "sku" || field === "packSize" || field === "reorderThreshold") {
      errors[field] ??= issue.message;
    }
  }
  return errors;
}

const orUndefined = (value: string) => value.trim() || undefined;

export function toCreatePayload(values: ProductFormValues, sku: string, facilityId: string): CreateProductPayload {
  return {
    code: sku.trim(),
    displayName: composeDisplayName(values),
    genericName: orUndefined(values.genericName),
    strength: orUndefined(values.strength),
    dosageForm: orUndefined(values.dosageForm),
    category: values.category,
    baseUnit: values.baseUnit,
    packSize: values.packSize ? Number(values.packSize) : undefined,
    barcode: orUndefined(values.barcode),
    manufacturer: orUndefined(values.manufacturer),
    batchTracked: values.tracking === "LOT",
    expiryTracked: values.tracking === "LOT",
    serialTracked: values.tracking === "SERIAL",
    schedule: values.schedule || undefined,
    coldChain: values.coldChain,
    preferredSupplierId: values.preferredSupplierId || undefined,
    storageInstructions: orUndefined(values.storageInstructions),
    facilityId,
    reorderThreshold: values.reorderThreshold ? Number(values.reorderThreshold) : undefined,
  };
}
