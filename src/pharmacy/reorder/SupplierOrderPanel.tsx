import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createPurchaseOrder,
  getReorderSheet,
  unlinkProductFromSupplier,
  type PurchaseOrder,
  type ReorderLine,
  type ReorderSupplier,
} from "@/shared/api/pharmacyPlanning";
import { Button } from "@/shared/components/Button";
import { Input } from "@/shared/components/Input";
import { useToast } from "@/shared/components/toast/ToastProvider";
import { ErrorState } from "../components/ErrorState";
import { SkeletonRows } from "../components/SkeletonRows";
import { pluralise } from "../lib/format";
import { describeError } from "../lib/problem";
import { pharmacyKeys } from "../lib/queryKeys";
import { AddProductToSupplier } from "./AddProductToSupplier";
import { OrderLinesTable } from "./OrderLinesTable";
import { orderLinePayloads, totalsFor, type QuantityOverrides } from "./packMath";

interface SupplierOrderPanelProps {
  facilityId: string;
  supplier: ReorderSupplier;
  onOrderCreated: (order: PurchaseOrder) => void;
}

// Mounted per supplier (the page keys it), so a quantity typed for one
// supplier can never leak onto another's order.
export function SupplierOrderPanel({ facilityId, supplier, onOrderCreated }: SupplierOrderPanelProps) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [overrides, setOverrides] = useState<QuantityOverrides>({});
  const [expectedDelivery, setExpectedDelivery] = useState("");
  const sheetKey = pharmacyKeys.reorder.sheet(facilityId, supplier.id);

  const sheet = useQuery({
    queryKey: sheetKey,
    queryFn: () => getReorderSheet(facilityId, supplier.id),
    staleTime: 30_000,
  });

  const unlink = useMutation({
    mutationFn: (line: ReorderLine) => unlinkProductFromSupplier(supplier.id, line.productId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sheetKey }),
    onError: (error) => showToast(describeError(error), "error"),
  });

  const lines = sheet.data?.lines ?? [];
  const totals = totalsFor(lines, overrides);

  const create = useMutation({
    mutationFn: () =>
      createPurchaseOrder({
        facilityId,
        supplierId: supplier.id,
        expectedDelivery: expectedDelivery || undefined,
        lines: orderLinePayloads(lines, overrides),
      }),
    onSuccess: async (order) => {
      // The supplier's "last ordered" date and "to order" count just changed.
      await queryClient.invalidateQueries({ queryKey: pharmacyKeys.reorder.all });
      onOrderCreated(order);
    },
    onError: (error) => showToast(describeError(error), "error"),
  });

  const blocked = totals.lineCount === 0 || totals.brokenPackLines > 0;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-semibold text-text-primary">Order from {supplier.name}</h2>
          <p className="text-[13px] text-text-secondary">
            {[supplier.phone, supplier.email].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Input
            label="Expected delivery"
            type="date"
            value={expectedDelivery}
            onChange={(event) => setExpectedDelivery(event.target.value)}
          />
          <p aria-live="polite" className="pb-3 text-[13.5px] text-text-secondary">
            {totals.lineCount === 0 ? "Nothing on this order" : `${pluralise(totals.lineCount, "line")} · ${totals.units} units`}
          </p>
          <Button disabled={blocked} loading={create.isPending} onClick={() => create.mutate()}>
            Create order
          </Button>
        </div>
      </div>

      <AddProductToSupplier
        facilityId={facilityId}
        supplierId={supplier.id}
        supplierName={supplier.name}
        linkedIds={new Set(lines.map((line) => line.productId))}
      />

      {sheet.isLoading && <SkeletonRows rows={4} />}
      {sheet.error && <ErrorState message={describeError(sheet.error)} onRetry={() => void sheet.refetch()} />}
      {sheet.data && (
        <OrderLinesTable
          supplierName={supplier.name}
          lines={lines}
          overrides={overrides}
          onQuantityChange={(line, quantity) => setOverrides((current) => ({ ...current, [line.productId]: quantity }))}
          onRemove={(line) => unlink.mutate(line)}
        />
      )}
      {totals.brokenPackLines > 0 && (
        <p role="alert" className="text-[13px] font-medium text-amber-600">
          Some quantities are not whole packs. Fix them to create the order.
        </p>
      )}
      <p className="text-[12.5px] text-text-secondary">
        Low and out-of-stock products are filled in for you, rounded up to whole packs. Change any number, or set it to 0
        to leave it off this order. Removing a product only takes it off this supplier&apos;s list.
      </p>
    </div>
  );
}
