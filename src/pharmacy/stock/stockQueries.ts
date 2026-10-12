import { useQuery } from "@tanstack/react-query";
import { listProductHistory } from "@/shared/api/pharmacyLedger";
import { getProduct, getStockDashboard, listBatches, listStock, type StockStatusFilter } from "@/shared/api/pharmacyStock";
import { pharmacyKeys } from "../lib/queryKeys";
import { usePagedQuery } from "../lib/usePagedQuery";

export interface StockListFilters {
  facilityId: string;
  q: string;
  status: StockStatusFilter | null;
  page: number;
}

export const STOCK_PAGE_SIZE = 25;
export const HISTORY_PAGE_SIZE = 10;

export function useStockList({ facilityId, q, status, page }: StockListFilters) {
  return usePagedQuery({
    queryKey: [...pharmacyKeys.stock.list(facilityId), { q, status }],
    fetchPage: (pageIndex, size) =>
      listStock({ facilityId, q: q || undefined, status: status ?? undefined, page: pageIndex, size }),
    page,
    size: STOCK_PAGE_SIZE,
    enabled: facilityId !== "",
  });
}

export function useStockDashboard(facilityId: string) {
  return useQuery({
    queryKey: pharmacyKeys.stock.dashboard(facilityId),
    queryFn: () => getStockDashboard(facilityId),
    enabled: facilityId !== "",
    staleTime: 30_000,
  });
}

export function useProductLots(productId: string) {
  return useQuery({
    queryKey: pharmacyKeys.stock.lots(productId),
    queryFn: () => listBatches(productId),
    staleTime: 30_000,
  });
}

export function useProductHistory(productId: string, facilityId: string, page: number) {
  return usePagedQuery({
    queryKey: pharmacyKeys.stock.history(productId, facilityId),
    fetchPage: (pageIndex, size) => listProductHistory(productId, { facilityId, page: pageIndex, size }),
    page,
    size: HISTORY_PAGE_SIZE,
  });
}

export function useProductDetails(productId: string, enabled: boolean) {
  return useQuery({
    queryKey: pharmacyKeys.products.detail(productId),
    queryFn: () => getProduct(productId),
    enabled,
    staleTime: 30_000,
  });
}
