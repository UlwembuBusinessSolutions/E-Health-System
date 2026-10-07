import { useCallback, useMemo, useState } from "react";
import { EmptyState } from "@/pharmacy/components/EmptyState";
import { FilterChips } from "@/pharmacy/components/FilterChips";
import { ResponsiveTable } from "@/pharmacy/components/ResponsiveTable";
import { describeError } from "@/pharmacy/lib/problem";
import type { ReceiptDetail, ReceiptSummary } from "@/shared/api/pharmacyLedger";
import { RECEIPT_PAGE_SIZE, useReceipts, useSupplierOptions } from "./hooks/useReceipts";
import { boundsFor, type DateRangeKey } from "./lib/dateRange";
import { LedgerToolbar } from "./LedgerToolbar";
import { ReceiptPrintView } from "./ReceiptPrintView";
import { ReceiptRow } from "./ReceiptRow";
import { receiptColumns } from "./receiptColumns";
import { ReverseReceiptDialog } from "./ReverseReceiptDialog";

export function ReceiptsTab({ facilityId }: { facilityId: string }) {
  const [query, setQuery] = useState("");
  const [range, setRange] = useState<DateRangeKey>("ALL");
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(new Set());
  const [reversing, setReversing] = useState<ReceiptSummary | null>(null);
  const [printing, setPrinting] = useState<ReceiptDetail | null>(null);

  const suppliers = useSupplierOptions();
  const filters = useMemo(
    () => ({ facilityId, q: query || undefined, supplierId: supplierId ?? undefined, ...boundsFor(range) }),
    [facilityId, query, supplierId, range],
  );
  const receipts = useReceipts(filters, page);
  const result = receipts.data;

  // A new filter always starts from the first page.
  function changeFilter<T>(set: (value: T) => void) {
    return (value: T) => {
      set(value);
      setPage(0);
    };
  }

  function toggleExpanded(receiptId: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (!next.delete(receiptId)) next.add(receiptId);
      return next;
    });
  }

  const finishPrinting = useCallback(() => setPrinting(null), []);
  const supplierOptions = (suppliers.data ?? []).map((supplier) => ({ value: supplier.id, label: supplier.name }));

  return (
    <div className="flex flex-col gap-4">
      <LedgerToolbar
        searchLabel="Search receipts"
        searchPlaceholder="Search supplier, invoice, receipt no., product or lot"
        onSearch={changeFilter(setQuery)}
        range={range}
        onRangeChange={changeFilter(setRange)}
      />
      {supplierOptions.length > 0 && (
        <FilterChips label="Supplier" options={supplierOptions} value={supplierId} onChange={changeFilter(setSupplierId)} />
      )}
      <ResponsiveTable
        label="Goods received"
        columns={receiptColumns({ isExpanded: (id) => expandedIds.has(id), onToggle: toggleExpanded })}
        rows={result?.items ?? []}
        getRowKey={(row) => row.id}
        loading={receipts.isLoading}
        refreshing={receipts.isFetching && !receipts.isLoading}
        errorMessage={receipts.isError ? describeError(receipts.error) : null}
        onRetry={() => void receipts.refetch()}
        empty={<EmptyState title="No receipts found" description="Try a wider date range or a different search." />}
        renderExpanded={(row) =>
          expandedIds.has(row.id) ? <ReceiptRow receipt={row} onPrint={setPrinting} onReverse={setReversing} /> : null
        }
        pagination={
          result && {
            page,
            size: RECEIPT_PAGE_SIZE,
            totalItems: result.totalItems,
            hasMore: result.hasMore,
            onPageChange: setPage,
          }
        }
      />
      {reversing && <ReverseReceiptDialog receipt={reversing} onClose={() => setReversing(null)} />}
      {printing && <ReceiptPrintView receipt={printing} onDone={finishPrinting} />}
    </div>
  );
}
