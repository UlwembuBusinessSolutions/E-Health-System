import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ClipboardCheck, Download, PackagePlus, Plus, ShoppingCart, SearchX, Package } from "lucide-react";
import { exportStockBalances, type AdjustmentMode, type StockRow } from "@/shared/api/pharmacyStock";
import { Button } from "@/shared/components/Button";
import { PageHeader } from "@/shared/components/PageHeader";
import { Select } from "@/shared/components/Select";
import { useToast } from "@/shared/components/toast/ToastProvider";
import { EmptyState } from "../components/EmptyState";
import { PageToolbar } from "../components/PageToolbar";
import { ResponsiveTable } from "../components/ResponsiveTable";
import { describeError } from "../lib/problem";
import { AdjustStockDialog } from "./AdjustStockDialog";
import { EditProductDialog } from "./EditProductDialog";
import { LinkButton } from "./LinkButton";
import { ProductDetailsPanel } from "./ProductDetailsPanel";
import { StockFilterBar } from "./StockFilterBar";
import { buildStockColumns } from "./stockColumns";
import { STOCK_PAGE_SIZE, useStockDashboard, useStockList } from "./stockQueries";
import { useFacilitySelection } from "./useFacilitySelection";
import { useStockFilters } from "./useStockFilters";

interface AdjustTarget {
  row: StockRow;
  mode: AdjustmentMode;
  batchId?: string;
}

const ICON = "size-4";

export function StockPage() {
  const { showToast } = useToast();
  const { facilities, facilityId, selectFacility, isLoading: facilitiesLoading } = useFacilitySelection();
  const filters = useStockFilters();
  const stock = useStockList({
    facilityId,
    q: filters.query,
    status: filters.status,
    archived: filters.archived,
    page: filters.page,
  });
  const dashboard = useStockDashboard(facilityId);

  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState<AdjustTarget | null>(null);
  const [editing, setEditing] = useState<StockRow | null>(null);

  const exportCsv = useMutation({
    mutationFn: () => exportStockBalances(facilityId),
    onSuccess: () => showToast("Stock balances exported.", "success"),
    onError: (error) => showToast(describeError(error, "Couldn't export stock balances. Try again."), "error"),
  });

  function changeFacility(id: string) {
    selectFacility(id);
    filters.resetPage();
    setExpandedProductId(null);
  }

  function toggleExpanded(productId: string) {
    setExpandedProductId((current) => (current === productId ? null : productId));
  }

  const columns = buildStockColumns({
    expandedProductId,
    onToggleExpanded: toggleExpanded,
    onAdjust: (row) => setAdjusting({ row, mode: "REMOVE" }),
  });

  const data = stock.data;
  const facilityQuery = `?facilityId=${facilityId}`;

  return (
    <div>
      <PageHeader title="Stock" description="Check what is on the shelf, what is running low and what is about to expire." />

      <PageToolbar
        actions={
          <>
            <Button
              variant="secondary"
              icon={<Download className={ICON} aria-hidden />}
              loading={exportCsv.isPending}
              disabled={!facilityId}
              onClick={() => exportCsv.mutate()}
            >
              Export CSV
            </Button>
            <LinkButton to={`/app/pharmacy/counts${facilityQuery}`} icon={<ClipboardCheck className={ICON} aria-hidden />}>
              Count stock
            </LinkButton>
            <LinkButton to={`/app/pharmacy/reorder${facilityQuery}`} icon={<ShoppingCart className={ICON} aria-hidden />}>
              Reorder
            </LinkButton>
            <LinkButton to={`/app/pharmacy/products/new${facilityQuery}`} icon={<Plus className={ICON} aria-hidden />}>
              Add product
            </LinkButton>
            <LinkButton variant="primary" to={`/app/pharmacy/receive${facilityQuery}`} icon={<PackagePlus className={ICON} aria-hidden />}>
              Receive stock
            </LinkButton>
          </>
        }
      >
        <Select
          label="Facility"
          options={facilities.map((facility) => ({ value: facility.id, label: facility.name }))}
          value={facilityId}
          onChange={(event) => changeFacility(event.target.value)}
          className="sm:w-64"
        />
      </PageToolbar>

      <StockFilterBar
        searchResetKey={filters.searchResetKey}
        filter={filters.filter}
        dashboard={dashboard.data}
        onSearch={filters.setSearch}
        onFilterChange={filters.setFilter}
      />

      <ResponsiveTable
        label="Stock"
        columns={columns}
        rows={data?.items ?? []}
        getRowKey={(row) => row.productId}
        loading={facilitiesLoading || stock.isLoading}
        refreshing={stock.isPlaceholderData}
        errorMessage={stock.isError ? describeError(stock.error, "Stock couldn't be loaded. Please try again.") : null}
        onRetry={() => void stock.refetch()}
        empty={
          filters.isFiltered ? (
            <EmptyState
              icon={SearchX}
              title="No matching products"
              description="Try a different name or code, or another stock filter."
              action={<Button variant="secondary" onClick={filters.clear}>Clear search and filters</Button>}
            />
          ) : (
            <EmptyState
              icon={Package}
              title="No products yet"
              description="Add a product, then receive its first stock."
              action={<LinkButton variant="primary" to={`/app/pharmacy/products/new${facilityQuery}`}>Add product</LinkButton>}
            />
          )
        }
        renderExpanded={(row) =>
          row.productId === expandedProductId ? (
            <ProductDetailsPanel
              row={row}
              facilityId={facilityId}
              onEdit={() => setEditing(row)}
              onRemoveFromLot={(lot) => setAdjusting({ row, mode: "REMOVE", batchId: lot.batchId })}
            />
          ) : null
        }
        pagination={
          data && {
            page: data.page,
            size: STOCK_PAGE_SIZE,
            totalItems: data.totalItems,
            hasMore: data.hasMore,
            onPageChange: filters.setPage,
          }
        }
      />

      {adjusting && (
        <AdjustStockDialog
          product={adjusting.row}
          facilityId={facilityId}
          initialMode={adjusting.mode}
          initialBatchId={adjusting.batchId}
          onClose={() => setAdjusting(null)}
        />
      )}
      {editing && <EditProductDialog row={editing} facilityId={facilityId} onClose={() => setEditing(null)} />}
    </div>
  );
}
