import { useQuery } from "@tanstack/react-query";
import { listWitnessCandidates } from "@/shared/api/pharmacyRegister";
import { PasswordInput } from "@/shared/components/PasswordInput";
import { Select } from "@/shared/components/Select";
import { useAuth } from "@/auth/AuthContext";
import { describeError } from "../lib/problem";
import { pharmacyKeys } from "../lib/queryKeys";

interface WitnessFieldsProps {
  facilityId: string;
  required: boolean;
  witnessStaffId: string;
  witnessPin: string;
  onChange: (change: { witnessStaffId?: string; witnessPin?: string }) => void;
}

const NO_WITNESS = "none";

// A witness has to confirm in person with their own password, so the person
// recording the movement can never witness their own entry. Shared by the
// register and by the dispensing screens (Schedule 6 hand-overs).
export function WitnessFields({ facilityId, required, witnessStaffId, witnessPin, onChange }: WitnessFieldsProps) {
  const { user } = useAuth();
  const candidates = useQuery({
    queryKey: pharmacyKeys.register.witnesses(facilityId),
    queryFn: () => listWitnessCandidates(facilityId),
    enabled: facilityId !== "",
    staleTime: 5 * 60_000,
  });
  const colleagues = (candidates.data ?? [])
    .filter((candidate) => candidate.id !== user?.id)
    .map((candidate) => ({ value: candidate.id, label: candidate.name }));
  // Schedule 5 may go unwitnessed, so it needs an explicit way back to "none".
  const options = required ? colleagues : [{ value: NO_WITNESS, label: "No witness" }, ...colleagues];

  return (
    <fieldset className="flex flex-col gap-4 rounded-xl border border-border-subtle p-4">
      <legend className="px-1 text-[13px] font-semibold text-text-primary">
        {required ? "Witness (required)" : "Witness (optional)"}
      </legend>
      <Select
        label="Witnessed by"
        required={required}
        value={witnessStaffId || (required ? "" : NO_WITNESS)}
        placeholder="Choose a colleague"
        options={options}
        error={candidates.error ? describeError(candidates.error) : undefined}
        onChange={(event) =>
          onChange({ witnessStaffId: event.target.value === NO_WITNESS ? "" : event.target.value, witnessPin: "" })
        }
      />
      {witnessStaffId && (
        <PasswordInput
          label="Witness password"
          required
          autoComplete="off"
          value={witnessPin}
          hint="The witness types this themselves. It is checked, never stored."
          onChange={(event) => onChange({ witnessPin: event.target.value })}
        />
      )}
    </fieldset>
  );
}
