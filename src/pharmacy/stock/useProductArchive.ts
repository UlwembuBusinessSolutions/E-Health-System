import { useMutation, useQueryClient } from "@tanstack/react-query";
import { archiveProduct, reactivateProduct } from "@/shared/api/pharmacyStock";
import { useToast } from "@/shared/components/toast/ToastProvider";
import { describeError } from "../lib/problem";
import { pharmacyKeys } from "../lib/queryKeys";

interface ArchiveTarget {
  productId: string;
  displayName: string;
}

/** Archive or reactivate one product, refreshing only the list and chip counts it affects. */
export function useProductArchive(facilityId: string, product: ArchiveTarget, archive: boolean, onDone?: () => void) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: () => (archive ? archiveProduct(product.productId) : reactivateProduct(product.productId)),
    onSuccess: () => {
      showToast(`${product.displayName} ${archive ? "archived" : "is active again"}.`, "success");
      void queryClient.invalidateQueries({ queryKey: pharmacyKeys.stock.list(facilityId) });
      void queryClient.invalidateQueries({ queryKey: pharmacyKeys.stock.dashboard(facilityId) });
      void queryClient.invalidateQueries({ queryKey: pharmacyKeys.products.detail(product.productId) });
      onDone?.();
    },
    onError: (error) => showToast(describeError(error), "error"),
  });
}
