import { useState } from "react";
import type { StockStatusFilter } from "@/shared/api/pharmacyStock";

export type StockFilter = "ALL" | StockStatusFilter;

// Search, chip and page move together: any change to what is being looked at
// returns to the first page, otherwise "page 3 of the old list" can land on
// an empty page of the new one.
export function useStockFilters() {
  const [query, setQuery] = useState("");
  const [filter, setFilterState] = useState<StockFilter>("ALL");
  const [page, setPage] = useState(0);
  // SearchInput owns its text; changing this key remounts it empty when "clear all" is used.
  const [searchResetKey, setSearchResetKey] = useState(0);

  function setSearch(next: string) {
    setQuery(next);
    setPage(0);
  }

  // FilterChips reports null when the active chip is pressed again; that means "no filter".
  function setFilter(next: StockFilter | null) {
    setFilterState(next ?? "ALL");
    setPage(0);
  }

  function clear() {
    setQuery("");
    setFilterState("ALL");
    setPage(0);
    setSearchResetKey((key) => key + 1);
  }

  return {
    query,
    filter,
    page,
    searchResetKey,
    isFiltered: query !== "" || filter !== "ALL",
    status: filter === "ALL" ? null : filter,
    setSearch,
    setFilter,
    setPage,
    resetPage: () => setPage(0),
    clear,
  };
}
