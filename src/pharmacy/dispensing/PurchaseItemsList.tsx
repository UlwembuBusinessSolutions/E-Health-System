import { ShoppingBag } from "lucide-react";
import type { PurchasePrescriptionItem, PurchaseReason } from "@/shared/api/pharmacy";
import { StatusPill } from "@/shared/components/StatusPill";

const REASON_LABELS: Record<PurchaseReason, string> = {
  OUT_OF_STOCK: "Was out of stock",
  SHORT_STOCK: "Rest of the quantity",
  NOT_STOCKED: "Not stocked here",
};

// The lines the prescriber asked the patient to buy. They are on the
// prescription so the pharmacist sees the whole picture, but there is nothing
// to dispense and they never keep the prescription in the queue.
export function PurchaseItemsList({ items }: { items: PurchasePrescriptionItem[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-label="Medicines the patient buys" className="rounded-xl border border-dashed border-border-strong bg-surface-sunken p-3.5">
      <p className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-text-primary">
        <ShoppingBag className="size-4 text-text-secondary" aria-hidden />
        The patient buys these (nothing to dispense)
      </p>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[14px] font-medium text-text-primary">{item.drugName}</p>
              <p className="text-[12.5px] text-text-secondary">
                {item.dosage} · quantity {item.quantity}
                {item.note ? ` · ${item.note}` : ""}
              </p>
            </div>
            <StatusPill tone={item.reason === "NOT_STOCKED" ? "neutral" : "warning"}>{REASON_LABELS[item.reason]}</StatusPill>
          </li>
        ))}
      </ul>
    </section>
  );
}
