import { Button } from "@/shared/components/Button";
import { useDecideSubstitution } from "./hooks/useItemMutations";

interface SubstitutionAnswerProps {
  prescriptionId: string;
  itemId: string;
  substituteName: string | null;
}

// Once the prescriber replies (by email or phone), the pharmacist records
// their answer here. An approval makes the substitute the product dispensed.
export function SubstitutionAnswer({ prescriptionId, itemId, substituteName }: SubstitutionAnswerProps) {
  const decide = useDecideSubstitution(prescriptionId, itemId);
  return (
    <div className="mt-3 flex flex-col gap-2 rounded-lg border border-border-subtle bg-surface-raised p-3.5">
      <p className="text-[13.5px] text-text-primary">
        Waiting for the prescriber to answer about <strong>{substituteName ?? "the substitute"}</strong>. Record their reply:
      </p>
      <div className="flex flex-wrap gap-2">
        <Button loading={decide.isPending && decide.variables === "APPROVED"} disabled={decide.isPending} onClick={() => decide.mutate("APPROVED")}>
          Prescriber approved
        </Button>
        <Button
          variant="secondary"
          loading={decide.isPending && decide.variables === "REJECTED"}
          disabled={decide.isPending}
          onClick={() => decide.mutate("REJECTED")}
        >
          Prescriber declined
        </Button>
      </div>
    </div>
  );
}
