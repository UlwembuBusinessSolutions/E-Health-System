import type { Prescription } from "@/shared/api/pharmacy";
import { activeLot, blockedItems, collectableItems } from "./itemState";

// What will physically change hands, and what will not. Showing the skipped
// items up front means a missing pack is never a surprise at the counter.
export function CollectionMedicationList({ prescription }: { prescription: Prescription }) {
  const handedOver = collectableItems(prescription);
  const staying = blockedItems(prescription);

  return (
    <section aria-label="Medication" className="flex flex-col gap-2">
      <h3 className="text-[15px] font-semibold text-text-primary">Medication</h3>
      <ul className="flex flex-col gap-1.5">
        {handedOver.map((item) => (
          <li key={item.id} className="rounded-lg bg-surface-sunken/60 px-3.5 py-2 text-[14px] text-text-primary">
            {item.mappedProductName ?? item.drugName}
            <span className="text-text-secondary">
              {" "}
              × {item.remainingQuantity} · lot {activeLot(item, null)?.lot}
            </span>
            {item.schedule && <span className="ml-2 text-[12.5px] font-medium text-text-secondary">Schedule {item.schedule.slice(1)}</span>}
          </li>
        ))}
        {staying.map((item) => (
          <li key={item.id} className="rounded-lg border border-dashed border-border-strong px-3.5 py-2 text-[14px] text-text-secondary">
            {item.drugName} × {item.remainingQuantity}: stays pending, no usable stock
          </li>
        ))}
      </ul>
    </section>
  );
}
