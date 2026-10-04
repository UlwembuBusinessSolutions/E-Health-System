import { useQuery } from "@tanstack/react-query";
import { usePagedQuery } from "@/pharmacy/lib/usePagedQuery";
import {
  getReceipt,
  listReceipts,
  listSupplierOptions,
  type ListReceiptsParams,
} from "@/shared/api/pharmacyLedger";

export const RECEIPT_PAGE_SIZE = 25;

export type ReceiptFilters = Omit<ListReceiptsParams, "page" | "size">;

export function useReceipts(filters: ReceiptFilters, page: number, size = RECEIPT_PAGE_SIZE) {
  return usePagedQuery({
    queryKey: ["pharmacy", "receipts", "list", filters],
    fetchPage: (pageIndex, pageSize) => listReceipts({ ...filters, page: pageIndex, size: pageSize }),
    page,
    size,
    enabled: filters.facilityId !== "",
  });
}

/** Lines of one receipt; only fetched once its row is expanded. */
export function useReceiptDetail(receiptId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["pharmacy", "receipts", "detail", receiptId],
    queryFn: () => getReceipt(receiptId),
    enabled,
    staleTime: 30_000,
  });
}

export function useSupplierOptions() {
  return useQuery({
    queryKey: ["pharmacy", "suppliers", "options"],
    queryFn: listSupplierOptions,
    staleTime: 5 * 60_000,
  });
}
