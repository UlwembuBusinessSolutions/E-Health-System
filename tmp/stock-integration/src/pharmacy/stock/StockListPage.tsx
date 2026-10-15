import { useEffect, useRef, useState } from "react";
import { generateUUID } from "@/utils/uuid";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, ClipboardCheck, Download, Package, PackagePlus, SlidersHorizontal, X } from "lucide-react";
import {
  exportStockBalances,
  listStock,
  listStockAccounts,
  listStockAlerts,
  postStockCount,
  updateReorderThreshold,
  type StockRow,
  type StockCountPayload,
} from "@/shared/api/pharmacyStock";
import { getFacilities } from "@/shared/api/facilities";
import { ApiError } from "@/shared/api/client";
import { Card } from "@/shared/components/Card";
import { Button } from "@/shared/components/Button";
import { Select } from "@/shared/components/Select";
import { PageHeader } from "@/shared/components/PageHeader";
import { StatusPill, type PillTone } from "@/shared/components/StatusPill";
import { Input } from "@/shared/components/Input";
import { useToast } from "@/shared/components/toast/ToastProvider";
import { useAuth } from "@/auth/AuthContext";

const STOCK_MANAGER_ROLES = new Set([
  "ORG_ADMIN",
  "Doctor",
  "Medical Officer",
  "Professional Nurse",
  "Pharmacist",
  "Stock Control Manager",
]);

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
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  const { user } = useAuth();
  const canManageStock = STOCK_MANAGER_ROLES.has(user?.role ?? "");
  // ReceiveStockScreen navigates back here with ?facilityId= so the
  // facility just received into stays selected — falling back to the
  // first facility below only when there's no such param (a fresh visit
  // to this page, not a return from receiving).
  const [facilityId, setFacilityId] = useState(searchParams.get("facilityId") ?? "");
  const [selectedAction, setSelectedAction] = useState<{
    mode: "count" | "reorder";
    row: StockRow;
  } | null>(null);
  const [countAccountId, setCountAccountId] = useState("");
  const [countExpectedQuantity, setCountExpectedQuantity] = useState<number | null>(null);
  const [countReviewed, setCountReviewed] = useState(false);
  const [countedQuantity, setCountedQuantity] = useState("");
  const [countReason, setCountReason] = useState("");
  const [countError, setCountError] = useState<string | null>(null);
  const [reorderValue, setReorderValue] = useState("");
  const [reorderError, setReorderError] = useState<string | null>(null);
  const countAttempt = useRef<{ body: string; key: string } | null>(null);

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
    refetchInterval: 5000,
  });

  const alertsQuery = useQuery({
    queryKey: ["pharmacy", "stock-alerts", facilityId],
    queryFn: () => listStockAlerts(facilityId),
    enabled: !!facilityId,
    refetchInterval: 5000,
  });

  const accountsQuery = useQuery({
    queryKey: ["pharmacy", "stock-accounts", facilityId, selectedAction?.row.productId],
    queryFn: () => listStockAccounts(facilityId, selectedAction!.row.productId),
    enabled: !!facilityId && selectedAction?.mode === "count",
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!accountsQuery.data?.length) return;
    const currentAccount = accountsQuery.data.find((account) => account.accountId === countAccountId);
    if (!currentAccount || countExpectedQuantity === null) {
      const snapshot = currentAccount ?? accountsQuery.data[0];
      setCountAccountId(snapshot.accountId);
      setCountExpectedQuantity(snapshot.quantity);
    }
  }, [accountsQuery.data, countAccountId, countExpectedQuantity]);

  const exportMutation = useMutation({
    mutationFn: () => exportStockBalances(facilityId),
    onSuccess: () => showToast("Stock balances exported.", "success"),
    onError: (error) => {
      showToast(error instanceof ApiError ? error.message : "Couldn't export stock balances. Try again.", "error");
    },
  });

  const countMutation = useMutation({
    mutationFn: ({ payload, key }: { payload: StockCountPayload; key: string }) => postStockCount(payload, key),
    onSuccess: () => {
      showToast("Stock count recorded as an audited adjustment.", "success");
      countAttempt.current = null;
      setSelectedAction(null);
      void queryClient.invalidateQueries({ queryKey: ["pharmacy", "stock", facilityId] });
      void queryClient.invalidateQueries({ queryKey: ["pharmacy", "stock-alerts", facilityId] });
      void queryClient.invalidateQueries({ queryKey: ["pharmacy", "stock-accounts", facilityId] });
      void queryClient.invalidateQueries({ queryKey: ["pharmacy", "ledger"] });
    },
    onError: (error) => {
      setCountError(error instanceof ApiError ? error.message : "Couldn't post the count. Please try again.");
    },
  });

  const reorderMutation = useMutation({
    mutationFn: updateReorderThreshold,
    onSuccess: () => {
      showToast("Reorder level updated.", "success");
      setSelectedAction(null);
      void queryClient.invalidateQueries({ queryKey: ["pharmacy", "stock", facilityId] });
      void queryClient.invalidateQueries({ queryKey: ["pharmacy", "stock-alerts", facilityId] });
    },
    onError: (error) => {
      setReorderError(error instanceof ApiError ? error.message : "Couldn't update the reorder level. Please try again.");
    },
  });

  function openCount(row: StockRow) {
    setCountExpectedQuantity(null);
    setCountReviewed(false);
    setSelectedAction({ mode: "count", row });
    setCountAccountId("");
    setCountedQuantity("");
    setCountReason("");
    setCountError(null);
  }

  function openReorder(row: StockRow) {
    setSelectedAction({ mode: "reorder", row });
    setReorderValue(row.reorderThreshold === null ? "" : String(row.reorderThreshold));
    setReorderError(null);
  }

  function submitCount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const account = accountsQuery.data?.find((item) => item.accountId === countAccountId);
    const counted = Number(countedQuantity);
    if (!account || countExpectedQuantity === null || !/^\d+$/.test(countedQuantity) || !Number.isSafeInteger(counted) || counted < 0) {
      setCountError("Choose a stock account and enter a non-negative whole-number count.");
      return;
    }
    if (!countReason.trim()) {
      setCountError("Enter a reason for this stock count.");
      return;
    }
    if (!countReviewed) { setCountError("Review and confirm the count variance before posting."); return; }
    const payload: StockCountPayload = {
      facilityId,
      productId: selectedAction!.row.productId,
      accountId: countAccountId,
      expectedQuantity: countExpectedQuantity,
      countedQuantity: counted,
      reason: countReason.trim(),
    };
    const body = JSON.stringify(payload);
    if (countAttempt.current?.body !== body) {
      countAttempt.current = { body, key: generateUUID() };
    }
    setCountError(null);
    countMutation.mutate({ payload, key: countAttempt.current.key });
  }

  function submitReorder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const threshold = reorderValue.trim() === "" ? null : Number(reorderValue);
    if (threshold !== null && (!Number.isSafeInteger(threshold) || threshold < 0 || threshold > 2147483647)) {
      setReorderError("Enter a non-negative whole number, or leave blank to disable alerts.");
      return;
    }
    setReorderError(null);
    reorderMutation.mutate({ facilityId, productId: selectedAction!.row.productId, reorderThreshold: threshold });
  }

  function closeAction() {
    setSelectedAction(null);
    setCountError(null);
    setReorderError(null);
  }

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
          onChange={(e) => {
            setFacilityId(e.target.value);
            setSelectedAction(null);
            countAttempt.current = null;
          }}
          className="sm:w-64"
        />
        {canManageStock && (
          <Button
            icon={<PackagePlus className="size-4" aria-hidden />}
            disabled={!facilityId}
            onClick={() => navigate(`/app/pharmacy/stock/receive?facilityId=${facilityId}`)}
          >
            Receive stock
          </Button>
        )}
      </div>

      {(alertsQuery.data?.length ?? 0) > 0 && (
        <Card role="alert" className="mb-4 border border-warning-500/30 bg-warning-50 p-4">
          <div className="mb-2 flex items-center gap-2 text-[13.5px] font-semibold text-warning-700">
            <AlertTriangle className="size-4" aria-hidden />
            Reorder alerts <span className="font-normal">({alertsQuery.data?.length})</span>
          </div>
          <ul className="flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-text-primary">
            {alertsQuery.data?.map((alert) => (
              <li key={alert.productId}>
                {alert.displayName}: <strong>{alert.available}</strong> {alert.baseUnit.toLowerCase()} on hand
                {alert.reorderThreshold !== null && ` (reorder at ${alert.reorderThreshold})`}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="mb-3 text-sm text-text-secondary">Stock balances and reorder alerts refresh every 5 seconds.</p>
      <Card className="overflow-x-auto p-0">
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
                {canManageStock && <th className="px-5 py-3 text-right font-semibold">Actions</th>}
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
                  {canManageStock && (
                    <td className="px-5 py-2 text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          variant="ghost"
                          icon={<ClipboardCheck className="size-4" aria-hidden />}
                          aria-label={`Count ${row.displayName}`}
                          title="Record stock count"
                          onClick={(event) => {
                            event.stopPropagation();
                            openCount(row);
                          }}
                        >
                          Count
                        </Button>
                        <Button
                          variant="ghost"
                          icon={<SlidersHorizontal className="size-4" aria-hidden />}
                          aria-label={`Set reorder level for ${row.displayName}`}
                          title="Set reorder level"
                          onClick={(event) => {
                            event.stopPropagation();
                            openReorder(row);
                          }}
                        >
                          Reorder
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {canManageStock && selectedAction && (
        <Card className="mt-4 p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[15px] font-semibold text-text-primary">
                {selectedAction.mode === "count" ? "Record stock count" : "Set reorder level"}
              </h2>
              <p className="mt-1 text-[13px] text-text-secondary">
                {selectedAction.row.displayName} · current available {selectedAction.row.available} {selectedAction.row.baseUnit.toLowerCase()}
              </p>
            </div>
            <Button variant="ghost" icon={<X className="size-4" aria-hidden />} aria-label="Close" onClick={closeAction} />
          </div>

          {selectedAction.mode === "count" ? (
            <form onSubmit={submitCount} className="flex flex-col gap-4">
              {countError && <p role="alert" className="text-[13px] text-danger-600">{countError}</p>}
              {accountsQuery.isLoading ? (
                <p className="text-[13px] text-text-secondary">Loading batch balances…</p>
              ) : accountsQuery.isError ? (
                <p role="alert" className="text-[13px] text-danger-600">Couldn't load stock accounts. Close and try again.</p>
              ) : (accountsQuery.data?.length ?? 0) === 0 ? (
                <p className="text-[13px] text-text-secondary">There are no stock accounts to count for this product.</p>
              ) : (
                <>
                  <label className="flex flex-col gap-1.5 text-[13px] font-medium text-text-primary">
                    Batch / stock account
                    <select
                      className="h-11 rounded-lg border border-border-strong bg-surface-raised px-3.5 text-[14px] text-text-primary"
                      value={countAccountId}
                      onChange={(event) => {
                        const account = accountsQuery.data?.find((item) => item.accountId === event.target.value);
                        setCountAccountId(event.target.value);
                        setCountExpectedQuantity(account?.quantity ?? null);
                        setCountedQuantity("");
                        setCountReviewed(false);
                      }}
                    >
                      {(accountsQuery.data ?? []).map((account) => (
                        <option key={account.accountId} value={account.accountId}>
                          {account.lotNumber} · {account.bucket.toLowerCase()} · {account.quantity} on hand
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input label="Expected quantity" value={countExpectedQuantity ?? ""} readOnly />
                    <Input
                      label="Counted quantity"
                      type="number"
                      min="0"
                      step="1"
                      value={countedQuantity}
                      onChange={(event) => { setCountedQuantity(event.target.value); setCountReviewed(false); }}
                      required
                    />
                  </div>
                  <Input
                    label="Reason for count / variance"
                    value={countReason}
                    onChange={(event) => { setCountReason(event.target.value); setCountReviewed(false); }}
                    maxLength={500}
                    required
                    hint="The variance is posted as an audited adjustment; the balance is never overwritten."
                  />
                  <div>
                    <p className="mb-3">Variance: {countedQuantity !== "" && countExpectedQuantity !== null ? Number(countedQuantity) - countExpectedQuantity : "—"}</p>
                    <label className="mb-3 block"><input type="checkbox" checked={countReviewed} onChange={e => setCountReviewed(e.target.checked)} /> I have reviewed the batch, count, and variance.</label>
                    <Button type="submit" disabled={!countReviewed} loading={countMutation.isPending} icon={<ClipboardCheck className="size-4" aria-hidden />}>
                      Post audited count
                    </Button>
                    <Button type="button" variant="secondary" className="ml-3" disabled={countMutation.isPending} onClick={async () => {
                      setCountedQuantity(""); setCountReviewed(false); setCountError(null);
                      const result = await accountsQuery.refetch();
                      const snapshot = result.data?.find(a => a.accountId === countAccountId) ?? result.data?.[0];
                      setCountAccountId(snapshot?.accountId ?? ""); setCountExpectedQuantity(snapshot?.quantity ?? null);
                    }}>Refresh and recount</Button>
                  </div>
                </>
              )}
            </form>
          ) : (
            <form onSubmit={submitReorder} className="flex flex-col gap-4 sm:max-w-md">
              {reorderError && <p role="alert" className="text-[13px] text-danger-600">{reorderError}</p>}
              <Input
                label="Reorder threshold"
                type="number"
                min="0"
                step="1"
                value={reorderValue}
                onChange={(event) => setReorderValue(event.target.value)}
                hint="An alert is active when available stock is at or below this quantity. Leave blank to disable."
              />
              <div className="flex gap-2">
                <Button type="submit" loading={reorderMutation.isPending}>Save reorder level</Button>
                <Button type="button" variant="secondary" onClick={closeAction}>Cancel</Button>
              </div>
            </form>
          )}
        </Card>
      )}
    </div>
  );
}
