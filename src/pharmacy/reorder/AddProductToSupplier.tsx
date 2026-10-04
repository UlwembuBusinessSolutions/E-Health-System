import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { linkProductToSupplier } from "@/shared/api/pharmacyPlanning";
import { Card } from "@/shared/components/Card";
import { useToast } from "@/shared/components/toast/ToastProvider";
import { ProductSearchPicker } from "../components/ProductSearchPicker";
import { describeError } from "../lib/problem";
import { pharmacyKeys } from "../lib/queryKeys";

interface AddProductToSupplierProps {
  facilityId: string;
  supplierId: string;
  supplierName: string;
  /** Products already on the supplier's list, so they are not offered again. */
  linkedIds: ReadonlySet<string>;
}

export function AddProductToSupplier({ facilityId, supplierId, supplierName, linkedIds }: AddProductToSupplierProps) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  // Bumping the key clears the search box after a product is added.
  const [pickerKey, setPickerKey] = useState(0);

  const link = useMutation({
    mutationFn: (productId: string) => linkProductToSupplier(supplierId, productId),
    onSuccess: () => {
      setPickerKey((key) => key + 1);
      showToast(`Added to ${supplierName}'s list.`, "success");
      return queryClient.invalidateQueries({ queryKey: pharmacyKeys.reorder.sheet(facilityId, supplierId) });
    },
    onError: (error) => showToast(describeError(error), "error"),
  });

  return (
    <Card className="flex flex-col gap-2 p-4">
      <h3 className="text-[14px] font-semibold text-text-primary">Add a product to this supplier</h3>
      <ProductSearchPicker
        key={pickerKey}
        label="Search products to add"
        excludeIds={linkedIds}
        onPick={(product) => link.mutate(product.id)}
        notFoundExtra={
          <Link to="/app/pharmacy/products/new" className="font-medium text-brand-600 hover:underline">
            Add it as a new product
          </Link>
        }
      />
    </Card>
  );
}
