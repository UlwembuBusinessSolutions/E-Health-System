import { useQuery } from "@tanstack/react-query";
import { listSupplierReceipts } from "@/shared/api/pharmacyReceiving";
import { ErrorState } from "@/pharmacy/components/ErrorState";
import { SkeletonRows } from "@/pharmacy/components/SkeletonRows";
import { formatDate, pluralise } from "@/pharmacy/lib/format";
import { describeError } from "@/pharmacy/lib/problem";
import { pharmacyKeys } from "@/pharmacy/lib/queryKeys";

// Mounted only while a supplier row is expanded, so receipts are fetched on demand.
export function SupplierReceiptsList({ supplierId }: { supplierId: string }) {
  const receipts = useQuery({
    queryKey: pharmacyKeys.suppliers.receipts(supplierId),
    queryFn: () => listSupplierReceipts(supplierId),
    staleTime: 30_000,
  });

  return (
    <section aria-label="Recent receipts">
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Recent receipts</h3>
      {receipts.isLoading && <SkeletonRows rows={2} />}
      {receipts.isError && (
        <ErrorState
          message={describeError(receipts.error)}
          retrying={receipts.isFetching}
          onRetry={() => void receipts.refetch()}
        />
      )}
      {receipts.data?.length === 0 && (
        <p className="text-[13.5px] text-text-secondary">No receipts from this supplier yet.</p>
      )}
      {receipts.data && receipts.data.length > 0 && (
        <ul className="divide-y divide-border-subtle text-[13.5px]">
          {receipts.data.map((receipt) => (
            <li key={receipt.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
              <span className="font-medium text-text-primary">{receipt.invoiceNumber ?? receipt.receiptNumber}</span>
              <span className="text-text-secondary">{formatDate(receipt.receivedAt)}</span>
              <span className="tabular-nums text-text-secondary">{pluralise(receipt.totalUnits, "unit")}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
