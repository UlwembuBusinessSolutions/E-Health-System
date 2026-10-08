import { Layers, Trash2 } from "lucide-react";
import type { BatchRow, StockRow } from "@/shared/api/pharmacyStock";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { ExpiryText } from "../components/ExpiryText";
import { SkeletonRows } from "../components/SkeletonRows";
import { describeError } from "../lib/problem";
import { formatQuantity } from "../lib/units";
import { useProductLots } from "./stockQueries";

interface LotsTabProps {
  product: StockRow;
  /** Opens the adjust dialog on this lot, ready to remove from it. */
  onRemoveFromLot: (lot: BatchRow) => void;
}

export function LotsTab({ product, onRemoveFromLot }: LotsTabProps) {
  const lots = useProductLots(product.productId);

  if (lots.isLoading) return <SkeletonRows rows={2} />;
  if (lots.isError) {
    return (
      <ErrorState message={describeError(lots.error)} retrying={lots.isFetching} onRetry={() => void lots.refetch()} />
    );
  }

  const serials = (lots.data ?? []).flatMap((lot) => lot.serialNumbers);
  if (product.serialTracked) return <SerialList serials={serials} />;

  if (!lots.data || lots.data.length === 0) {
    return <EmptyState icon={Layers} title="Nothing on the shelf" description="Receive stock to add a lot." />;
  }

  return (
    <ul aria-label={`Lots of ${product.displayName}`} className="divide-y divide-border-subtle">
      {lots.data.map((lot) => (
        <li key={lot.batchId} className="flex min-h-11 flex-wrap items-center gap-x-6 gap-y-1 py-2">
          <span className="w-28 font-mono text-[13.5px] font-semibold text-text-primary">{lot.lotNumber}</span>
          <ExpiryText date={lot.expiryDate} className="text-[13.5px]" />
          <span className="ml-auto text-[13.5px] font-semibold tabular-nums text-text-primary">
            {formatQuantity(lot.quantity, product.baseUnit)}
          </span>
          <button
            type="button"
            aria-label={`Remove stock from lot ${lot.lotNumber}`}
            onClick={() => onRemoveFromLot(lot)}
            className="grid size-11 place-items-center rounded-lg text-text-secondary hover:bg-surface-raised hover:text-danger-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}

function SerialList({ serials }: { serials: string[] }) {
  if (serials.length === 0) {
    return <EmptyState icon={Layers} title="Nothing on the shelf" description="Receive stock to add serial numbers." />;
  }
  return (
    <ul aria-label="Serial numbers in stock" className="flex flex-wrap gap-2">
      {serials.map((serial) => (
        <li key={serial} className="rounded-lg bg-surface-raised px-3 py-1.5 font-mono text-[13px] text-text-primary">
          {serial}
        </li>
      ))}
    </ul>
  );
}
