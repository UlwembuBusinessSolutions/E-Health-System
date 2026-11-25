
export const VITALS_ROLES = new Set(["Doctor", "Professional Nurse"]);
const REFERRAL_MANAGEMENT_ROLES = new Set([
  "ORG_ADMIN",
  "Professional Nurse",
  "Doctor",
  "Clinician",
  "Occupational Health Practitioner",
]);

export function canTakeVitals(role: string | undefined): boolean {
  return role !== undefined && VITALS_ROLES.has(role);
}

// Roles whose Dashboard is the clinician one (who to see next, notes to
// sign, their appointments). Everyone else keeps the organisation dashboard.
// The server still decides what each role may see; a clinician without queue
// access falls back to the organisation dashboard.
export const CLINICIAN_DASHBOARD_ROLES = new Set([
  "Doctor",
  "Clinician",
  "Nurse",
  "Professional Nurse",
  "Occupational Nurse",
  "Occupational Health Practitioner",
]);

export const PHARMACY_MANAGER_DASHBOARD_ROLES = new Set(["Pharmacy Manager"]);

export function usesClinicianDashboard(role: string | undefined): boolean {
  return role !== undefined && CLINICIAN_DASHBOARD_ROLES.has(role);
}

export function usesPharmacyManagerDashboard(role: string | undefined): boolean {
  return role !== undefined && PHARMACY_MANAGER_DASHBOARD_ROLES.has(role);
}

export function canManagePatientReferrals(role: string | undefined): boolean {
  return role !== undefined && REFERRAL_MANAGEMENT_ROLES.has(role);
}
