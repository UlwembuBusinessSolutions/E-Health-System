import clsx from "clsx";
import type { PharmacyProduct } from "@/shared/api/pharmacyStock";
import { Input } from "@/shared/components/Input";
import { OptionCards } from "./OptionCards";
import { TRACKING_OPTIONS, UNIT_OPTIONS, type ProductFormErrors } from "./productFormModel";
import type { SectionProps } from "./sectionProps";

interface StockSettingsSectionProps extends SectionProps {
  errors: ProductFormErrors;
  sku: string;
  /** Called when the user types their own SKU, which stops auto-generation. */
  onSkuChange: (sku: string) => void;
  skuOwner: PharmacyProduct | null;
}

export function StockSettingsSection({ values, update, errors, sku, onSkuChange, skuOwner }: StockSettingsSectionProps) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border-subtle bg-surface-raised p-4 sm:p-5">
      <h3 className="text-[15px] font-semibold text-text-primary">2 · Stock settings</h3>

      <fieldset>
        <legend className="mb-1.5 text-[13px] font-medium text-text-primary">Counted in</legend>
        <div className="flex flex-wrap gap-2">
          {UNIT_OPTIONS.map((unit) => {
            const selected = unit.value === values.baseUnit;
            return (
              <button
                key={unit.value}
                type="button"
                aria-pressed={selected}
                onClick={() => update({ baseUnit: unit.value })}
                className={clsx(
                  "min-h-11 rounded-full border px-4 text-[13.5px] font-semibold",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
                  selected ? "border-brand-700 bg-brand-700 text-white" : "border-border-strong bg-surface-raised text-text-primary hover:bg-surface-sunken",
                )}
              >
                {unit.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div>
        <OptionCards
          legend="When stock arrives, staff record"
          options={TRACKING_OPTIONS}
          value={values.tracking}
          onChange={(tracking) => update({ tracking })}
        />
        <p className="mt-1.5 text-[12.5px] text-text-secondary">
          Tracking is locked after the first receipt, so pick what matches how it arrives.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Input
          label="SKU code"
          className="font-mono"
          placeholder="Generated from name"
          value={sku}
          error={errors.sku}
          hint="Made from the name. You can change it."
          onChange={(event) => onSkuChange(event.target.value)}
        />
        <Input
          label="Units per pack (optional)"
          inputMode="numeric"
          placeholder="e.g. 100"
          value={values.packSize}
          error={errors.packSize}
          hint="Used when receiving by the pack."
          onChange={(event) => update({ packSize: event.target.value })}
        />
        <Input
          label="Reorder below (optional)"
          inputMode="numeric"
          placeholder="e.g. 20"
          value={values.reorderThreshold}
          error={errors.reorderThreshold}
          hint="Shows as low stock at or below this."
          onChange={(event) => update({ reorderThreshold: event.target.value })}
        />
      </div>

      {skuOwner && (
        <p role="alert" className="rounded-lg bg-danger-50 px-3.5 py-2.5 text-[13.5px] text-danger-600">
          That SKU is already used by <strong>{skuOwner.displayName}</strong>. Change it to continue.
        </p>
      )}
    </section>
  );
}
