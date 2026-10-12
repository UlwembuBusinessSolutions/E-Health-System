import type { DispenseLot, PrescriptionItem } from "@/shared/api/pharmacy";
import { ExpiryText } from "../components/ExpiryText";
import { StockStatusPill } from "../components/StockStatusPill";
import { isFullyDispensed, isMapped } from "./itemState";

interface StockLineProps {
  item: PrescriptionItem;
  lot: DispenseLot | null;
}

// What is on the shelf for this item right now, so the pharmacist knows
// whether Dispense will work before pressing it.
export function StockLine({ item, lot }: StockLineProps) {
  if (isFullyDispensed(item) || !isMapped(item)) return null;

  if (!lot || lot.available < 1) {
    return (
      <p className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px] text-text-secondary">
        <StockStatusPill status="OUT" />
        No usable stock
      </p>
    );
  }

  return (
    <p className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-text-secondary">
      <StockStatusPill status={item.stockStatus === "LOW" ? "LOW" : "IN_STOCK"} />
      <span className="tabular-nums">
        {lot.available} in lot {lot.lot}
      </span>
      <span aria-hidden>·</span>
      <ExpiryText date={lot.expiryDate} />
    </p>
  );
}
