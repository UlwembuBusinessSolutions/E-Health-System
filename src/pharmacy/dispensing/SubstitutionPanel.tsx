import { useState } from "react";
import { Mail, X } from "lucide-react";
import type { ProductRef } from "@/shared/api/pharmacy";
import { Button } from "@/shared/components/Button";
import { ProductSearchPicker } from "../components/ProductSearchPicker";

interface SubstitutionPanelProps {
  drugName: string;
  onAskPrescriber: (substitute: ProductRef) => void;
  onCancel: () => void;
}

// A substitute is only ever a request: stock is never moved until the
// prescriber approves, which is why the only action here is to ask them.
// The server suggests nothing, so the pharmacist picks the alternative.
export function SubstitutionPanel({ drugName, onAskPrescriber, onCancel }: SubstitutionPanelProps) {
  const [substitute, setSubstitute] = useState<ProductRef | null>(null);

  return (
    <section
      aria-label="Suggest a substitute"
      className="mt-3 flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface-raised p-3.5"
    >
      <p className="text-[13px] text-text-secondary">Which product could replace {drugName}?</p>
      {substitute ? (
        <span className="inline-flex min-h-11 w-fit items-center gap-2 rounded-full bg-brand-50 pl-4 text-[14px] font-medium text-brand-700">
          {substitute.name}
          <button
            type="button"
            aria-label="Choose a different substitute"
            onClick={() => setSubstitute(null)}
            className="grid size-11 place-items-center rounded-full hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            <X className="size-4" aria-hidden />
          </button>
        </span>
      ) : (
        <ProductSearchPicker
          label="Search for a substitute product"
          onPick={(product) => setSubstitute({ id: product.id, name: product.displayName })}
        />
      )}
      <p className="text-[13px] text-text-secondary">Not dispensed unless the prescriber approves.</p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          disabled={!substitute}
          icon={<Mail className="size-4" aria-hidden />}
          onClick={() => substitute && onAskPrescriber(substitute)}
        >
          Ask prescriber to approve
        </Button>
      </div>
    </section>
  );
}
