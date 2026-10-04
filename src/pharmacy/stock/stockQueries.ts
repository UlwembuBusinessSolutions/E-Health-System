import { useQuery, type QueryClient } from "@tanstack/react-query";
import {
  getProduct,
  getStockDashboard,
  listBatches,
  listProductHistory,
  listStock,
  type StockStatusFilter,
} from "@/shared/api/pharmacyStock";
import { usePagedQuery } from "../lib/usePagedQuery";

// One place for every stock query key, so invalidation can be exact: after a
// write the caller names precisely what went stale instead of refetching all.
export const stockKeys = {
  list: (facilityId: string) => ["pharmacy", "stock", facilityId] as const,
  dashboard: (facilityId: string) => ["pharmacy", "stock-dashboard", facilityId] as const,
  product: (productId: string) => ["pharmacy", "products", productId] as const,
  lots: (productId: string) => ["pharmacy", "products", productId, "batches"] as const,
  history: (productId: string, facilityId: string) => ["pharmacy", "product-history", productId, facilityId] as const,
};

export interface StockListFilters {
  facilityId: string;
  q: string;
  status: StockStatusFilter | null;
  archived: boolean;
  page: number;
}

export const STOCK_PAGE_SIZE = 25;
export const HISTORY_PAGE_SIZE = 10;

export function useStockList({ facilityId, q, status, archived, page }: StockListFilters) {
  return usePagedQuery({
    queryKey: [...stockKeys.list(facilityId), { q, status, archived }],
    fetchPage: (pageIndex, size) =>
      listStock({ facilityId, q: q || undefined, status: status ?? undefined, archived, page: pageIndex, size }),
    page,
    size: STOCK_PAGE_SIZE,
    enabled: facilityId !== "",
  });
}

export function useStockDashboard(facilityId: string) {
  return useQuery({
    queryKey: stockKeys.dashboard(facilityId),
    queryFn: () => getStockDashboard(facilityId),
    enabled: facilityId !== "",
    staleTime: 30_000,
  });
}

export function useProductLots(productId: string) {
  return useQuery({ queryKey: stockKeys.lots(productId), queryFn: () => listBatches(productId), staleTime: 30_000 });
}

export function useProductHistory(productId: string, facilityId: string, page: number) {
  return usePagedQuery({
    queryKey: stockKeys.history(productId, facilityId),
    fetchPage: (pageIndex, size) => listProductHistory(productId, { facilityId, page: pageIndex, size }),
    page,
    size: HISTORY_PAGE_SIZE,
  });
}

export function useProductDetails(productId: string, enabled: boolean) {
  return useQuery({
    queryKey: stockKeys.product(productId),
    queryFn: () => getProduct(productId),
    enabled,
    staleTime: 30_000,
  });
}

/** Everything a quantity change makes stale: the list row, the chip counts, the lots and the history. */
export function invalidateAfterStockChange(queryClient: QueryClient, facilityId: string, productId: string) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: stockKeys.list(facilityId) }),
    queryClient.invalidateQueries({ queryKey: stockKeys.dashboard(facilityId) }),
    queryClient.invalidateQueries({ queryKey: stockKeys.lots(productId) }),
    queryClient.invalidateQueries({ queryKey: stockKeys.history(productId, facilityId) }),
  ]);
}
