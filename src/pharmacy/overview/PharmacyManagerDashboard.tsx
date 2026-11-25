import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { Boxes, CalendarClock, CircleDollarSign, ClipboardList, PackageSearch, RefreshCw, TriangleAlert } from "lucide-react";
import { listCounts, type CountSummary } from "@/shared/api/pharmacyCounts";
import { getMonthlyPharmacyMovements, type MonthlyPharmacyMovement } from "@/shared/api/pharmacyDashboard";
import { getStockDashboard, listExpiryLots, listStock, type ExpiryLot, type StockRow } from "@/shared/api/pharmacyStock";
import { listPurchaseOrders, type PurchaseOrder } from "@/shared/api/pharmacyPlanning";
import type { Facility } from "@/shared/api/types";
import { Card } from "@/shared/components/Card";
import { PageHeader } from "@/shared/components/PageHeader";
import { Select } from "@/shared/components/Select";
import { StatusPill } from "@/shared/components/StatusPill";
import { formatDate, formatDateTime } from "../lib/format";
import { describeError } from "../lib/problem";
import { useFacilitySelection } from "../lib/useFacilitySelection";

type FacilityRow<T> = { facilityId: string; facilityName: string; item: T };

async function forFacilities<T>(
  facilities: Facility[],
  load: (facilityId: string) => Promise<T>,
): Promise<Array<{ facilityId: string; facilityName: string; value: T }>> {
  return Promise.all(facilities.map(async (facility) => ({
    facilityId: facility.id,
    facilityName: facility.name,
    value: await load(facility.id),
  })));
}

function sum<T>(values: T[], read: (value: T) => number): number {
  return values.reduce((total, value) => total + read(value), 0);
}

function monthLabel(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year, monthNumber - 1, 1).toLocaleDateString("en-ZA", { month: "short", year: "2-digit" });
}

function asOf(timestamp: number): string {
  return `As of ${formatDateTime(new Date(timestamp).toISOString())}`;
}

function scopedRows<T>(
  results: Array<{ facilityId: string; facilityName: string; value: { items: T[] } }>,
): FacilityRow<T>[] {
  return results.flatMap(({ facilityId, facilityName, value }) =>
    value.items.map((item) => ({ facilityId, facilityName, item })));
}

export function PharmacyManagerDashboard() {
  const {
    facilities, facilityId, selectFacility, isLoading: facilitiesLoading,
    error: facilitiesError, refetch: refetchFacilities,
  } = useFacilitySelection();
  const [searchParams] = useSearchParams();
  const [activityTab, setActivityTab] = useState<"REQUISITIONS" | "PURCHASE_ORDERS" | "VARIANCE">("PURCHASE_ORDERS");
  const isAllClinics = searchParams.get("facilityId") === "all" && facilities.length > 1;
  const scopeFacilities = useMemo(
    () => isAllClinics ? facilities : facilities.filter((facility) => facility.id === facilityId),
    [facilities, facilityId, isAllClinics],
  );
  const scopeKey = isAllClinics ? `all:${scopeFacilities.map((facility) => facility.id).join(",")}` : facilityId;
  const enabled = scopeFacilities.length > 0;
  const facilityQuery = (id: string) => `?facilityId=${encodeURIComponent(id)}`;

  const products = useQuery({
    queryKey: ["pharmacy", "manager-dashboard", "products", scopeKey],
    queryFn: () => forFacilities(scopeFacilities, (id) => listStock({ facilityId: id, page: 0, size: 1 })),
    enabled,
    refetchInterval: 60_000,
  });
  const lowStock = useQuery({
    queryKey: ["pharmacy", "manager-dashboard", "low-stock", scopeKey],
    queryFn: () => forFacilities(scopeFacilities, (id) => listStock({ facilityId: id, status: "LOW", page: 0, size: 6 })),
    enabled,
    refetchInterval: 60_000,
  });
  const outOfStock = useQuery({
    queryKey: ["pharmacy", "manager-dashboard", "out-of-stock", scopeKey],
    queryFn: () => forFacilities(scopeFacilities, (id) => listStock({ facilityId: id, status: "OUT", page: 0, size: 4 })),
    enabled,
    refetchInterval: 60_000,
  });
  const expiring = useQuery({
    queryKey: ["pharmacy", "manager-dashboard", "expiring", scopeKey],
    queryFn: () => forFacilities(scopeFacilities,
      (id) => listExpiryLots(id, 30, false, 0, 8)),
    enabled,
    refetchInterval: 60_000,
  });
  const stockDashboard = useQuery({
    queryKey: ["pharmacy", "manager-dashboard", "queue", scopeKey],
    queryFn: () => forFacilities(scopeFacilities, getStockDashboard),
    enabled,
    refetchInterval: 60_000,
  });
  const monthly = useQuery({
    queryKey: ["pharmacy", "manager-dashboard", "monthly-movements", scopeKey],
    queryFn: () => forFacilities(scopeFacilities, getMonthlyPharmacyMovements),
    enabled,
    refetchInterval: 60_000,
  });
  const orders = useQuery({
    queryKey: ["pharmacy", "manager-dashboard", "activity", "orders", scopeKey],
    queryFn: () => forFacilities(scopeFacilities, (id) => listPurchaseOrders(id, 0, 8)),
    enabled: enabled && activityTab === "PURCHASE_ORDERS",
    refetchInterval: 60_000,
  });
  const variances = useQuery({
    queryKey: ["pharmacy", "manager-dashboard", "activity", "variances", scopeKey],
    queryFn: () => forFacilities(scopeFacilities, (id) => listCounts(id, "POSTED")),
    enabled: enabled && activityTab === "VARIANCE",
    refetchInterval: 60_000,
  });

  const timestamps = [
    products, lowStock, outOfStock, expiring, stockDashboard, monthly,
    ...(activityTab === "PURCHASE_ORDERS" ? [orders] : []),
    ...(activityTab === "VARIANCE" ? [variances] : []),
  ].filter((query) => query.data !== undefined && !query.isError).map((query) => query.dataUpdatedAt);
  const dashboardAsOf = timestamps.length ? Math.min(...timestamps) : null;
  const lowRows = lowStock.data ? scopedRows(lowStock.data).sort((a, b) => a.item.available - b.item.available) : [];
  const outRows = outOfStock.data ? scopedRows(outOfStock.data) : [];
  const expiryRows = expiring.data
    ? scopedRows(expiring.data).sort((a, b) => a.item.expiryDate.localeCompare(b.item.expiryDate)).slice(0, 8)
    : [];
  const movementMonths = useMemo(() => {
    if (!monthly.data) return [];
    const totals = new Map<string, number>();
    for (const { value } of monthly.data) {
      for (const row of value) totals.set(row.month, (totals.get(row.month) ?? 0) + row.postedTransactions);
    }
    return [...totals.entries()].sort(([a], [b]) => a.localeCompare(b))
      .map(([month, postedTransactions]) => ({ month, postedTransactions }));
  }, [monthly.data]);

  function chooseScope(value: string) {
    selectFacility(value);
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Pharmacy dashboard"
        description="Clinic-scoped products, stock risks, purchasing and posted inventory activity."
        action={
          facilities.length > 1 ? (
            <Select
              label="Clinic"
              value={isAllClinics ? "all" : facilityId}
              options={[
                { value: "all", label: "All clinics" },
                ...facilities.map((facility) => ({ value: facility.id, label: facility.name })),
              ]}
              onChange={(event) => chooseScope(event.target.value)}
            />
          ) : undefined
        }
      />

      {dashboardAsOf !== null && <p className="-mt-5 text-xs text-text-secondary">{asOf(dashboardAsOf)}</p>}
      {facilitiesError && (
        <PanelError message={describeError(facilitiesError, "Clinics could not be loaded.")}
          retrying={false} onRetry={() => void refetchFacilities()} />
      )}
      {!facilitiesLoading && !facilitiesError && facilities.length === 0 && (
        <Card className="p-5"><p className="text-sm text-text-secondary">No clinics are available to this account.</p></Card>
      )}

      {enabled && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard title="Products listed" icon={Boxes} query={products}
              value={(data) => sum(data, (row) => row.value.totalItems)}
              to={isAllClinics ? undefined : `/app/pharmacy/stock${facilityQuery(facilityId)}`} />
            <MetricCard title="Low-stock products" icon={TriangleAlert} query={lowStock}
              value={(data) => sum(data, (row) => row.value.totalItems)}
              to={isAllClinics ? undefined : `/app/pharmacy/stock${facilityQuery(facilityId)}`} tone="warning" />
            <MetricCard title="Out of stock" icon={PackageSearch} query={outOfStock}
              value={(data) => sum(data, (row) => row.value.totalItems)}
              to={isAllClinics ? undefined : `/app/pharmacy/stock${facilityQuery(facilityId)}`} tone="danger" />
            <MetricCard title="Expiring in 30 days" icon={CalendarClock} query={expiring}
              value={(data) => sum(data, (row) => row.value.totalItems)}
              to={isAllClinics ? undefined : `/app/pharmacy/stock${facilityQuery(facilityId)}`} />
            <MetricCard title="Awaiting dispensing" icon={ClipboardList} query={stockDashboard}
              value={(data) => sum(data, (row) => row.value.awaitingCollectionCount)}
              to={`/app/pharmacy/dispensing${facilityQuery(facilityId)}`} />
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <StockRiskPanel title="Low stock" description="Products at or below their configured minimum."
              query={lowStock} rows={lowRows} facilityQuery={facilityQuery} facilityId={facilityId}
              kind="low" allClinics={isAllClinics} />
            <StockRiskPanel title="Out of stock" description="Active clinic products with no available balance."
              query={outOfStock} rows={outRows} facilityQuery={facilityQuery} facilityId={facilityId}
              kind="out" allClinics={isAllClinics} />
            <ExpiryPanel query={expiring} rows={expiryRows} facilityQuery={facilityQuery} facilityId={facilityId}
              allClinics={isAllClinics} />
            <MovementPanel query={monthly} months={movementMonths}
              facilityId={isAllClinics ? null : facilityId} />
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <RecentActivity
              activeTab={activityTab}
              onTabChange={setActivityTab}
              orders={orders}
              orderRows={orders.data ? scopedRows(orders.data).sort(
                (a, b) => b.item.createdAt.localeCompare(a.item.createdAt)).slice(0, 8) : []}
              variances={variances}
              varianceRows={variances.data ? variances.data.flatMap(({ facilityId: id, facilityName, value }) =>
                value.filter((count) => (count.differences ?? 0) > 0)
                  .map((item) => ({ facilityId: id, facilityName, item })))
                .sort((a, b) => (b.item.postedAt ?? "").localeCompare(a.item.postedAt ?? "")).slice(0, 8) : []}
              facilityQuery={facilityQuery}
              defaultFacilityId={facilityId}
              allClinics={isAllClinics}
            />
            <BudgetPanel />
          </div>

          {!isAllClinics ? <div className="flex flex-wrap gap-3">
            <ActionLink to={`/app/pharmacy/products/new${facilityQuery(facilityId)}`}>New product</ActionLink>
            <ActionLink to={`/app/pharmacy/stock${facilityQuery(facilityId)}`}>View all products</ActionLink>
            <ActionLink to={`/app/pharmacy/reorder${facilityQuery(facilityId)}`}>Create purchase order</ActionLink>
            <ActionLink to={`/app/pharmacy/purchase-orders${facilityQuery(facilityId)}`}>Purchase orders</ActionLink>
            <ActionLink to={`/app/pharmacy/counts${facilityQuery(facilityId)}`}>Start stock take</ActionLink>
          </div> : <p className="text-xs text-text-secondary">Choose a clinic above to open its product, reorder, purchase order or stock-take screen.</p>}
        </>
      )}
    </div>
  );
}

type IconType = typeof Boxes;
type QueryLike<T> = {
  data: T | undefined;
  error: Error | null;
  isError: boolean;
  isLoading: boolean;
  isFetching: boolean;
  dataUpdatedAt: number;
  refetch: () => Promise<unknown>;
};

function MetricCard<T>({
  title, icon: Icon, query, value, to, tone = "brand",
}: {
  title: string;
  icon: IconType;
  query: QueryLike<T>;
  value: (data: T) => number;
  to?: string;
  tone?: "brand" | "warning" | "danger";
}) {
  const number = query.data === undefined || query.isError ? null : value(query.data);
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] text-text-secondary">{title}</span>
        <Icon className={`size-4 ${tone === "danger" ? "text-danger-600" : tone === "warning" ? "text-amber-600" : "text-brand-600"}`} aria-hidden />
      </div>
      {query.isLoading && <div role="status" className="mt-3 h-8 w-16 animate-pulse rounded bg-surface-sunken" />}
      {query.isError && <p role="alert" className="mt-2 text-xs text-danger-600">Unavailable</p>}
      {!query.isLoading && !query.isError && number !== null && (
        to ? (
          <Link to={to} className="mt-2 inline-block text-[28px] font-semibold leading-tight text-text-primary hover:text-brand-700">
            {number.toLocaleString("en-ZA")}
          </Link>
        ) : <p className="mt-2 text-[28px] font-semibold leading-tight text-text-primary">{number.toLocaleString("en-ZA")}</p>
      )}
      {!query.isError && query.data !== undefined && <p className="mt-2 text-[11px] text-text-secondary">{asOf(query.dataUpdatedAt)}</p>}
      {query.isError && <button type="button" className="mt-2 text-xs font-medium text-brand-700 underline" onClick={() => void query.refetch()}>Retry</button>}
    </Card>
  );
}

function StockRiskPanel({
  title, description, query, rows, facilityQuery, kind,
  facilityId, allClinics,
}: {
  title: string;
  description: string;
  query: QueryLike<Array<{ facilityId: string; facilityName: string; value: ReturnType<typeof listStock> extends Promise<infer R> ? R : never }>>;
  rows: FacilityRow<StockRow>[];
  facilityQuery: (id: string) => string;
  facilityId: string;
  kind: "low" | "out";
  allClinics: boolean;
}) {
  const total = query.data ? sum(query.data, (row) => row.value.totalItems) : 0;
  return (
    <Card className="overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-border-subtle px-5 py-4">
        <div>
          <h2 className="font-semibold text-text-primary">{title}</h2>
          <p className="mt-1 text-xs text-text-secondary">{description}</p>
        </div>
        {!allClinics && <Link to={`/app/pharmacy/stock${facilityQuery(facilityId)}`}
          className="shrink-0 text-xs font-semibold text-brand-700 hover:underline">View all</Link>}
      </div>
      <AsyncState query={query} empty={total === 0 ? `No ${kind === "low" ? "low-stock" : "out-of-stock"} products.` : null}>
        <div className="divide-y divide-border-subtle">
          {rows.slice(0, 6).map(({ facilityId, facilityName, item }) => (
            <div key={`${facilityId}:${item.productId}`} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <Link to={`/app/pharmacy/stock${facilityQuery(facilityId)}`}
                  className="block truncate text-sm font-medium text-text-primary hover:text-brand-700">{item.displayName}</Link>
                <p className="text-xs text-text-secondary">{facilityName} · On hand {item.available} · Minimum {item.reorderThreshold ?? "Not set"}</p>
              </div>
              <StatusPill tone={kind === "out" ? "danger" : "warning"}>{kind === "out" ? "Out of stock" : "Low stock"}</StatusPill>
            </div>
          ))}
          {total > Math.min(rows.length, 6) && <p className="px-5 py-3 text-xs text-text-secondary">Showing {Math.min(rows.length, 6)} of {total} products.</p>}
        </div>
      </AsyncState>
    </Card>
  );
}

function ExpiryPanel({
  query, rows, facilityQuery, facilityId, allClinics,
}: {
  query: QueryLike<Array<{ facilityId: string; facilityName: string; value: Awaited<ReturnType<typeof listExpiryLots>> }>>;
  rows: FacilityRow<ExpiryLot>[];
  facilityQuery: (id: string) => string;
  facilityId: string;
  allClinics: boolean;
}) {
  const total = query.data ? sum(query.data, (row) => row.value.totalItems) : 0;
  return (
    <Card className="overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-border-subtle px-5 py-4">
        <div>
          <h2 className="font-semibold text-text-primary">Expiry risk · next 30 days</h2>
          <p className="mt-1 text-xs text-text-secondary">In-stock batches expiring from today through day 30, inclusive.</p>
        </div>
        {!allClinics && <Link to={`/app/pharmacy/stock${facilityQuery(facilityId)}`}
          className="shrink-0 text-xs font-semibold text-brand-700 hover:underline">View stock</Link>}
      </div>
      <AsyncState query={query} empty={total === 0 ? "No positive-balance batches expire in this period." : null}>
        <div className="divide-y divide-border-subtle">
          {rows.map(({ facilityId, facilityName, item }) => (
            <div key={`${facilityId}:${item.batchId}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
              <div className="min-w-0">
                <Link to={`/app/pharmacy/stock${facilityQuery(facilityId)}`}
                  className="block truncate text-sm font-medium text-text-primary hover:text-brand-700">{item.productName}</Link>
                <p className="text-xs text-text-secondary">{facilityName} · Batch {item.lotNumber} · Available {item.quantity}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-text-primary">{formatDate(item.expiryDate)}</p>
                <p className="text-xs text-text-secondary">{item.daysToExpiry === 0 ? "Expires today" : `${item.daysToExpiry} days`}</p>
              </div>
            </div>
          ))}
          {total > rows.length && <p className="px-5 py-3 text-xs text-text-secondary">Showing {rows.length} of {total} batches.</p>}
        </div>
      </AsyncState>
    </Card>
  );
}

function MovementPanel({
  query, months, facilityId,
}: {
  query: QueryLike<Array<{ facilityId: string; facilityName: string; value: MonthlyPharmacyMovement[] }>>;
  months: MonthlyPharmacyMovement[];
  facilityId: string | null;
}) {
  const max = Math.max(1, ...months.map((row) => row.postedTransactions));
  const hasActivity = months.some((row) => row.postedTransactions > 0);
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-text-primary">Posted stock movements</h2>
          <p className="mt-1 text-xs text-text-secondary">Monthly transaction totals from the posted stock ledger, including the current month.</p>
        </div>
        {facilityId && <Link to={`/app/pharmacy/ledger?facilityId=${encodeURIComponent(facilityId)}`}
          className="text-xs font-semibold text-brand-700 hover:underline">Open ledger</Link>}
      </div>
      <AsyncState query={query} empty={!hasActivity ? "No stock transactions were posted in these six months." : null}>
        <div className="mt-5 flex h-40 items-end gap-2 border-b border-border-subtle pb-2">
          {months.map((row) => (
            <div key={row.month} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[11px] tabular-nums text-text-secondary">{row.postedTransactions || ""}</span>
              <div
                className="w-full max-w-10 rounded-t bg-brand-500"
                style={{ height: `${Math.max(row.postedTransactions > 0 ? 6 : 0, row.postedTransactions / max * 100)}%` }}
                aria-label={`${row.postedTransactions} posted transactions`}
              />
              <span className="whitespace-nowrap text-[10px] text-text-secondary">{monthLabel(row.month)}</span>
            </div>
          ))}
        </div>
        {query.data !== undefined && <p className="mt-3 text-[11px] text-text-secondary">{asOf(query.dataUpdatedAt)}</p>}
      </AsyncState>
    </Card>
  );
}

function RecentActivity({
  activeTab, onTabChange, orders, orderRows, variances, varianceRows, facilityQuery, defaultFacilityId, allClinics,
}: {
  activeTab: "REQUISITIONS" | "PURCHASE_ORDERS" | "VARIANCE";
  onTabChange: (tab: "REQUISITIONS" | "PURCHASE_ORDERS" | "VARIANCE") => void;
  orders: QueryLike<Array<{ facilityId: string; facilityName: string; value: Awaited<ReturnType<typeof listPurchaseOrders>> }>>;
  orderRows: FacilityRow<PurchaseOrder>[];
  variances: QueryLike<Array<{ facilityId: string; facilityName: string; value: CountSummary[] }>>;
  varianceRows: FacilityRow<CountSummary>[];
  facilityQuery: (id: string) => string;
  defaultFacilityId: string;
  allClinics: boolean;
}) {
  const tabs = [
    ["REQUISITIONS", "Requisitions"],
    ["PURCHASE_ORDERS", "Purchase orders"],
    ["VARIANCE", "Variance"],
  ] as const;
  const orderTotal = orders.data ? sum(orders.data, (row) => row.value.totalItems) : 0;
  const hasVariance = varianceRows.length > 0;
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border-subtle px-5 pt-4">
        <h2 className="font-semibold text-text-primary">Recent activity</h2>
        <div className="mt-3 flex gap-4 overflow-x-auto" role="tablist" aria-label="Recent pharmacy activity">
          {tabs.map(([value, label]) => (
            <button key={value} type="button" role="tab" aria-selected={activeTab === value}
              onClick={() => onTabChange(value)}
              className={`shrink-0 border-b-2 pb-2 text-[13px] font-medium ${activeTab === value ? "border-brand-500 text-brand-700" : "border-transparent text-text-secondary"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {activeTab === "REQUISITIONS" ? (
        <div className="px-5 py-5">
          <p className="text-sm font-medium text-text-primary">Requisition tracking is unavailable.</p>
          <p className="mt-1 text-xs text-text-secondary">This system does not yet record requisition events. Use Reorder List to prepare and issue supplier purchase orders.</p>
          {allClinics
            ? <p className="mt-2 text-xs text-text-secondary">Choose a clinic to open its Reorder List.</p>
            : <Link className="mt-3 inline-block text-xs font-semibold text-brand-700 hover:underline"
              to={`/app/pharmacy/reorder${facilityQuery(defaultFacilityId)}`}>Open Reorder List</Link>}
        </div>
      ) : activeTab === "PURCHASE_ORDERS" ? (
        <AsyncState query={orders} empty={orderTotal === 0 ? "No purchase orders have been recorded." : null}>
          <ul className="divide-y divide-border-subtle">
            {orderRows.map(({ facilityId, facilityName, item }) => (
              <li key={`${facilityId}:${item.id}`} className="px-5 py-3">
                <Link to={`/app/pharmacy/purchase-orders${facilityQuery(facilityId)}&orderId=${encodeURIComponent(item.id)}`}
                  className="flex items-start justify-between gap-3 hover:text-brand-700">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{item.poNumber} · {item.supplierName}</span>
                    <span className="block text-xs text-text-secondary">{facilityName} · {formatDateTime(item.createdAt)}</span>
                  </span>
                  <StatusPill tone="neutral">Created</StatusPill>
                </Link>
              </li>
            ))}
          </ul>
        </AsyncState>
      ) : (
        <AsyncState query={variances} empty={!hasVariance ? "No posted stock counts with variances." : null}>
          <ul className="divide-y divide-border-subtle">
            {varianceRows.map(({ facilityId, facilityName, item }) => (
              <li key={`${facilityId}:${item.id}`} className="px-5 py-3">
                <Link to={`/app/pharmacy/counts${facilityQuery(facilityId)}&countId=${encodeURIComponent(item.id)}`}
                  className="flex items-start justify-between gap-3 hover:text-brand-700">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{item.reference} · {item.scopeLabel}</span>
                    <span className="block text-xs text-text-secondary">{facilityName} · {item.postedAt ? formatDateTime(item.postedAt) : "Timestamp unavailable"} · {item.differences} differences</span>
                  </span>
                  <StatusPill tone="success">Posted</StatusPill>
                </Link>
              </li>
            ))}
          </ul>
        </AsyncState>
      )}
      {activeTab === "PURCHASE_ORDERS" && orders.data !== undefined && (
        <div className="border-t border-border-subtle px-5 py-3 text-[11px] text-text-secondary">
          {asOf(orders.dataUpdatedAt)} · {orderTotal.toLocaleString("en-ZA")} orders
        </div>
      )}
      {activeTab === "VARIANCE" && variances.data !== undefined && (
        <div className="border-t border-border-subtle px-5 py-3 text-[11px] text-text-secondary">{asOf(variances.dataUpdatedAt)}</div>
      )}
    </Card>
  );
}

function BudgetPanel() {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <CircleDollarSign className="size-4 text-text-secondary" aria-hidden />
        <h2 className="font-semibold text-text-primary">Budget and spend</h2>
      </div>
      <p className="mt-4 text-[15px] font-semibold text-text-primary">No budget configured</p>
      <p className="mt-1 text-xs text-text-secondary">
        Budget allocations and transaction cost values are not configured, so spend and remaining amounts cannot be calculated.
      </p>
    </Card>
  );
}

function AsyncState<T>({
  query, empty, children,
}: {
  query: QueryLike<T>;
  empty: string | null;
  children: ReactNode;
}) {
  if (query.isLoading) return <p role="status" className="px-5 py-5 text-sm text-text-secondary">Loading…</p>;
  if (query.isError) {
    return <PanelError message={describeError(query.error, "This panel could not be loaded.")}
      retrying={query.isFetching} onRetry={() => void query.refetch()} />;
  }
  if (empty) return <p className="px-5 py-5 text-sm text-text-secondary">{empty}</p>;
  return <>{children}</>;
}

function PanelError({ message, retrying, onRetry }: { message: string; retrying: boolean; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
      <p className="text-sm text-danger-600">{message}</p>
      <button type="button" disabled={retrying} onClick={onRetry}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 disabled:opacity-60">
        <RefreshCw className={`size-3.5 ${retrying ? "animate-spin" : ""}`} aria-hidden /> Retry
      </button>
    </div>
  );
}

function ActionLink({ to, children }: { to: string; children: string }) {
  return (
    <Link to={to} className="rounded-lg border border-border-strong bg-surface-raised px-4 py-2.5 text-sm font-semibold text-text-primary hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400">
      {children}
    </Link>
  );
}
