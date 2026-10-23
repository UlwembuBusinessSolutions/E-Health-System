import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listReorderSuppliers, listPurchaseOrders, listReorderAlerts,
  type PurchaseOrder, type ReorderSupplier } from "@/shared/api/pharmacyPlanning";
import { Button } from "@/shared/components/Button";
import { PageHeader } from "@/shared/components/PageHeader";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { FacilityField } from "../components/FacilityField";
import { SkeletonRows } from "../components/SkeletonRows";
import { describeError } from "../lib/problem";
import { pharmacyKeys } from "../lib/queryKeys";
import { useFacilitySelection } from "../lib/useFacilitySelection";
import { PurchaseOrderView } from "./PurchaseOrderView";
import { SupplierOrderPanel } from "./SupplierOrderPanel";
import { SupplierSidebar } from "./SupplierSidebar";

interface PlacedOrder {
  order: PurchaseOrder;
  supplier: ReorderSupplier;
}

// `/app/pharmacy/reorder`: supplier first, because a pharmacist orders from a
// supplier, not from a list of products.
export function ReorderPage() {
  const { facilityId, facilities, selectFacility } = useFacilitySelection();
  const [supplierId, setSupplierId] = useState("");
  const [placed, setPlaced] = useState<PlacedOrder | null>(null);

  const suppliers = useQuery({
    queryKey: pharmacyKeys.reorder.suppliers(facilityId),
    queryFn: () => listReorderSuppliers(facilityId),
    enabled: facilityId !== "",
    staleTime: 30_000,
  });

  const orders = useQuery({
    queryKey: ["pharmacy", "purchase-orders", facilityId],
    queryFn: () => listPurchaseOrders(facilityId),
    enabled: !!facilityId,
  });
  const alerts = useQuery({
    queryKey: ["pharmacy", "reorder-alerts", facilityId],
    queryFn: () => listReorderAlerts(facilityId),
    enabled: !!facilityId,
  });
  const list = suppliers.data ?? [];
  // Until one is chosen, the first supplier is shown.
  const supplier = list.find((candidate) => candidate.id === supplierId) ?? list[0];

  if (placed) {
    const facilityName = facilities.find((facility) => facility.id === facilityId)?.name ?? "";
    return (
      <PurchaseOrderView order={placed.order} facilityName={facilityName} supplier={placed.supplier} onBack={() => setPlaced(null)} />
    );
  }

  return (
    <div>
      <PageHeader title="Reorder list" description="Pick a supplier, check the quantities, and create the order." />
      <FacilityField
        facilities={facilities}
        value={facilityId}
        onChange={(id) => {
          selectFacility(id);
          setSupplierId("");
        }}
      />

      <section aria-label="Stock reorder alerts" className="my-5 rounded-xl border border-border-subtle bg-surface-raised p-4">
        <h2 className="font-semibold">Reorder alerts ({alerts.data?.length ?? 0})</h2>
        {alerts.data?.length === 0 && <p className="text-sm text-text-secondary">No active low-stock alerts.</p>}
        {alerts.error && <p role="alert" className="text-sm text-red-600">{describeError(alerts.error)}</p>}
        {alerts.data?.map((alert) => <p key={alert.productId} className="text-sm py-1">
          <strong>{alert.status}</strong> · {alert.productName} — {alert.available} on hand (reorder at {alert.reorderThreshold})
        </p>)}
      </section>
      <section aria-label="Purchase order approval worklist" className="my-5 rounded-xl border border-border-subtle bg-surface-raised p-4">
        <h2 className="font-semibold">Purchase order approval worklist</h2>
        {orders.isLoading && <p className="text-sm">Loading orders…</p>}
        {orders.error && <p role="alert" className="text-sm text-red-600">{describeError(orders.error)}</p>}
        {orders.data?.items.length === 0 && <p className="text-sm text-text-secondary">No orders yet for this clinic.</p>}
        {orders.data?.items.map((order) => <div key={order.id} className="flex items-center justify-between gap-3 border-b border-border-subtle py-2 text-sm">
          <span>{order.poNumber} · {order.supplierName} · <strong>{order.status.replaceAll("_", " ")}</strong></span>
          <Button variant="secondary" onClick={() => setPlaced({ order,
            supplier: list.find((item) => item.id === order.supplierId)
              ?? { id: order.supplierId, name: order.supplierName, phone: null, email: null } as ReorderSupplier
          })}>Review</Button>
        </div>)}
      </section>
      {suppliers.isLoading && <SkeletonRows rows={4} />}
      {suppliers.error && <ErrorState message={describeError(suppliers.error)} onRetry={() => void suppliers.refetch()} />}
      {suppliers.data && list.length === 0 && (
        <EmptyState title="No suppliers yet" description="Add a supplier first, then link the products you buy from them." />
      )}
      {supplier && (
        <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
          <SupplierSidebar suppliers={list} selectedId={supplier.id} onSelect={setSupplierId} />
          <SupplierOrderPanel
            key={supplier.id}
            facilityId={facilityId}
            supplier={supplier}
            onOrderCreated={(order) => setPlaced({ order, supplier })}
          />
        </div>
      )}
    </div>
  );
}
