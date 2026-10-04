import type { AuthorisationType, CollectorIdType, CollectorRelationship } from "@/shared/api/pharmacy";

// Display labels and dropdown options for the third-party collector form,
// kept apart from the form so the summary view can reuse the same wording.

export const ID_TYPE_LABELS: Record<CollectorIdType, string> = {
  SA_ID: "SA ID",
  PASSPORT: "Passport",
  OTHER: "Other",
};

export const RELATIONSHIP_LABELS: Record<CollectorRelationship, string> = {
  SPOUSE_PARTNER: "Spouse / Partner",
  PARENT: "Parent",
  CHILD: "Child",
  SIBLING: "Sibling",
  CAREGIVER: "Caregiver",
  COURIER: "Courier / Delivery",
  OTHER: "Other",
};

export const AUTHORISATION_LABELS: Record<AuthorisationType, string> = {
  WRITTEN_CONSENT: "Written consent letter",
  VERBAL: "Verbal consent (confirmed by phone)",
  LEGAL_GUARDIAN: "Legal guardian",
  POWER_OF_ATTORNEY: "Power of attorney",
};

export function toOptions<T extends string>(labels: Record<T, string>): { value: T; label: string }[] {
  return (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));
}

/** Authorisations that are paperwork by nature, so proof must be attached. */
export const PROOF_REQUIRED_AUTHORISATIONS: ReadonlySet<AuthorisationType> = new Set([
  "WRITTEN_CONSENT",
  "LEGAL_GUARDIAN",
  "POWER_OF_ATTORNEY",
]);
