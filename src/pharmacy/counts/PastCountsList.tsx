import { useQuery } from "@tanstack/react-query";
import { listCounts, type CountSummary } from "@/shared/api/pharmacyCounts";
import { ResponsiveTable, type TableColumn } from "../components/ResponsiveTable";
import { formatDate, pluralise } from "../lib/format";
import { describeError } from "../lib/problem";
import { pharmacyKeys } from "../lib/queryKeys";

function resultOf(count: CountSummary): string {
  return (count.differences ?? 0) === 0
    ? "No differences"
    : `${pluralise(count.differences ?? 0, "adjustment")} posted`;
}

const COLUMNS: TableColumn<CountSummary>[] = [
  { key: "ref", header: "Reference", role: "primary", cell: (count) => <span className="font-medium">{count.reference}</span> },
  { key: "date", header: "Date", cell: (count) => (count.postedAt ? formatDate(count.postedAt) : "—") },
  { key: "what", header: "What was counted", cell: (count) => count.scopeLabel },
  { key: "by", header: "Counted by", cell: (count) => count.startedByName },
  { key: "result", header: "Result", role: "secondary", cell: resultOf },
];

export function PastCountsList({ facilityId }: { facilityId: string }) {
  const past = useQuery({
    queryKey: pharmacyKeys.counts.list(facilityId, "POSTED"),
    queryFn: () => listCounts(facilityId, "POSTED"),
    enabled: facilityId !== "",
    staleTime: 30_000,
  });

  return (
    <section aria-labelledby="past-heading" className="flex flex-col gap-3">
      <h2 id="past-heading" className="text-[15px] font-semibold text-text-primary">
        Past counts
      </h2>
      <ResponsiveTable
        label="Past counts"
        columns={COLUMNS}
        rows={past.data ?? []}
        getRowKey={(count) => count.id}
        loading={past.isLoading}
        errorMessage={past.error ? describeError(past.error) : null}
        onRetry={() => void past.refetch()}
      />
    </section>
  );
}
