import { Select } from "@/shared/components/Select";
import type { Facility } from "@/shared/api/types";

interface FacilityFieldProps {
  facilities: Facility[];
  value: string;
  onChange: (facilityId: string) => void;
}

// Hidden for single-site tenants: a one-option dropdown is just noise.
export function FacilityField({ facilities, value, onChange }: FacilityFieldProps) {
  if (facilities.length < 2) return null;
  return (
    <div className="mb-5 max-w-xs">
      <Select
        label="Facility"
        value={value}
        options={facilities.map((facility) => ({ value: facility.id, label: facility.name }))}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
