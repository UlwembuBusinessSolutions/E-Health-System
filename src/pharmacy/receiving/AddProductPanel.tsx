import type { PharmacyProduct } from "@/shared/api/pharmacyStock";
import { Drawer } from "@/pharmacy/components/Drawer";
import { ProductForm } from "@/pharmacy/products/ProductForm";

interface AddProductPanelProps {
  facilityId: string;
  /** What the pharmacist had typed in the finder; becomes the product's name. */
  initialName: string;
  onCreated: (product: PharmacyProduct) => void;
  onClose: () => void;
}

// A side panel rather than a page change: navigating away would put the
// half-entered receipt at risk. Rendered only while open.
export function AddProductPanel({ facilityId, initialName, onCreated, onClose }: AddProductPanelProps) {
  return (
    <Drawer
      open
      title="Add a new product"
      description="Your receipt is safe. When you save, this product is added to it as a line."
      onClose={onClose}
    >
      <ProductForm
        variant="panel"
        facilityId={facilityId}
        initialName={initialName}
        onCreated={onCreated}
        onCancel={onClose}
      />
    </Drawer>
  );
}
