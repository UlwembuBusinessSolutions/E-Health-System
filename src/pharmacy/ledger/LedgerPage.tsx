import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Download, ScrollText } from "lucide-react";
import { exportBatchExpiry, listLedger, listProducts } from "@/shared/api/pharmacyStock";
import { getFacilities } from "@/shared/api/facilities";
import { ApiError } from "@/shared/api/client";
import { Card } from "@/shared/components/Card";
import { Button } from "@/shared/components/Button";
import { Select } from "@/shared/components/Select";
import { PageHeader } from "@/shared/components/PageHeader";
import { useToast } from "@/shared/components/toast/ToastProvider";

const PAGE_SIZE = 50;

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-ZA", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function actionLabel(type: string): string {
  const words = type.toLowerCase().split("_");
  return words.map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(" ");
}

// Plan section 11: `/app/pharmacy/ledger` — "Movement history." Every row
// here is an immutable posted entry (rule 2) — there is deliberately no
// edit/delete affordance anywhere on this page.
export function LedgerPage() {
  const { showToast } = useToast();
  const [facilityId, setFacilityId] = useState("");
  const [productId, setProductId] = useState("");
  const [page, setPage] = useState(0);

  const facilitiesQuery = useQuery({ queryKey: ["facilities"], queryFn: getFacilities });
  const productsQuery = useQuery({
    queryKey: ["pharmacy", "products", "for-ledger-filter"],
    queryFn: () => listProducts({ activeOnly: false, size: 100 }),
  });

  useEffect(() => {
    if (!facilityId && facilitiesQuery.data && facilitiesQuery.data.length > 0) {
      setFacilityId(facilitiesQuery.data[0].id);
    }
  }, [facilityId, facilitiesQuery.data]);

  const ledgerQuery = useQuery({
    queryKey: ["pharmacy", "ledger", { facilityId, productId, page }],
    queryFn: () => listLedger({ facilityId, productId: productId || undefined, page, size: PAGE_SIZE }),
    enabled: !!facilityId,
  });

  const exportMutation = useMutation({
    mutationFn: () => exportBatchExpiry(facilityId),
    onSuccess: () => showToast("Batch/expiry report exported.", "success"),
    onError: (error) => {
      showToast(error instanceof ApiError ? error.message : "Couldn't export that report. Try again.", "error");
    },
  });

  function updateProductFilter(value: string) {
    setProductId(value);
    setPage(0);
  }

  const entries = ledgerQuery.data?.items ?? [];
  const totalItems = ledgerQuery.data?.totalItems ?? 0;
  const hasMore = ledgerQuery.data?.hasMore ?? false;

  return (
    <div>
      <PageHeader
        title="Ledger"
        description="Every posted stock movement — receipts today, adjustments and more later."
        action={
          <Button
            variant="secondary"
            icon={<Download className="size-4" aria-hidden />}
            loading={exportMutation.isPending}
            disabled={!facilityId}
            onClick={() => exportMutation.mutate()}
          >
            Export batch/expiry CSV
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Select
          label="Facility"
          options={(facilitiesQuery.data ?? []).map((f) => ({ value: f.id, label: f.name }))}
          value={facilityId}
          onChange={(e) => {
            setFacilityId(e.target.value);
            setPage(0);
          }}
          className="sm:w-56"
        />
        <Select
          label="Product"
          options={[
            { value: "", label: "All products" },
            ...(productsQuery.data?.items ?? []).map((p) => ({ value: p.id, label: p.displayName })),
          ]}
          value={productId}
          onChange={(e) => updateProductFilter(e.target.value)}
          className="sm:w-56"
        />
      </div>

      <Card className="overflow-hidden p-0">
        {!facilityId ? (
          <p className="px-5 py-8 text-center text-[13.5px] text-text-secondary">Select a facility.</p>
        ) : ledgerQuery.isLoading ? (
          <p className="px-5 py-8 text-center text-[13.5px] text-text-secondary">Loading ledger…</p>
        ) : ledgerQuery.isError ? (
          <div role="alert" className="flex flex-col items-center gap-3 px-5 py-10 text-center">
            <p className="text-[13.5px] text-text-secondary">The ledger couldn't be loaded. Please try again.</p>
            <Button variant="secondary" loading={ledgerQuery.isFetching} onClick={() => void ledgerQuery.refetch()}>
              Retry
            </Button>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
            <ScrollText className="size-5 text-text-secondary" aria-hidden />
            <p className="text-[13.5px] text-text-secondary">No movements recorded yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {entries.map((entry) => (
              <div key={entry.id} className="flex flex-col gap-1 px-5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="shrink-0 rounded bg-brand-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-brand-700">
                      {actionLabel(entry.type)}
                    </span>
                    <span className="truncate text-[13px] text-text-secondary">
                      {entry.productName} ({entry.productCode})
                      {entry.lotNumber ? ` · Lot ${entry.lotNumber}` : ""}
                    </span>
                  </div>
                  <span className="shrink-0 font-mono text-[12.5px] text-text-secondary tabular-nums">
                    {formatDateTime(entry.createdAt)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 pl-0.5 text-[12px] text-text-secondary">
                  <span className={entry.quantityDelta >= 0 ? "font-medium text-success-600" : "font-medium text-danger-600"}>
                    {entry.quantityDelta >= 0 ? "+" : ""}
                    {entry.quantityDelta}
                  </span>
                  <span>balance after: {entry.balanceAfter}</span>
                  <span>{entry.actorName}</span>
                  {entry.sourceReference && <span>ref: {entry.sourceReference}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
        {!ledgerQuery.isLoading && !ledgerQuery.isError && entries.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle px-5 py-3">
            <p className="text-[12px] text-text-secondary">
              Showing {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + entries.length} of {totalItems}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="md"
                icon={<ChevronLeft className="size-3.5" aria-hidden />}
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="md"
                icon={<ChevronRight className="size-3.5" aria-hidden />}
                disabled={!hasMore}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
