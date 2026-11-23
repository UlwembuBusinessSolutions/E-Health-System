
export const VITALS_ROLES = new Set(["Doctor", "Professional Nurse"]);
const REFERRAL_MANAGEMENT_ROLES = new Set([
  "Professional Nurse",
  "Doctor",
  "Clinician",
  "Occupational Health Practitioner",
]);

export function canTakeVitals(role: string | undefined): boolean {
  return role !== undefined && VITALS_ROLES.has(role);
}

export function canManagePatientReferrals(role: string | undefined): boolean {
  return role !== undefined && REFERRAL_MANAGEMENT_ROLES.has(role);
}
