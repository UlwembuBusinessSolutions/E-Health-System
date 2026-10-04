import { CheckCircle2, PackageX } from "lucide-react";
import type { SkippedItem } from "@/shared/api/pharmacy";

const SKIP_REASONS: Record<SkippedItem["reason"], string> = {
  OUT_OF_STOCK: "no stock",
  NO_USABLE_LOT: "only expired stock",
  UNMAPPED: "not linked to a stock product",
};

// Shown after a successful hand-over. The skipped list matters: those items
// are still owed to the patient and must not be forgotten.
export function CollectionResultView({ skippedItems }: { skippedItems: SkippedItem[] }) {
  return (
    <div className="flex flex-col gap-4" role="status">
      <p className="flex items-center gap-2 text-[15px] font-semibold text-success-600">
        <CheckCircle2 className="size-5" aria-hidden />
        Collection confirmed
      </p>
      {skippedItems.length > 0 && (
        <section aria-label="Items not handed over" className="flex flex-col gap-2">
          <h3 className="text-[14px] font-semibold text-text-primary">Not handed over, still owed</h3>
          <ul className="flex flex-col gap-1.5">
            {skippedItems.map((item) => (
              <li
                key={item.itemId}
                className="flex items-start gap-2 rounded-lg bg-amber-50 px-3.5 py-2 text-[14px] text-amber-600"
              >
                <PackageX className="mt-0.5 size-4 shrink-0" aria-hidden />
                {item.drugName}: {SKIP_REASONS[item.reason]}
              </li>
            ))}
          </ul>
          <p className="text-[13px] text-text-secondary">
            They stay pending. Mark them out of stock to tell the patient and prescriber.
          </p>
        </section>
      )}
    </div>
  );
}
