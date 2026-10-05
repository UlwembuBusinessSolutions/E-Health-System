export const VITALS_ROLES = new Set(["Doctor", "Pharmacist"]);

export function canTakeVitals(role: string | undefined): boolean {
  return role !== undefined && VITALS_ROLES.has(role);
}