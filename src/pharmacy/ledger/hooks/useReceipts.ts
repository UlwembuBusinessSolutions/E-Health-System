import { useQuery } from "@tanstack/react-query";
import { usePagedQuery } from "@/pharmacy/lib/usePagedQuery";
import { pharmacyKeys } from "@/pharmacy/lib/queryKeys";
import { getReceipt, listReceipts, type ListReceiptsParams } from "@/shared/api/pharmacyLedger";
import { listSupplierOptions } from "@/shared/api/pharmacyReceiving";

export const RECEIPT_PAGE_SIZE = 25;

export type ReceiptFilters = Omit<ListReceiptsParams, "page" | "size">;

export function useReceipts(filters: ReceiptFilters, page: number, size = RECEIPT_PAGE_SIZE) {
  return usePagedQuery({
    queryKey: pharmacyKeys.receipts.list(filters),
    fetchPage: (pageIndex, pageSize) => listReceipts({ ...filters, page: pageIndex, size: pageSize }),
    page,
    size,
    enabled: filters.facilityId !== "",
  });
}

/** Lines of one receipt; only fetched once its row is expanded. */
export function useReceiptDetail(receiptId: string, enabled: boolean) {
  return useQuery({
    queryKey: pharmacyKeys.receipts.detail(receiptId),
    queryFn: () => getReceipt(receiptId),
    enabled,
    staleTime: 30_000,
  });
}

export function useSupplierOptions() {
  return useQuery({
    queryKey: pharmacyKeys.suppliers.options,
    queryFn: listSupplierOptions,
    staleTime: 5 * 60_000,
  });
}
