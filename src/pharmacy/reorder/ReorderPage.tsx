import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listReorderSuppliers, type PurchaseOrder } from "@/shared/api/pharmacyPlanning";
import { PageHeader } from "@/shared/components/PageHeader";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { FacilityField } from "../components/FacilityField";
import { SkeletonRows } from "../components/SkeletonRows";
import { describeError } from "../lib/problem";
import { usePharmacyFacility } from "../lib/usePharmacyFacility";
import { PurchaseOrderView } from "./PurchaseOrderView";
import { reorderKeys } from "./reorderKeys";
import { SupplierOrderPanel } from "./SupplierOrderPanel";
import { SupplierSidebar } from "./SupplierSidebar";

// `/app/pharmacy/reorder`: supplier first, because a pharmacist orders from a
// supplier, not from a list of products.
export function ReorderPage() {
  const { facilityId, facilities, setFacilityId } = usePharmacyFacility();
  const [supplierId, setSupplierId] = useState("");
  const [order, setOrder] = useState<PurchaseOrder | null>(null);

  const suppliers = useQuery({
    queryKey: reorderKeys.suppliers(facilityId),
    queryFn: () => listReorderSuppliers(facilityId),
    enabled: facilityId !== "",
    staleTime: 30_000,
  });

  const list = suppliers.data ?? [];
  // Until one is chosen, the first supplier is shown.
  const supplier = list.find((candidate) => candidate.id === supplierId) ?? list[0];

  if (order) return <PurchaseOrderView order={order} onBack={() => setOrder(null)} />;

  return (
    <div>
      <PageHeader title="Reorder list" description="Pick a supplier, check the quantities, and create the order." />
      <FacilityField
        facilities={facilities}
        value={facilityId}
        onChange={(id) => {
          setFacilityId(id);
          setSupplierId("");
        }}
      />

      {suppliers.isLoading && <SkeletonRows rows={4} />}
      {suppliers.error && <ErrorState message={describeError(suppliers.error)} onRetry={() => void suppliers.refetch()} />}
      {suppliers.data && list.length === 0 && (
        <EmptyState title="No suppliers yet" description="Add a supplier first, then link the products you buy from them." />
      )}
      {supplier && (
        <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
          <SupplierSidebar suppliers={list} selectedId={supplier.id} onSelect={setSupplierId} />
          <SupplierOrderPanel key={supplier.id} facilityId={facilityId} supplier={supplier} onOrderCreated={setOrder} />
        </div>
      )}
    </div>
  );
}
