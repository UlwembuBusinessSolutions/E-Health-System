import { useMemo, useState } from "react";
import { FilterChips, type FilterChipOption } from "@/pharmacy/components/FilterChips";
import { EmptyState } from "@/pharmacy/components/EmptyState";
import { ResponsiveTable } from "@/pharmacy/components/ResponsiveTable";
import { describeError } from "@/pharmacy/lib/problem";
import type { LedgerMovement } from "@/shared/api/pharmacyLedger";
import { LEDGER_PAGE_SIZE, useLedgerMovements } from "./hooks/useLedgerMovements";
import { boundsFor, type DateRangeKey } from "./lib/dateRange";
import {
  countsByKind,
  EVENT_KINDS,
  EVENT_LABELS,
  typesForKind,
  type MovementEventKind,
} from "./lib/movementEvents";
import { LedgerToolbar } from "./LedgerToolbar";
import { movementColumns } from "./movementColumns";
import { ReverseMovementDialog } from "./ReverseMovementDialog";
import { ReversalNotice } from "./ReversalNotice";

export function MovementsTab({ facilityId }: { facilityId: string }) {
  const [query, setQuery] = useState("");
  const [range, setRange] = useState<DateRangeKey>("ALL");
  const [kind, setKind] = useState<MovementEventKind | null>(null);
  const [page, setPage] = useState(0);
  const [reversing, setReversing] = useState<LedgerMovement | null>(null);
  const [justReversed, setJustReversed] = useState<LedgerMovement | null>(null);

  const filters = useMemo(
    () => ({ facilityId, q: query || undefined, types: kind ? typesForKind(kind) : undefined, ...boundsFor(range) }),
    [facilityId, query, kind, range],
  );
  const movements = useLedgerMovements(filters, page);
  const result = movements.data;

  // A new filter always starts from the first page.
  function changeFilter<T>(set: (value: T) => void) {
    return (value: T) => {
      set(value);
      setPage(0);
    };
  }

  const kindCounts = countsByKind(result?.typeCounts);
  const kindOptions: FilterChipOption<MovementEventKind>[] = EVENT_KINDS.map((value) => ({
    value,
    label: EVENT_LABELS[value],
    count: kindCounts?.[value],
  }));

  return (
    <div className="flex flex-col gap-4">
      {justReversed && <ReversalNotice movement={justReversed} onDismiss={() => setJustReversed(null)} />}
      <LedgerToolbar
        searchLabel="Search movements"
        searchPlaceholder="Search product, lot, supplier, patient or reference"
        onSearch={changeFilter(setQuery)}
        range={range}
        onRangeChange={changeFilter(setRange)}
      />
      <FilterChips label="Movement type" options={kindOptions} value={kind} onChange={changeFilter(setKind)} />
      <ResponsiveTable
        label="Stock movements"
        columns={movementColumns(setReversing)}
        rows={result?.items ?? []}
        getRowKey={(row) => row.id}
        loading={movements.isLoading}
        refreshing={movements.isFetching && !movements.isLoading}
        errorMessage={movements.isError ? describeError(movements.error) : null}
        onRetry={() => void movements.refetch()}
        empty={<EmptyState title="No movements found" description="Try a wider date range or a different search." />}
        pagination={
          result && {
            page,
            size: LEDGER_PAGE_SIZE,
            totalItems: result.totalItems,
            hasMore: result.hasMore,
            onPageChange: setPage,
          }
        }
      />
      {reversing && (
        <ReverseMovementDialog
          facilityId={facilityId}
          movement={reversing}
          onClose={() => setReversing(null)}
          onReversed={(movement) => {
            setReversing(null);
            setJustReversed(movement);
          }}
        />
      )}
    </div>
  );
}
