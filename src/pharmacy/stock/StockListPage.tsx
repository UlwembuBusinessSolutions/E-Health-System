import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Download, Package, PackagePlus } from "lucide-react";
import { exportStockBalances, listStock, type StockRow } from "@/shared/api/pharmacyStock";
import { getFacilities } from "@/shared/api/facilities";
import { ApiError } from "@/shared/api/client";
import { Card } from "@/shared/components/Card";
import { Button } from "@/shared/components/Button";
import { Select } from "@/shared/components/Select";
import { PageHeader } from "@/shared/components/PageHeader";
import { StatusPill, type PillTone } from "@/shared/components/StatusPill";
import { useToast } from "@/shared/components/toast/ToastProvider";

function statusTone(status: StockRow["status"]): PillTone {
  if (status === "Out of stock") return "danger";
  if (status === "Low stock") return "warning";
  return "success";
}

// Plan section 11: `/app/pharmacy/stock` — "Facility product balances and
// batch drill-down." Phase 1's available === physical (only the AVAILABLE
// bucket exists yet, StockBucket's own why-note), so this table shows one
// number, not the physical/available/blocked triple Phase 2's holds will
// need.
export function StockListPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  // ReceiveStockScreen navigates back here with ?facilityId= so the
  // facility just received into stays selected — falling back to the
  // first facility below only when there's no such param (a fresh visit
  // to this page, not a return from receiving).
  const [facilityId, setFacilityId] = useState(searchParams.get("facilityId") ?? "");

  const facilitiesQuery = useQuery({ queryKey: ["facilities"], queryFn: getFacilities });

  useEffect(() => {
    if (!facilityId && facilitiesQuery.data && facilitiesQuery.data.length > 0) {
      setFacilityId(facilitiesQuery.data[0].id);
    }
  }, [facilityId, facilitiesQuery.data]);

  const stockQuery = useQuery({
    queryKey: ["pharmacy", "stock", facilityId],
    queryFn: () => listStock(facilityId),
    enabled: !!facilityId,
  });

  const exportMutation = useMutation({
    mutationFn: () => exportStockBalances(facilityId),
    onSuccess: () => showToast("Stock balances exported.", "success"),
    onError: (error) => {
      showToast(error instanceof ApiError ? error.message : "Couldn't export stock balances. Try again.", "error");
    },
  });

  const rows = stockQuery.data ?? [];

  return (
    <div>
      <PageHeader
        title="Stock"
        description="Live balances for this facility's product assortment."
        action={
          <Button
            variant="secondary"
            icon={<Download className="size-4" aria-hidden />}
            loading={exportMutation.isPending}
            disabled={!facilityId}
            onClick={() => exportMutation.mutate()}
          >
            Export CSV
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <Select
          label="Facility"
          options={(facilitiesQuery.data ?? []).map((f) => ({ value: f.id, label: f.name }))}
          value={facilityId}
          onChange={(e) => setFacilityId(e.target.value)}
          className="sm:w-64"
        />
        <Button
          icon={<PackagePlus className="size-4" aria-hidden />}
          disabled={!facilityId}
          onClick={() => navigate(`/app/pharmacy/stock/receive?facilityId=${facilityId}`)}
        >
          Receive stock
        </Button>
      </div>

      <Card className="overflow-hidden p-0">
        {!facilityId ? (
          <p className="px-5 py-8 text-center text-[13.5px] text-text-secondary">Select a facility.</p>
        ) : stockQuery.isLoading ? (
          <p className="px-5 py-8 text-center text-[13.5px] text-text-secondary">Loading stock…</p>
        ) : stockQuery.isError ? (
          <div role="alert" className="flex flex-col items-center gap-3 px-5 py-10 text-center">
            <p className="text-[13.5px] text-text-secondary">Stock couldn't be loaded. Please try again.</p>
            <Button variant="secondary" loading={stockQuery.isFetching} onClick={() => void stockQuery.refetch()}>
              Retry
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
            <Package className="size-5 text-text-secondary" aria-hidden />
            <p className="text-[13.5px] text-text-secondary">No stock on hand at this facility yet.</p>
          </div>
        ) : (
          <table className="w-full text-[13.5px]">
            <thead>
              <tr className="border-b border-border-subtle text-left text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                <th className="px-5 py-3 font-semibold">Product</th>
                <th className="px-5 py-3 font-semibold">Unit</th>
                <th className="px-5 py-3 text-right font-semibold">Available</th>
                <th className="px-5 py-3 text-right font-semibold">Reorder at</th>
                <th className="px-5 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {rows.map((row) => (
                <tr
                  key={row.productId}
                  className="cursor-pointer hover:bg-surface-sunken"
                  onClick={() => navigate(`/app/pharmacy/products/${row.productId}`)}
                >
                  <td className="px-5 py-3">
                    <p className="font-medium text-text-primary">{row.displayName}</p>
                    <p className="text-[12px] text-text-secondary">{row.code}</p>
                  </td>
                  <td className="px-5 py-3 text-text-secondary">{row.baseUnit.toLowerCase()}</td>
                  <td className="px-5 py-3 text-right font-semibold text-text-primary tabular-nums">{row.available}</td>
                  <td className="px-5 py-3 text-right text-text-secondary tabular-nums">
                    {row.reorderThreshold ?? "—"}
                  </td>
                  <td className="px-5 py-3">
                    <StatusPill tone={statusTone(row.status)}>{row.status}</StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
