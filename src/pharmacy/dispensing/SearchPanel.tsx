import { useState } from "react";
import { Search } from "lucide-react";
import type { PrescriptionSearchResult } from "@/shared/api/pharmacy";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { StatusPill, type PillTone } from "@/shared/components/StatusPill";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { FilterChips, type FilterChipOption } from "../components/FilterChips";
import { SearchInput } from "../components/SearchInput";
import { SkeletonRows } from "../components/SkeletonRows";
import { formatDateTime, pluralise } from "../lib/format";
import { describeError } from "../lib/problem";
import { usePrescriptionSearch } from "./hooks/usePrescriptionSearch";

interface SearchPanelProps {
  facilityId: string;
  /** The prescription currently pinned below, so its row can say "Shown below". */
  openedId: string | null;
  onOpen: (prescriptionId: string) => void;
}

type ResultFilter = "ALL" | "QUEUE" | "OUT_OF_STOCK" | "DISPENSED";

const FILTERS: Record<ResultFilter, (result: PrescriptionSearchResult) => boolean> = {
  ALL: () => true,
  QUEUE: (result) => result.queueState === "QUEUE",
  OUT_OF_STOCK: (result) => result.queueState === "OUT_OF_STOCK",
  DISPENSED: (result) => result.queueState === "DISPENSED",
};

const FILTER_LABELS: Record<ResultFilter, string> = {
  ALL: "All",
  QUEUE: "In queue",
  OUT_OF_STOCK: "Waiting for stock",
  DISPENSED: "Dispensed",
};

function statePill(result: PrescriptionSearchResult): { tone: PillTone; label: string } {
  if (result.queueState === "DISPENSED") return { tone: "neutral", label: "Dispensed" };
  if (result.queueState === "OUT_OF_STOCK") return { tone: "danger", label: "Out of stock" };
  return { tone: "success", label: "In queue" };
}

// One input finds a prescription by RX number, patient name or patient ID,
// including scripts that have already left the queue. Results appear as you
// type; opening one pins its full card above the queue.
export function SearchPanel({ facilityId, openedId, onOpen }: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ResultFilter>("ALL");
  const search = usePrescriptionSearch(facilityId, query);

  const results = search.data ?? [];
  const chips: FilterChipOption<ResultFilter>[] = (Object.keys(FILTERS) as ResultFilter[]).map((value) => ({
    value,
    label: FILTER_LABELS[value],
    count: results.filter(FILTERS[value]).length,
  }));
  const visible = results.filter(FILTERS[filter]);
  const searching = query.trim().length >= 2;

  return (
    <Card className="p-4 sm:p-5">
      <h2 className="mb-1 text-[15px] font-semibold text-text-primary">Find a prescription</h2>
      <p className="mb-3 text-[13px] text-text-secondary">
        By RX number, patient name or ID. Includes prescriptions that have left the queue.
      </p>
      <SearchInput label="Search prescriptions" placeholder="RX number, patient name or ID" onSearch={setQuery} />

      {searching && (
        <div className="mt-3 flex flex-col gap-3">
          <FilterChips label="Filter results" options={chips} value={filter} onChange={(value) => setFilter(value ?? "ALL")} />
          {search.isLoading && <SkeletonRows rows={3} />}
          {search.isError && (
            <ErrorState message={describeError(search.error)} onRetry={() => void search.refetch()} retrying={search.isFetching} />
          )}
          {search.data && visible.length === 0 && (
            <EmptyState
              icon={Search}
              title="No prescription matches"
              description="Check the spelling, or search by the RX number printed on the script."
            />
          )}
          <ul className="flex flex-col gap-2" aria-live="polite">
            {visible.map((result) => {
              const pill = statePill(result);
              const shown = result.id === openedId;
              return (
                <li
                  key={result.id}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border border-border-subtle px-3.5 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium text-text-primary">
                      {result.patientName} <span className="font-mono text-[12.5px] text-text-secondary">{result.patientMpi}</span>
                    </p>
                    <p className="font-mono text-[12.5px] text-text-secondary">
                      {result.serialNumber} · {formatDateTime(result.createdAt)}
                    </p>
                    <p className="text-[13px] text-text-secondary">{result.dispensedItemCount} of {pluralise(result.itemCount, "item")} dispensed</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusPill tone={pill.tone}>{pill.label}</StatusPill>
                    <Button
                      variant="secondary"
                      disabled={shown}
                      aria-label={`${shown ? "Shown below" : "Open"} ${result.serialNumber} for ${result.patientName}`}
                      onClick={() => onOpen(result.id)}
                    >
                      {shown ? "Shown below" : "Open"}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Card>
  );
}
