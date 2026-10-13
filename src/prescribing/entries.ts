import type { MedicineDirections, PharmacyItemPayload, PurchaseItemPayload } from "@/shared/api/consultations";

// The doctor's prescription as plain data, with the rules that protect it kept in one place:
// the pharmacy only supplies what the doctor picked from its stock list and what the shelf holds,
// everything else is for the patient to buy.

export type Supply = "PHARMACY" | "BUY";

export interface Entry {
  key: string;
  /** Set when the medicine was picked from the pharmacy's list; only then can the pharmacy supply it. */
  productId: string | null;
  name: string;
  strengthForm: string;
  dose: string;
  route: string;
  frequency: string;
  duration: string;
  quantity: number;
  unit: string;
  supply: Supply;
  instructions: string;
  /** What the shelf held when the medicine was picked; the server checks again when signing. */
  available: number | null;
}

export interface PrescriptionState {
  prescribe: boolean;
  entries: Entry[];
}

export const EMPTY_PRESCRIPTION: PrescriptionState = { prescribe: false, entries: [] };

export const ROUTES = [
  "Oral", "Topical", "Inhaled", "Eye", "Ear", "Nasal", "Rectal", "Vaginal", "Subcutaneous", "Intramuscular",
  "Intravenous", "Other - see instructions",
];

export const FREQUENCIES = ["Once daily", "Twice daily", "Three times daily", "Every 6 hours", "As needed - see instructions"];

export const UNITS = ["tablets", "capsules", "mL", "g", "tubes", "bottles", "inhalers", "ampoules", "vials", "units"];

/** The unit a product is counted in, as a quantity unit the doctor would write. */
export function unitForBaseUnit(baseUnit: string): string {
  switch (baseUnit) {
    case "TABLET": return "tablets";
    case "CAPSULE": return "capsules";
    case "BOTTLE": return "bottles";
    case "VIAL": return "vials";
    default: return "units";
  }
}

export function newKey(): string {
  return crypto.randomUUID();
}

function sameMedicine(a: { name: string; strengthForm: string }, b: { name: string; strengthForm: string }): boolean {
  const tidy = (text: string) => text.trim().replace(/\s+/g, " ").toLowerCase();
  return tidy(a.name) === tidy(b.name) && tidy(a.strengthForm) === tidy(b.strengthForm);
}

/**
 * An entry for the same medicine from the same supplier, other than the one being edited. The same
 * medicine may appear twice only when the pharmacy supplies part and the patient buys the rest.
 */
export function findDuplicate(
  entries: Entry[],
  candidate: { name: string; strengthForm: string; supply: Supply },
  exceptKey?: string,
): Entry | undefined {
  return entries.find((entry) => entry.key !== exceptKey && entry.supply === candidate.supply && sameMedicine(entry, candidate));
}

/** Units of one product already taken from the pharmacy by other lines. */
export function takenFromShelf(entries: Entry[], productId: string, exceptKey?: string): number {
  return entries
    .filter((entry) => entry.supply === "PHARMACY" && entry.productId === productId && entry.key !== exceptKey)
    .reduce((total, entry) => total + entry.quantity, 0);
}

/** The most the pharmacy can still give for a product: what the shelf held minus what other lines take. */
export function shelfLeftFor(entries: Entry[], entry: Pick<Entry, "productId" | "available">, exceptKey?: string): number {
  if (entry.productId === null || entry.available === null) return 0;
  return Math.max(0, entry.available - takenFromShelf(entries, entry.productId, exceptKey));
}

/** How many units a pharmacy line asks for beyond the shelf; 0 when it fits (or when the patient buys it). */
export function shortfallOf(entries: Entry[], entry: Entry): number {
  if (entry.supply !== "PHARMACY") return 0;
  return Math.max(0, entry.quantity - shelfLeftFor(entries, entry, entry.key));
}

/** The directions as one readable sentence, the form the pharmacy screens and the printout show. */
export function sentenceOf(entry: Pick<Entry, "dose" | "route" | "frequency" | "duration" | "instructions">): string {
  const parts = [entry.dose, entry.route && entry.route.toLowerCase(), entry.frequency && entry.frequency.toLowerCase(), entry.duration && `for ${entry.duration}`]
    .map((part) => (part ?? "").trim())
    .filter((part) => part !== "");
  const sentence = parts.join(", ");
  const extra = entry.instructions.trim();
  return extra ? `${sentence}. ${extra}` : sentence;
}

/** Everything that stops the prescription being sent, in plain words. Empty means it can go. */
export function problemsOf(state: PrescriptionState): string[] {
  if (!state.prescribe) return [];
  const problems: string[] = [];
  if (state.entries.length === 0) problems.push("Add at least one medicine.");
  if (state.entries.some((entry) => shortfallOf(state.entries, entry) > 0)) {
    problems.push("Some quantities are more than the pharmacy holds.");
  }
  if (state.entries.some((entry) => sentenceOf(entry).length > 300)) {
    problems.push("The directions for a medicine are too long. Shorten the instructions.");
  }
  return problems;
}

function directionsOf(entry: Entry): MedicineDirections {
  return {
    strengthForm: entry.strengthForm.trim() || undefined,
    dose: entry.dose.trim() || undefined,
    route: entry.route || undefined,
    frequency: entry.frequency.trim() || undefined,
    duration: entry.duration.trim() || undefined,
    quantityUnit: entry.unit || undefined,
    instructions: entry.instructions.trim() || undefined,
  };
}

function drugNameOf(entry: Entry): string {
  // A product picked from the pharmacy's list already carries its strength in its name.
  return entry.productId ? entry.name.trim() : [entry.name.trim(), entry.strengthForm.trim()].filter(Boolean).join(" ");
}

/** What signing sends: pharmacy lines and buy lines. Nothing when prescribing is switched off. */
export function toPayload(state: PrescriptionState): { pharmacyItems: PharmacyItemPayload[]; purchaseItems: PurchaseItemPayload[] } {
  if (!state.prescribe) return { pharmacyItems: [], purchaseItems: [] };
  return {
    pharmacyItems: state.entries.filter((entry) => entry.supply === "PHARMACY").map((entry) => ({
      drugName: drugNameOf(entry),
      dosage: sentenceOf(entry),
      quantity: entry.quantity,
      productId: entry.productId ?? undefined,
      directions: directionsOf(entry),
    })),
    purchaseItems: state.entries.filter((entry) => entry.supply === "BUY").map((entry) => ({
      drugName: drugNameOf(entry),
      dosage: sentenceOf(entry),
      quantity: entry.quantity,
      productId: entry.productId ?? undefined,
      directions: directionsOf(entry),
    })),
  };
}

export function serialise(state: PrescriptionState): string {
  return JSON.stringify(state);
}

/** Reads a saved draft back, tolerating anything unexpected by starting empty. */
export function parse(json: string | null | undefined): PrescriptionState {
  if (!json) return EMPTY_PRESCRIPTION;
  try {
    const value = JSON.parse(json) as Partial<PrescriptionState>;
    const entries = Array.isArray(value.entries) ? value.entries.filter((entry): entry is Entry => typeof entry?.name === "string") : [];
    return { prescribe: value.prescribe === true || entries.length > 0, entries };
  } catch {
    return EMPTY_PRESCRIPTION;
  }
}

/** True when two prescriptions are the same, so an unchanged draft is not saved again. */
export function sameState(a: PrescriptionState, b: PrescriptionState): boolean {
  return serialise(a) === serialise(b);
}
