import type { OrganizationSector } from "@/shared/api/platform";

const LABELS: Record<OrganizationSector, string> = {
  PUBLIC: "Public",
  PRIVATE: "Private",
  OCCUPATIONAL: "Occupational",
};

// Shared with ProvisionOrganizationScreen (create) and OrganizationDetailPage
// (edit) — one canonical list+label set for every sector <Select>, not two
// screens quietly drifting out of sync with each other.
export const SECTOR_OPTIONS: { value: OrganizationSector; label: string }[] = [
  { value: "PUBLIC", label: "Public" },
  { value: "PRIVATE", label: "Private" },
  { value: "OCCUPATIONAL", label: "Occupational" },
];

// Mirrors OrganizationProvisioningService.SECTOR_DEFAULT_MODULES on the
// backend — keep the two in sync. The module catalogue itself isn't
// tenant-editable data (ModuleCode's own comment), so duplicating just the
// handful of codes relevant to this preview is safe; this only drives what
// ProvisionOrganizationScreen shows before a tenant exists; the backend's
// map is what actually seeds ModuleEntitlement rows.
export const SECTOR_DEFAULT_MODULES: Record<OrganizationSector, { code: string; label: string }[]> = {
  PUBLIC: [
    { code: "PREG", label: "Registration & Electronic Patient Record" },
    { code: "RECQ", label: "Reception, Triage & Queue Management" },
    { code: "APPT", label: "Appointment & Scheduling" },
    { code: "PHRM", label: "Pharmacy Dispensing & Stock" },
    { code: "BIOM", label: "Biometrics & Identity Verification" },
    { code: "CSAC", label: "Acute & Minor Ailments" },
    { code: "CSCC", label: "Chronic Care & CCMDD" },
    { code: "CSMC", label: "Maternal, Child & SRH" },
  ],
  PRIVATE: [
    { code: "PREG", label: "Registration & Electronic Patient Record" },
    { code: "RECQ", label: "Reception, Triage & Queue Management" },
    { code: "APPT", label: "Appointment & Scheduling" },
    { code: "PHRM", label: "Pharmacy Dispensing & Stock" },
    { code: "BIOM", label: "Biometrics & Identity Verification" },
  ],
  OCCUPATIONAL: [
    { code: "PREG", label: "Registration & Electronic Patient Record" },
    { code: "RECQ", label: "Reception, Triage & Queue Management" },
    { code: "APPT", label: "Appointment & Scheduling" },
    { code: "PHRM", label: "Pharmacy Dispensing & Stock" },
    { code: "BIOM", label: "Biometrics & Identity Verification" },
    { code: "OCCH", label: "Occupational Health" },
  ],
};

// Deliberately not StatusPill — a sector is a classification, not a state,
// so it gets a neutral tag with no colored dot rather than borrowing the
// tone vocabulary (success/danger/warning) reserved for what actually
// changes about a record over time.
export function SectorTag({ sector }: { sector: OrganizationSector }) {
  return (
    <span className="inline-flex items-center rounded-full bg-ink-100 px-2.5 py-1 text-[12px] font-medium text-ink-600">
      {LABELS[sector]}
    </span>
  );
}
