import clsx from "clsx";
import { Boxes, LayoutGrid, Pill, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { CountScope, CountSetupInfo } from "@/shared/api/pharmacyCounts";
import { Select } from "@/shared/components/Select";
import { ProductSearchPicker } from "../components/ProductSearchPicker";
import type { ScopeChoice } from "./scopeChoice";

interface ScopeCard {
  scope: CountScope;
  title: string;
  hint: string;
  icon: LucideIcon;
}

const SCOPE_CARDS: ScopeCard[] = [
  { scope: "ALL", title: "Whole facility", hint: "Every lot in the dispensary", icon: Boxes },
  { scope: "AREA", title: "One shelf area", hint: "Fastest for a routine check", icon: LayoutGrid },
  { scope: "PRODUCT", title: "One product", hint: "Settle a doubt about a single medicine", icon: Pill },
];

interface ScopePickerProps {
  choice: ScopeChoice;
  setup: CountSetupInfo | undefined;
  onChange: (choice: ScopeChoice) => void;
}

export function ScopePicker({ choice, setup, onChange }: ScopePickerProps) {
  const areaOptions = (setup?.areas ?? []).map((area) => ({
    value: area.label,
    label: `${area.label} (${area.lotCount} lots)`,
  }));

  return (
    <div className="flex flex-col gap-4">
      <fieldset>
        <legend className="sr-only">What are you counting?</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {SCOPE_CARDS.map(({ scope, title, hint, icon: Icon }) => (
            <label
              key={scope}
              className={clsx(
                "flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors duration-150",
                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-400",
                choice.scope === scope ? "border-brand-500 bg-brand-50" : "border-border-strong bg-surface-raised hover:bg-surface-sunken",
              )}
            >
              <input
                type="radio"
                name="count-scope"
                className="sr-only"
                checked={choice.scope === scope}
                onChange={() => onChange({ scope, areaLabel: "", productName: "" })}
              />
              <Icon className="mt-0.5 size-5 shrink-0 text-brand-600" aria-hidden />
              <span>
                <span className="block text-[14.5px] font-semibold text-text-primary">{title}</span>
                <span className="block text-[13px] text-text-secondary">
                  {scope === "ALL" && setup ? `${setup.wholeFacilityLotCount} lots` : hint}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {choice.scope === "AREA" && (
        <Select
          label="Which area?"
          value={choice.areaLabel}
          options={areaOptions}
          onChange={(event) => onChange({ ...choice, areaLabel: event.target.value })}
        />
      )}

      {choice.scope === "PRODUCT" && (
        <div className="flex flex-col gap-2">
          <p className="text-[13px] font-medium text-text-primary">Which product?</p>
          {choice.productName ? (
            <span className="inline-flex min-h-11 w-fit items-center gap-2 rounded-full bg-brand-50 pl-4 text-[14px] font-medium text-brand-700">
              {choice.productName}
              <button
                type="button"
                aria-label="Choose a different product"
                onClick={() => onChange({ ...choice, productName: "" })}
                className="grid size-11 place-items-center rounded-full hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
              >
                <X className="size-4" aria-hidden />
              </button>
            </span>
          ) : (
            <ProductSearchPicker
              label="Search for a product to count"
              onPick={(product) => onChange({ ...choice, productName: product.displayName })}
            />
          )}
        </div>
      )}
    </div>
  );
}
