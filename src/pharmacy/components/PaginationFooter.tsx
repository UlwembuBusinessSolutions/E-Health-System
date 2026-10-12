import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/shared/components/Button";

export interface PaginationState {
  /** Zero-based, as the API reports it. */
  page: number;
  size: number;
  totalItems: number;
  hasMore: boolean;
  onPageChange: (page: number) => void;
}

export function PaginationFooter({ page, size, totalItems, hasMore, onPageChange }: PaginationState) {
  if (totalItems === 0) return null;

  const first = page * size + 1;
  const last = Math.min((page + 1) * size, totalItems);

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between gap-3 border-t border-border-subtle px-5 py-3"
    >
      <p className="text-[13px] text-text-secondary" aria-live="polite">
        {first}–{last} of {totalItems.toLocaleString("en-ZA")}
      </p>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          aria-label="Previous page"
          icon={<ChevronLeft className="size-4" aria-hidden />}
          disabled={page === 0}
          onClick={() => onPageChange(page - 1)}
        />
        <Button
          variant="secondary"
          aria-label="Next page"
          icon={<ChevronRight className="size-4" aria-hidden />}
          disabled={!hasMore}
          onClick={() => onPageChange(page + 1)}
        />
      </div>
    </nav>
  );
}
