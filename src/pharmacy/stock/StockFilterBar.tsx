import type { StockDashboard } from "@/shared/api/pharmacyStock";
import { FilterChips, type FilterChipOption } from "../components/FilterChips";
import { SearchInput } from "../components/SearchInput";
import type { StockFilter } from "./useStockFilters";

interface StockFilterBarProps {
  /** Changing this remounts the search box empty (used by "clear all"). */
  searchResetKey: number;
  filter: StockFilter;
  /** Chip counts; undefined while loading, so chips show no number rather than a wrong one. */
  dashboard: StockDashboard | undefined;
  onSearch: (query: string) => void;
  onFilterChange: (filter: StockFilter | null) => void;
}

function chipOptions(dashboard: StockDashboard | undefined): FilterChipOption<StockFilter>[] {
  return [
    { value: "ALL", label: "All" },
    { value: "LOW", label: "Low", count: dashboard?.lowCount },
    { value: "OUT", label: "Out of stock", count: dashboard?.outCount },
    { value: "EXPIRING", label: "Expiring in 90 days", count: dashboard?.expiringCount },
    { value: "ARCHIVED", label: "Archived" },
  ];
}

export function StockFilterBar({ searchResetKey, filter, dashboard, onSearch, onFilterChange }: StockFilterBarProps) {
  return (
    <div className="mb-4 flex flex-col gap-3">
      <SearchInput
        key={searchResetKey}
        label="Search products by name or code"
        placeholder="Search products, SKU or lot"
        onSearch={onSearch}
        className="w-full lg:max-w-md"
      />
      <FilterChips label="Stock status" options={chipOptions(dashboard)} value={filter} onChange={onFilterChange} />
    </div>
  );
}
