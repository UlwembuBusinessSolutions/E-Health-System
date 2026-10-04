import { useQuery } from "@tanstack/react-query";
import { listSuppliers, type SupplierStatus } from "@/shared/api/pharmacyReceiving";

/** Prefix for precise invalidation after any supplier change. */
export const SUPPLIERS_KEY = ["pharmacy", "suppliers"] as const;

/** Every supplier, or only those with `status`. Lists are short, so filtering and search happen client-side. */
export function useSuppliers(status?: SupplierStatus) {
  return useQuery({
    queryKey: [...SUPPLIERS_KEY, status ?? "all"],
    queryFn: () => listSuppliers({ status }),
    staleTime: 30_000,
  });
}
