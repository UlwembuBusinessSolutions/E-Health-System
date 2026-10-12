export const VITALS_ROLES = new Set([
  "Doctor",
  "Pharmacist",
  "Nurse",
  "Professional Nurse",
  "Occupational Nurse",
]);

export function canTakeVitals(role: string | undefined): boolean {
  return role !== undefined && VITALS_ROLES.has(role);
}