import { useEffect, useState } from "react";
import { AlertTriangle, Boxes } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getFacilities } from "@/shared/api/facilities";
import { getStockOverview, receiveStock } from "@/shared/api/pharmacy";
import { Card } from "@/shared/components/Card";
import { Button } from "@/shared/components/Button";
import { PageHeader } from "@/shared/components/PageHeader";
import { ApiError } from "@/shared/api/client";

const emptyForm = {
  drugName: "",
  batchNumber: "",
  barcode: "",
  expiryDate: "",
  quantity: "",
};

export function StockControlPage() {
  const queryClient = useQueryClient();
  const [facilityId, setFacilityId] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const facilitiesQuery = useQuery({ queryKey: ["facilities"], queryFn: getFacilities });

  useEffect(() => {
    if (!facilityId && facilitiesQuery.data?.length) setFacilityId(facilitiesQuery.data[0].id);
  }, [facilityId, facilitiesQuery.data]);

  const stockQuery = useQuery({
    queryKey: ["pharmacy", "stock", facilityId],
    queryFn: () => getStockOverview(facilityId),
    enabled: !!facilityId,
    refetchInterval: 5000,
  });
  const items = stockQuery.data?.items ?? [];
  const alerts = items.filter((item) => item.reorderAlert);
  const receiveMutation = useMutation({
    mutationFn: () => receiveStock({
      facilityId,
      drugName: form.drugName.trim(),
      batchNumber: form.batchNumber.trim(),
      barcode: form.barcode.trim(),
      expiryDate: form.expiryDate,
      quantity: Number(form.quantity),
    }),
    onMutate: () => setFormMessage(null),
    onSuccess: async () => {
      setForm(emptyForm);
      setFormMessage("Stock receipted successfully.");
      await queryClient.invalidateQueries({ queryKey: ["pharmacy", "stock", facilityId] });
    },
    onError: (error) => {
      setFormMessage(error instanceof ApiError ? error.message : "Could not receipt stock. Try again.");
    },
  });

  const updateForm = (field: keyof typeof emptyForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFormMessage(null);
  };

  const canSubmit = !!facilityId && !!form.drugName.trim() && !!form.batchNumber.trim()
    && !!form.barcode.trim() && !!form.expiryDate && Number(form.quantity) > 0;

  return (
    <div>
      <PageHeader
        title="Stock control"
        description="Live stock on hand, reorder alerts, and the latest ledger movements."
        action={facilitiesQuery.data && facilitiesQuery.data.length > 1 ? (
          <select value={facilityId} onChange={(event) => setFacilityId(event.target.value)}
            className="h-11 rounded-lg border border-border-strong bg-surface-raised px-3 text-[14px] text-text-primary">
            {facilitiesQuery.data.map((facility) => <option key={facility.id} value={facility.id}>{facility.name}</option>)}
          </select>
        ) : undefined}
      />
      {alerts.length > 0 && (
        <div role="alert" className="mb-5 flex items-start gap-3 rounded-xl border border-danger-500/30 bg-danger-50 px-4 py-3 text-[13.5px] text-danger-600">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span><strong>{alerts.length} item{alerts.length === 1 ? "" : "s"}</strong> at or below the configured reorder level.</span>
        </div>
      )}
      <Card className="mb-6 p-5">
        <div className="mb-4">
          <h2 className="text-[15px] font-semibold text-text-primary">Receipt stock</h2>
          <p className="mt-1 text-[13px] text-text-secondary">Add a batch without overwriting existing stock.</p>
        </div>
        <form
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (canSubmit) receiveMutation.mutate();
          }}
        >
          {[
            ["drugName", "Item / medicine", "text"],
            ["batchNumber", "Batch number", "text"],
            ["barcode", "Barcode", "text"],
            ["expiryDate", "Expiry date", "date"],
            ["quantity", "Quantity", "number"],
          ].map(([field, label, type]) => (
            <label key={field} className="flex flex-col gap-1.5 text-[13px] font-medium text-text-primary">
              {label}
              <input
                required
                type={type}
                min={type === "number" ? "1" : undefined}
                value={form[field as keyof typeof emptyForm]}
                onChange={(event) => updateForm(field as keyof typeof emptyForm, event.target.value)}
                className="h-10 rounded-lg border border-border-strong bg-surface-raised px-3 text-[14px] font-normal text-text-primary outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
            </label>
          ))}
          <div className="flex flex-col justify-end gap-2 sm:col-span-2 lg:col-span-1">
            <Button type="submit" loading={receiveMutation.isPending} disabled={!canSubmit}>
              Receipt stock
            </Button>
            {formMessage && (
              <p role={receiveMutation.isError ? "alert" : "status"} className={`text-[12.5px] ${receiveMutation.isError ? "text-danger-600" : "text-brand-700"}`}>
                {formMessage}
              </p>
            )}
          </div>
        </form>
      </Card>
      <Card className="overflow-hidden p-0">
        {!facilityId || stockQuery.isLoading ? (
          <p className="px-5 py-10 text-center text-[14px] text-text-secondary">Loading stock…</p>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
            <Boxes className="size-6 text-text-secondary" aria-hidden />
            <p className="text-[14px] text-text-secondary">No stock has been receipted at this clinic.</p>
          </div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {items.map((item) => (
              <div key={item.drugName} className="flex items-center justify-between gap-4 px-5 py-4">
                <div>
                  <p className="text-[14px] font-semibold text-text-primary">{item.drugName}</p>
                  <p className="mt-0.5 text-[12.5px] text-text-secondary">Reorder level: {item.reorderLevel}</p>
                </div>
                <div className="text-right">
                  <p className={`font-mono text-[18px] font-semibold ${item.reorderAlert ? "text-danger-600" : "text-text-primary"}`}>
                    {item.quantityOnHand}
                  </p>
                  <p className="text-[11px] uppercase tracking-wide text-text-secondary">on hand</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      {stockQuery.data && stockQuery.data.movements.length > 0 && (
        <Card className="mt-6 overflow-hidden p-0">
          <div className="border-b border-border-subtle px-5 py-4">
            <h2 className="text-[15px] font-semibold text-text-primary">Recent ledger movements</h2>
          </div>
          <div className="divide-y divide-border-subtle">
            {stockQuery.data.movements.slice(0, 10).map((movement) => (
              <div key={movement.id} className="flex items-center justify-between gap-4 px-5 py-3 text-[13px]">
                <span className="text-text-primary">{movement.drugName} · {movement.movementType.toLowerCase()}</span>
                <span className={movement.quantityDelta < 0 ? "text-danger-600" : "text-brand-700"}>
                  {movement.quantityDelta > 0 ? "+" : ""}{movement.quantityDelta}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
