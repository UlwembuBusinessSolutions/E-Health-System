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

export function usesClinicianDashboard(role: string | undefined): boolean {
  return role !== undefined && CLINICIAN_DASHBOARD_ROLES.has(role);
}
