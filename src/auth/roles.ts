
export const VITALS_ROLES = new Set(["Doctor", "Professional Nurse"]);

export function canTakeVitals(role: string | undefined): boolean {
  return role !== undefined && VITALS_ROLES.has(role);
}
