import { keepPreviousData, useQuery, type QueryKey } from "@tanstack/react-query";
import type { PagedResult } from "@/shared/api/types";

interface UsePagedQueryOptions<T> {
  /** Everything that changes the result except paging (facility, filters, search text). */
  queryKey: QueryKey;
  fetchPage: (page: number, size: number) => Promise<PagedResult<T>>;
  page: number;
  size?: number;
  enabled?: boolean;
}

// keepPreviousData holds the old rows on screen while the next page or filter
// loads, so tables don't flash to a skeleton on every page change.
export function usePagedQuery<T>({ queryKey, fetchPage, page, size = 50, enabled = true }: UsePagedQueryOptions<T>) {
  return useQuery({
    queryKey: [...queryKey, { page, size }],
    queryFn: () => fetchPage(page, size),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    enabled,
  });
}
