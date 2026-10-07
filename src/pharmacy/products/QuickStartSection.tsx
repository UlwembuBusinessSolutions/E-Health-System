import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { PharmacyProduct } from "@/shared/api/pharmacyStock";
import { CopyFromExisting } from "./CopyFromExisting";
import { OptionCards } from "./OptionCards";
import { PRESETS, type ProductPreset } from "./productFormModel";

interface QuickStartSectionProps {
  defaultOpen: boolean;
  activePresetId: string | null;
  onPreset: (preset: ProductPreset) => void;
  onCopy: (product: PharmacyProduct) => void;
}

// Optional shortcuts: most products are "another tablet", so a preset or a
// copy fills the stock settings and the user only types the name.
export function QuickStartSection({ defaultOpen, activePresetId, onPreset, onCopy }: QuickStartSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="rounded-xl border border-border-subtle bg-brand-50/40 p-4">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-11 w-full items-center justify-between gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
      >
        <span>
          <span className="block text-[14.5px] font-semibold text-text-primary">
            Quick start <span className="font-normal text-text-secondary">· Optional</span>
          </span>
          <span className="block text-[12.5px] text-text-secondary">Use a preset or copy a similar product.</span>
        </span>
        <ChevronDown className={open ? "size-4 rotate-180" : "size-4"} aria-hidden />
      </button>
      {open && (
        <div className="mt-3 flex flex-col gap-4">
          <OptionCards
            legend="Presets"
            hideLegend
            options={PRESETS.map(({ id, label, hint }) => ({ value: id, label, hint }))}
            value={activePresetId}
            onChange={(id) => {
              const preset = PRESETS.find((candidate) => candidate.id === id);
              if (preset) onPreset(preset);
            }}
          />
          <CopyFromExisting onPick={onCopy} />
        </div>
      )}
    </section>
  );
}
