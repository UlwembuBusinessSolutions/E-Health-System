import type { AllergenType, AllergySeverity, PatientAllergy, PatientAllergyRecord } from "@/shared/api/allergies";
import type { PillTone } from "@/shared/components/StatusPill";

export const ALLERGEN_TYPE_OPTIONS: { value: AllergenType; label: string }[] = [
  { value: "MEDICATION", label: "Medication" },
  { value: "FOOD", label: "Food" },
  { value: "ENVIRONMENTAL", label: "Environmental" },
  { value: "OTHER", label: "Other" },
];

export const SEVERITY_OPTIONS: { value: AllergySeverity; label: string }[] = [
  { value: "MILD", label: "Mild" },
  { value: "MODERATE", label: "Moderate" },
  { value: "SEVERE", label: "Severe" },
  { value: "LIFE_THREATENING", label: "Life-threatening" },
];

export const ALLERGEN_TYPE_LABEL: Record<AllergenType, string> = Object.fromEntries(
  ALLERGEN_TYPE_OPTIONS.map((o) => [o.value, o.label]),
) as Record<AllergenType, string>;

export const SEVERITY_LABEL: Record<AllergySeverity, string> = Object.fromEntries(
  SEVERITY_OPTIONS.map((o) => [o.value, o.label]),
) as Record<AllergySeverity, string>;

export function severityTone(severity: AllergySeverity): PillTone {
  return severity === "MILD" ? "neutral" : severity === "MODERATE" ? "warning" : "danger";
}

// The same four roles PatientAllergyService accepts. The server is the real gate; this only decides
// whether the edit controls are shown.
export const ALLERGY_EDIT_ROLES = new Set(["Professional Nurse", "Doctor", "Clinician", "Occupational Health Practitioner"]);

export function canEditAllergies(role: string | undefined): boolean {
  return role !== undefined && ALLERGY_EDIT_ROLES.has(role);
}

export const ATC_PATTERN = /^[A-Z][0-9]{2}[A-Z]{2}([A-Z0-9]{1,2})?$/;

export function activeAllergies(record: PatientAllergyRecord | undefined): PatientAllergy[] {
  return (record?.allergies ?? []).filter((allergy) => allergy.status === "ACTIVE");
}

/** ATC codes of the active medication allergies; prescribing blocks medicines sharing their first 5 characters. */
export function activeMedicationAtcCodes(record: PatientAllergyRecord | undefined): string[] {
  return activeAllergies(record)
    .filter((allergy) => allergy.allergenType === "MEDICATION" && allergy.allergyCode && ATC_PATTERN.test(allergy.allergyCode.toUpperCase()))
    .map((allergy) => (allergy.allergyCode as string).toUpperCase());
}

export function describeAllergy(allergy: PatientAllergy): string {
  const code = allergy.allergyCode ? `, ${allergy.allergyCode}` : "";
  return `${allergy.allergyName} (${SEVERITY_LABEL[allergy.severity].toLowerCase()}${code})`;
}

export function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function formatIsoDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" });
}