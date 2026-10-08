import type {
  AuthorisationType,
  CollectorDetails,
  CollectorIdType,
  CollectorRelationship,
} from "@/shared/api/pharmacy";
import { PROOF_REQUIRED_AUTHORISATIONS } from "./collectorOptions";

export interface CollectorFormState {
  name: string;
  idType: CollectorIdType;
  idNumber: string;
  relationship: CollectorRelationship | "";
  relationshipDescription: string;
  phone: string;
  authorisation: AuthorisationType | "";
  proof: File | null;
  signature: Blob | null;
  idVerified: boolean;
  notes: string;
}

export const EMPTY_COLLECTOR_FORM: CollectorFormState = {
  name: "",
  idType: "SA_ID",
  idNumber: "",
  relationship: "",
  relationshipDescription: "",
  phone: "",
  authorisation: "",
  proof: null,
  signature: null,
  idVerified: false,
  notes: "",
};

const SA_ID_PATTERN = /^\d{13}$/;

/** SA ID numbers are exactly 13 digits; other ID types are free-form. */
export function idNumberProblem(idType: CollectorIdType, idNumber: string): string | null {
  if (idType !== "SA_ID" || idNumber === "") return null;
  return SA_ID_PATTERN.test(idNumber) ? null : "SA ID numbers are 13 digits.";
}

/** Verbal consent is never enough for Schedule 5 or 6 medication. */
export function isVerbalBlocked(form: CollectorFormState, hasScheduledItem: boolean): boolean {
  return hasScheduledItem && form.authorisation === "VERBAL";
}

/** Proof is mandatory for paperwork-based authorisations and for any scheduled medicine. */
export function isProofRequired(form: CollectorFormState, hasScheduledItem: boolean): boolean {
  if (hasScheduledItem) return true;
  return form.authorisation !== "" && PROOF_REQUIRED_AUTHORISATIONS.has(form.authorisation);
}

/** Plain-language names of every required field still unmet. Empty means ready. */
export function missingRequirements(form: CollectorFormState, hasScheduledItem: boolean): string[] {
  const missing: string[] = [];
  if (form.name.trim() === "") missing.push("collector name");
  if (form.idNumber.trim() === "" || idNumberProblem(form.idType, form.idNumber)) missing.push("valid ID number");
  if (form.relationship === "") missing.push("relationship");
  if (form.relationship === "OTHER" && form.relationshipDescription.trim() === "") missing.push("relationship description");
  if (form.phone.trim() === "") missing.push("contact number");
  if (form.authorisation === "" || isVerbalBlocked(form, hasScheduledItem)) missing.push("authorisation type");
  if (isProofRequired(form, hasScheduledItem) && !form.proof) missing.push("proof of authorisation");
  if (!form.signature) missing.push("collector signature");
  if (!form.idVerified) missing.push("ID check");
  return missing;
}

/** True once the pharmacist has typed or captured anything worth confirming before discarding. */
export function hasCapturedData(form: CollectorFormState): boolean {
  return (
    [form.name, form.idNumber, form.relationshipDescription, form.phone, form.notes].some((v) => v.trim() !== "") ||
    form.relationship !== "" ||
    form.authorisation !== "" ||
    form.proof !== null ||
    form.signature !== null ||
    form.idVerified
  );
}

/** Only call when `missingRequirements` is empty: relationship and authorisation are then set. */
export function toCollectorDetails(form: CollectorFormState): CollectorDetails {
  return {
    name: form.name.trim(),
    idType: form.idType,
    idNumber: form.idNumber.trim(),
    // The server keeps one free-text relationship, so "Other" travels as what was typed.
    relationship: form.relationship === "OTHER" ? form.relationshipDescription.trim() : form.relationship,
    phone: form.phone.trim(),
    authorisationType: form.authorisation as AuthorisationType,
  };
}
