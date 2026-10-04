import { useState } from "react";
import clsx from "clsx";
import { ScrollText } from "lucide-react";
import type { LedgerEntry } from "@/shared/api/pharmacyStock";
import { EmptyState } from "../components/EmptyState";
import { ResponsiveTable, type TableColumn } from "../components/ResponsiveTable";
import { formatDateTime } from "../lib/format";
import { describeError } from "../lib/problem";
import { describeEntrySource, formatDelta, ledgerTypeLabel } from "./ledgerLabels";
import { useProductHistory } from "./stockQueries";

const COLUMNS: TableColumn<LedgerEntry>[] = [
  {
    key: "event",
    header: "Event",
    role: "primary",
    cell: (entry) => (
      <span className="font-medium text-text-primary">
        {ledgerTypeLabel(entry.type)}
        {entry.reversedByTransactionId && <span className="ml-1.5 text-[12px] text-text-secondary">(reversed)</span>}
      </span>
    ),
  },
  { key: "date", header: "Date", cell: (entry) => <span className="tabular-nums">{formatDateTime(entry.createdAt)}</span> },
  {
    key: "source",
    header: "Supplier, patient or reason",
    cell: (entry) => {
      const { who, reference } = describeEntrySource(entry);
      return (
        <>
          <span className="block">{who}</span>
          {reference && <span className="block font-mono text-[12px] text-text-secondary">{reference}</span>}
        </>
      );
    },
  },
  { key: "lot", header: "Lot", cell: (entry) => <span className="font-mono">{entry.lotNumber ?? "—"}</span> },
  {
    key: "change",
    header: "Change",
    role: "secondary",
    align: "right",
    cell: (entry) => (
      <span className={clsx("font-semibold tabular-nums", entry.quantityDelta < 0 ? "text-danger-600" : "text-success-600")}>
        {formatDelta(entry.quantityDelta)}
      </span>
    ),
  },
  {
    key: "balance",
    header: "Balance",
    align: "right",
    cell: (entry) => <span className="tabular-nums">{entry.balanceAfter.toLocaleString("en-ZA")}</span>,
  },
  { key: "by", header: "By", cell: (entry) => entry.actorName },
];

interface HistoryTabProps {
  productId: string;
  facilityId: string;
}

// Fetched only when this tab is opened: most expanded rows never need it.
export function HistoryTab({ productId, facilityId }: HistoryTabProps) {
  const [page, setPage] = useState(0);
  const history = useProductHistory(productId, facilityId, page);
  const data = history.data;

  return (
    <div>
      <ResponsiveTable
        label="Product movement history"
        columns={COLUMNS}
        rows={data?.items ?? []}
        getRowKey={(entry) => entry.id}
        loading={history.isLoading}
        refreshing={history.isPlaceholderData}
        errorMessage={history.isError ? describeError(history.error) : null}
        onRetry={() => void history.refetch()}
        empty={<EmptyState icon={ScrollText} title="No movements yet" description="Receiving or adjusting stock adds the first entry." />}
        pagination={
          data && { page: data.page, size: data.size, totalItems: data.totalItems, hasMore: data.hasMore, onPageChange: setPage }
        }
      />
      <p className="mt-2 text-[12.5px] text-text-secondary">
        Entries are permanent. A correction adds a new entry that points back to the one it fixes.
      </p>
    </div>
  );
}
