import { useQuery } from "@tanstack/react-query";
import { listSuppliers, type SupplierStatus } from "@/shared/api/pharmacyReceiving";
import { pharmacyKeys } from "../lib/queryKeys";

/** Every supplier, or only those with `status`. Lists are short, so filtering and search happen client-side. */
export function useSuppliers(status?: SupplierStatus) {
  return useQuery({
    queryKey: pharmacyKeys.suppliers.list(status ?? "all"),
    queryFn: () => listSuppliers({ status }),
    staleTime: 30_000,
  });
}
