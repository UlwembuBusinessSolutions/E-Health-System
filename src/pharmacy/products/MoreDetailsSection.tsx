import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { listSupplierOptions, type DrugSchedule } from "@/shared/api/pharmacyStock";
import { Input } from "@/shared/components/Input";
import { Select } from "@/shared/components/Select";
import { Switch } from "@/shared/components/Switch";
import { SCHEDULE_OPTIONS } from "./productFormModel";
import type { SectionProps } from "./sectionProps";

const NO_SUPPLIER = "";

export function MoreDetailsSection({ values, update }: SectionProps) {
  const [open, setOpen] = useState(false);
  // Only fetched once the section is opened: most products never need a usual supplier.
  const suppliers = useQuery({
    queryKey: ["pharmacy", "supplier-options"],
    queryFn: listSupplierOptions,
    enabled: open,
    staleTime: 5 * 60_000,
  });

  return (
    <section className="rounded-xl border border-border-subtle bg-surface-raised p-4 sm:p-5">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-11 w-full items-center justify-between gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
      >
        <h3 className="text-[15px] font-semibold text-text-primary">3 · More details</h3>
        <span className="flex items-center gap-1.5 text-[13px] text-text-secondary">
          {open ? "Hide" : "Show"}
          <ChevronDown className={open ? "size-4 rotate-180" : "size-4"} aria-hidden />
        </span>
      </button>

      {open && (
        <div className="mt-4 flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Generic name" placeholder="e.g. Ibuprofen" value={values.genericName} onChange={(event) => update({ genericName: event.target.value })} />
            <Input label="Manufacturer" placeholder="e.g. Cipla" value={values.manufacturer} onChange={(event) => update({ manufacturer: event.target.value })} />
            <Input label="Barcode / GTIN" className="font-mono" placeholder="Scan it here" value={values.barcode} onChange={(event) => update({ barcode: event.target.value })} />
            <Input label="Storage" placeholder="e.g. Keep refrigerated 2–8 °C" value={values.storageInstructions} onChange={(event) => update({ storageInstructions: event.target.value })} />
            <Select
              label="Schedule"
              options={SCHEDULE_OPTIONS}
              value={values.schedule}
              onChange={(event) => update({ schedule: event.target.value as DrugSchedule | "" })}
            />
            <Select
              label="Usual supplier"
              options={[
                { value: NO_SUPPLIER, label: "No usual supplier" },
                ...(suppliers.data ?? []).map((supplier) => ({ value: supplier.id, label: supplier.name })),
              ]}
              value={values.preferredSupplierId}
              onChange={(event) => update({ preferredSupplierId: event.target.value })}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[13.5px] font-medium text-text-primary">Cold chain</p>
              <p className="text-[12.5px] text-text-secondary">Must arrive at 2–8 °C. Receiving checks the temperature.</p>
            </div>
            <Switch checked={values.coldChain} onChange={(coldChain) => update({ coldChain })} label="Cold chain" />
          </div>
        </div>
      )}
    </section>
  );
}
