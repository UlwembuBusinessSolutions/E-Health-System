import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Plus } from "lucide-react";
import { getFacilities } from "@/shared/api/facilities";
import {
  authoriseStockOrder,
  createStockOrder,
  listProducts,
  listStockOrders,
  submitStockOrder,
  type StockOrderStatus,
} from "@/shared/api/pharmacyStock";
import { ApiError } from "@/shared/api/client";
import { Card } from "@/shared/components/Card";
import { Button } from "@/shared/components/Button";
import { Input } from "@/shared/components/Input";
import { Select } from "@/shared/components/Select";
import { PageHeader } from "@/shared/components/PageHeader";
import { StatusPill, type PillTone } from "@/shared/components/StatusPill";
import { useToast } from "@/shared/components/toast/ToastProvider";

function statusTone(status: StockOrderStatus): PillTone {
  if (status === "SUBMITTED") return "success";
  if (status === "AUTHORISED") return "warning";
  return "neutral";
}

export function StockOrderScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const initialFacilityId = searchParams.get("facilityId") ?? "";
  const [facilityId, setFacilityId] = useState(initialFacilityId);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState("1");

  const facilitiesQuery = useQuery({ queryKey: ["facilities"], queryFn: getFacilities });
  const productsQuery = useQuery({
    queryKey: ["pharmacy", "products", "for-stock-orders"],
    queryFn: () => listProducts({ activeOnly: true, size: 200 }),
  });

  useEffect(() => {
    if (!facilityId && facilitiesQuery.data && facilitiesQuery.data.length > 0) {
      setFacilityId(facilitiesQuery.data[0].id);
    }
  }, [facilityId, facilitiesQuery.data]);

  const productOptions = useMemo(
    () => (productsQuery.data?.items ?? []).map((product) => ({ value: product.id, label: `${product.displayName} (${product.code})` })),
    [productsQuery.data],
  );

  const ordersQuery = useQuery({
    queryKey: ["pharmacy", "stock-orders", facilityId],
    queryFn: () => listStockOrders(facilityId),
    enabled: !!facilityId,
  });

  const createStockOrderMutation = useMutation({
    mutationFn: () =>
      createStockOrder({
        facilityId,
        lines: [{ productId: selectedProductId, quantity: Number(quantity) }],
      }),
    onSuccess: () => {
      showToast("Stock order created.", "success");
      setSelectedProductId("");
      setQuantity("1");
      void queryClient.invalidateQueries({ queryKey: ["pharmacy", "stock-orders", facilityId] });
    },
    onError: (error) => {
      showToast(error instanceof ApiError ? error.message : "Could not create the stock order.", "error");
    },
  });

  const authoriseMutation = useMutation({
    mutationFn: (orderId: string) => authoriseStockOrder(orderId),
    onSuccess: () => {
      showToast("Order authorised.", "success");
      void queryClient.invalidateQueries({ queryKey: ["pharmacy", "stock-orders", facilityId] });
    },
    onError: (error) => {
      showToast(error instanceof ApiError ? error.message : "Could not authorise that order.", "error");
    },
  });

  const submitMutation = useMutation({
    mutationFn: (orderId: string) => submitStockOrder(orderId),
    onSuccess: () => {
      showToast("Order submitted for procurement.", "success");
      void queryClient.invalidateQueries({ queryKey: ["pharmacy", "stock-orders", facilityId] });
    },
    onError: (error) => {
      showToast(error instanceof ApiError ? error.message : "Could not submit that order.", "error");
    },
  });

  const orders = ordersQuery.data ?? [];

  return (
    <div className="mx-auto max-w-5xl">
      <button
        type="button"
        onClick={() => navigate(`/app/pharmacy/stock?facilityId=${facilityId}`)}
        className="mb-5 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to stock
      </button>

      <PageHeader
        title="Stock orders"
        description="Draft, authorise, and submit facility orders against the active catalogue."
      />

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div className="min-w-64 flex-1">
          <Select
            label="Facility"
            options={(facilitiesQuery.data ?? []).map((f) => ({ value: f.id, label: f.name }))}
            value={facilityId}
            onChange={(e) => setFacilityId(e.target.value)}
          />
        </div>
      </div>

      <Card className="mb-6 p-6">
        <div className="grid gap-4 md:grid-cols-[1.4fr_180px_auto] md:items-end">
          <Select
            label="Product"
            options={productOptions}
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
          />
          <Input
            label="Quantity"
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          <Button
            type="button"
            icon={<Plus className="size-4" aria-hidden />}
            loading={createStockOrderMutation.isPending}
            disabled={!facilityId || !selectedProductId || Number(quantity) <= 0}
            onClick={() => void createStockOrderMutation.mutate()}
          >
            Raise order
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        {!facilityId ? (
          <p className="px-5 py-8 text-center text-[13.5px] text-text-secondary">Select a facility to view orders.</p>
        ) : ordersQuery.isLoading ? (
          <p className="px-5 py-8 text-center text-[13.5px] text-text-secondary">Loading stock orders…</p>
        ) : ordersQuery.isError ? (
          <div role="alert" className="flex flex-col items-center gap-3 px-5 py-10 text-center">
            <p className="text-[13.5px] text-text-secondary">Orders could not be loaded.</p>
            <Button variant="secondary" onClick={() => void ordersQuery.refetch()}>
              Retry
            </Button>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
            <CheckCircle2 className="size-5 text-text-secondary" aria-hidden />
            <p className="text-[13.5px] text-text-secondary">No stock orders for this facility yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {orders.map((order) => (
              <div key={order.id} className="p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-semibold uppercase tracking-wide text-text-secondary">Order</p>
                    <p className="text-[14px] font-semibold text-text-primary">{order.id.slice(0, 8)}</p>
                  </div>
                  <StatusPill tone={statusTone(order.status)}>{order.status}</StatusPill>
                </div>

                <div className="mb-3 grid gap-2 text-[13.5px] text-text-secondary md:grid-cols-2">
                  <p>Created by: {order.createdByName}</p>
                  <p>Created: {new Date(order.createdAt).toLocaleString()}</p>
                  {order.authorisedByName && <p>Authorised by: {order.authorisedByName}</p>}
                  {order.authorisedAt && <p>Authorised at: {new Date(order.authorisedAt).toLocaleString()}</p>}
                  {order.submittedAt && <p>Submitted at: {new Date(order.submittedAt).toLocaleString()}</p>}
                </div>

                <div className="mb-4 overflow-hidden rounded-lg border border-border-subtle">
                  <table className="w-full text-[13.5px]">
                    <thead>
                      <tr className="bg-surface-sunken text-left text-[11px] uppercase tracking-wide text-text-secondary">
                        <th className="px-3 py-2 font-semibold">Product</th>
                        <th className="px-3 py-2 font-semibold">Unit</th>
                        <th className="px-3 py-2 text-right font-semibold">Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.lines.map((line) => (
                        <tr key={`${order.id}-${line.productId}`} className="border-t border-border-subtle">
                          <td className="px-3 py-2">
                            <p className="font-medium text-text-primary">{line.productName}</p>
                            <p className="text-[12px] text-text-secondary">{line.productCode}</p>
                          </td>
                          <td className="px-3 py-2 text-text-secondary">{line.baseUnit}</td>
                          <td className="px-3 py-2 text-right font-medium text-text-primary">{line.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap gap-2">
                  {order.status === "DRAFT" && (
                    <Button
                      variant="secondary"
                      loading={authoriseMutation.isPending}
                      onClick={() => void authoriseMutation.mutate(order.id)}
                    >
                      Authorise order
                    </Button>
                  )}
                  {order.status === "AUTHORISED" && (
                    <Button
                      loading={submitMutation.isPending}
                      onClick={() => void submitMutation.mutate(order.id)}
                    >
                      Submit order
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
