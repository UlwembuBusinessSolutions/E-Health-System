import { PackageCheck } from "lucide-react";
import { Button } from "@/shared/components/Button";
import { useStockArrivals } from "./hooks/usePrescriptionSearch";

interface StockArrivalsBannerProps {
  facilityId: string;
  onReview: (prescriptionId: string) => void;
}

// Out-of-stock items are never terminal, but nobody remembers to re-check
// them. When stock lands, this says which patient is waiting for it.
export function StockArrivalsBanner({ facilityId, onReview }: StockArrivalsBannerProps) {
  const arrivals = useStockArrivals(facilityId).data ?? [];
  if (arrivals.length === 0) return null;

  return (
    <section aria-label="Stock has arrived" className="rounded-2xl border border-success-500/30 bg-success-50 p-4">
      <h2 className="flex items-center gap-2 text-[14.5px] font-semibold text-success-600">
        <PackageCheck className="size-4" aria-hidden />
        Stock has arrived for {arrivals.length === 1 ? "an item" : `${arrivals.length} items`} that were out of stock
      </h2>
      <ul className="mt-2 flex flex-col gap-1">
        {arrivals.map((arrival) => (
          <li key={arrival.itemId} className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13.5px] text-text-primary">
              <span className="font-medium">{arrival.drugName}</span> for {arrival.patientName}
              <span className="text-text-secondary">
                {" "}
                · {arrival.canFulfilInFull
                  ? `${arrival.availableQuantity} now in stock`
                  : `${arrival.availableQuantity} of ${arrival.remainingQuantity} now in stock`}{" "}
                · {arrival.prescriptionSerial}
              </span>
            </p>
            <Button
              variant="ghost"
              aria-label={`Review ${arrival.drugName} for ${arrival.patientName}`}
              onClick={() => onReview(arrival.prescriptionId)}
            >
              Review
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
