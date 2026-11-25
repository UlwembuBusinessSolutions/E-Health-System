import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ShoppingCart } from "lucide-react";
import { listPurchaseOrders, type PurchaseOrder } from "@/shared/api/pharmacyPlanning";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { PageHeader } from "@/shared/components/PageHeader";
import { Select } from "@/shared/components/Select";
import { formatDate, formatDateTime } from "@/pharmacy/lib/format";
import { describeError } from "@/pharmacy/lib/problem";
import { useFacilitySelection } from "@/pharmacy/lib/useFacilitySelection";

export function PurchaseOrdersPage() {
  const { facilities, facilityId, selectFacility } = useFacilitySelection();
  const [searchParams, setSearchParams] = useSearchParams();
  const orderId = searchParams.get("orderId");
  const orders = useQuery({
    queryKey: ["pharmacy", "purchase-orders", facilityId],
    queryFn: () => listPurchaseOrders(facilityId, 0, 100),
    enabled: facilityId !== "",
    staleTime: 30_000,
  });
  const orderPage = orders.data;
  const selectedOrder = orderPage?.items.find((order) => order.id === orderId) ?? null;

  function closeDetail() {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("orderId");
      return next;
    }, { replace: true });
  }

  const facilityName = facilities.find((facility) => facility.id === facilityId)?.name ?? "Selected clinic";

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Purchase orders" description="Purchase orders recorded for the selected clinic."
        action={<Link to={`/app/pharmacy/reorder?facilityId=${encodeURIComponent(facilityId)}`}
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-600">
          <ShoppingCart className="size-4" aria-hidden /> Create purchase order
        </Link>} />
      {facilities.length > 1 && (
        <Select label="Clinic" value={facilityId}
          options={facilities.map((facility) => ({ value: facility.id, label: facility.name }))}
          onChange={(event) => selectFacility(event.target.value)} />
      )}

      {orderId && selectedOrder && (
        <OrderDetail order={selectedOrder} facilityName={facilityName} onClose={closeDetail} />
      )}
      {orderId && orderPage && !selectedOrder && (
        <Card className="p-5">
          <p role="status" className="text-sm text-text-secondary">That purchase order is not present in the selected clinic’s available list.</p>
        </Card>
      )}

      <section aria-labelledby="purchase-orders-heading" className="flex flex-col gap-3">
        <h2 id="purchase-orders-heading" className="text-[15px] font-semibold text-text-primary">Recent orders</h2>
        {orders.isLoading ? <Card className="p-5"><p role="status" className="text-sm text-text-secondary">Loading purchase orders…</p></Card>
          : orders.isError ? (
            <Card className="p-5">
              <p role="alert" className="text-sm text-danger-600">{describeError(orders.error, "Purchase orders could not be loaded.")}</p>
              <Button variant="secondary" className="mt-3" loading={orders.isFetching} onClick={() => void orders.refetch()}>Retry</Button>
            </Card>
          )           : orderPage && orderPage.items.length === 0 ? (
            <Card className="p-5"><p className="text-sm text-text-secondary">No purchase orders have been recorded for this clinic.</p></Card>
          ) : orderPage ? (
            <div className="overflow-x-auto rounded-2xl border border-border-subtle bg-surface-raised">
              <table className="w-full text-left text-[13px]">
                <thead><tr className="border-b border-border-subtle text-[11px] uppercase text-text-secondary">
                  <th className="px-4 py-3">Reference</th><th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3">Created</th><th className="px-4 py-3">Expected delivery</th>
                  <th className="px-4 py-3 text-right">Units</th>
                </tr></thead>
                <tbody className="divide-y divide-border-subtle">
                  {orderPage.items.map((order) => (
                    <tr key={order.id}>
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => setSearchParams((current) => {
                          const next = new URLSearchParams(current);
                          next.set("orderId", order.id);
                          return next;
                        }, { replace: true })} className="font-semibold text-brand-700 hover:underline">
                          {order.poNumber}
                        </button>
                      </td>
                      <td className="px-4 py-3">{order.supplierName}</td>
                      <td className="px-4 py-3">{formatDateTime(order.createdAt)}</td>
                      <td className="px-4 py-3">{order.expectedDelivery ? formatDate(order.expectedDelivery) : "Not set"}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{order.totalUnits}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {orderPage.totalItems > orderPage.items.length && (
                <p className="border-t border-border-subtle px-4 py-3 text-xs text-text-secondary">
                  Showing the 100 most recent of {orderPage.totalItems} orders.
                </p>
              )}
            </div>
          ) : null}
      </section>
    </div>
  );
}

function OrderDetail({ order, facilityName, onClose }: { order: PurchaseOrder; facilityName: string; onClose: () => void }) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Purchase order · Created</p>
          <h2 className="text-lg font-semibold text-text-primary">{order.poNumber}</h2>
          <p className="text-sm text-text-secondary">{facilityName} · {order.supplierName} · {formatDateTime(order.createdAt)}</p>
        </div>
        <Button variant="ghost" icon={<ArrowLeft className="size-4" aria-hidden />} onClick={onClose}>Close details</Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead><tr className="border-b border-border-subtle text-[11px] uppercase text-text-secondary">
            <th className="py-2">Product</th><th className="py-2 text-right">Packs</th><th className="py-2 text-right">Units</th>
          </tr></thead>
          <tbody className="divide-y divide-border-subtle">
            {order.lines.map((line) => <tr key={line.productId}>
              <td className="py-2.5">{line.productName}</td>
              <td className="py-2.5 text-right tabular-nums">{line.packs} × {line.packSize}</td>
              <td className="py-2.5 text-right tabular-nums">{line.quantity}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
