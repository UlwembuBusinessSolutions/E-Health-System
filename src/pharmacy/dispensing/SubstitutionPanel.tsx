import { Mail } from "lucide-react";
import type { SubstituteSuggestion } from "@/shared/api/pharmacy";
import { Button } from "@/shared/components/Button";
import { formatDate } from "../lib/format";

interface SubstitutionPanelProps {
  drugName: string;
  suggestion: SubstituteSuggestion;
  onAskPrescriber: () => void;
  onCancel: () => void;
}

// A substitute is only ever a suggestion: stock is never moved until the
// prescriber approves, which is why the only action here is to ask them.
export function SubstitutionPanel({ drugName, suggestion, onAskPrescriber, onCancel }: SubstitutionPanelProps) {
  const expiry = suggestion.expiryDate ? ` · expires ${formatDate(suggestion.expiryDate)}` : "";
  return (
    <section
      aria-label="Suggested substitute"
      className="mt-3 flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface-raised p-3.5"
    >
      <div>
        <p className="text-[13px] text-text-secondary">Instead of {drugName}</p>
        <p className="text-[15px] font-semibold text-text-primary">{suggestion.productName}</p>
        <p className="mt-1 text-[13px] text-text-secondary">
          {suggestion.available} in stock · lot {suggestion.lot}
          {expiry}. {suggestion.basis}. Not dispensed unless the prescriber approves.
        </p>
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button icon={<Mail className="size-4" aria-hidden />} onClick={onAskPrescriber}>
          Ask prescriber to approve
        </Button>
      </div>
    </section>
  );
}
