import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { getCount, type CountLine, type CountSummary } from "@/shared/api/pharmacyCounts";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { StatusPill } from "@/shared/components/StatusPill";
import { ResponsiveTable, type TableColumn } from "../components/ResponsiveTable";
import { pluralise } from "../lib/format";
import { describeError } from "../lib/problem";
import { pharmacyKeys } from "../lib/queryKeys";
import { differenceOf, formatSigned, reasonLabel } from "./countMath";

const COLUMNS: TableColumn<CountLine>[] = [
  { key: "product", header: "Product", role: "primary", cell: (line) => <span className="font-medium">{line.productName}</span> },
  { key: "lot", header: "Lot", cell: (line) => line.lotNumber },
  {
    key: "change",
    header: "Change",
    align: "right",
    cell: (line) => <span className="font-semibold tabular-nums">{formatSigned(differenceOf(line) ?? 0)}</span>,
  },
  { key: "reason", header: "Reason", cell: (line) => (line.reason ? reasonLabel(line.reason) : "—") },
  { key: "entry", header: "Ledger entry", role: "secondary", cell: () => <StatusPill tone="success">Adjusted</StatusPill> },
];

interface DoneViewProps {
  /** The count as returned by posting it. */
  posted: CountSummary;
  onStartNew: () => void;
}

// The adjusted lots are read back from the posted count rather than trusted
// from the post response, so what is listed is what the server stored.
export function DoneView({ posted, onStartNew }: DoneViewProps) {
  const detail = useQuery({
    queryKey: pharmacyKeys.counts.detail(posted.id, false),
    queryFn: () => getCount(posted.id),
  });
  const adjusted = (detail.data?.lines ?? []).filter((line) => (differenceOf(line) ?? 0) !== 0);
  const uncounted = posted.totalLots - posted.lotsCounted;

  return (
    <div className="flex flex-col gap-5">
      <Card className="flex items-start gap-3 p-5">
        <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-success-500" aria-hidden />
        <div>
          <h2 className="text-[17px] font-semibold text-text-primary">Count {posted.reference} posted</h2>
          <p className="text-[13.5px] text-text-secondary">
            {(posted.differences ?? adjusted.length) === 0
              ? "Every counted lot matched the ledger, so no adjustments were needed. "
              : `${pluralise(posted.differences ?? adjusted.length, "lot")} adjusted. `}
            {pluralise(posted.matches ?? 0, "lot")} matched
            {uncounted > 0 && ` · ${uncounted} not counted and left unchanged`}.
          </p>
        </div>
      </Card>

      {adjusted.length > 0 && (
        <ResponsiveTable
          label="Adjustments posted"
          columns={COLUMNS}
          rows={adjusted}
          getRowKey={(line) => line.id}
          errorMessage={detail.error ? describeError(detail.error) : null}
        />
      )}

      <div className="flex flex-wrap gap-3">
        <Link
          to="/app/pharmacy/ledger"
          className="inline-flex h-11 items-center rounded-lg border border-border-strong bg-surface-raised px-4 text-[14px] font-semibold text-text-primary hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          View in Ledger
        </Link>
        <Button onClick={onStartNew}>Start a new count</Button>
      </div>
    </div>
  );
}
