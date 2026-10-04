import { TriangleAlert } from "lucide-react";
import type { CountLine, CountReason } from "@/shared/api/pharmacyCounts";
import { StatusPill } from "@/shared/components/StatusPill";
import { ResponsiveTable, type TableColumn } from "../components/ResponsiveTable";
import { formatDate } from "../lib/format";
import { differenceOf, formatSigned, isLargeDifference, outcomeOf, reasonsFor } from "./countMath";
import { CountedInput } from "./CountedInput";
import { ReasonChips } from "./ReasonChips";

interface ReviewTableProps {
  lines: CountLine[];
  onRecount: (line: CountLine, quantity: number) => void;
  onReason: (line: CountLine, reason: CountReason) => void;
}

function lineName(line: CountLine): string {
  return `${line.productName} lot ${line.lotNumber}`;
}

function DifferenceCell({ line }: { line: CountLine }) {
  const difference = differenceOf(line);
  if (difference === null) return <span className="text-text-secondary">{"—"}</span>;
  return (
    <div className="flex flex-col items-end gap-1">
      <span className="font-semibold tabular-nums">{formatSigned(difference)}</span>
      {isLargeDifference(line) && (
        <StatusPill tone="warning" icon={<TriangleAlert className="size-3.5" aria-hidden />}>
          Large, recount?
        </StatusPill>
      )}
    </div>
  );
}

function ReasonCell({ line, onReason }: { line: CountLine; onReason: ReviewTableProps["onReason"] }) {
  const outcome = outcomeOf(line);
  if (outcome === "NOT_COUNTED") return <span className="text-[13px] text-text-secondary">Not counted, left unchanged</span>;
  if (outcome === "MATCH") return <span className="text-[13px] text-text-secondary">Matches the ledger</span>;
  return (
    <ReasonChips
      label={`Reason for ${lineName(line)}`}
      options={reasonsFor(outcome)}
      value={line.reason}
      onChange={(reason) => onReason(line, reason)}
    />
  );
}

export function ReviewTable({ lines, onRecount, onReason }: ReviewTableProps) {
  const columns: TableColumn<CountLine>[] = [
    {
      key: "product",
      header: "Product and lot",
      role: "primary",
      cell: (line) => (
        <div>
          <p className="font-medium text-text-primary">{line.productName}</p>
          <p className="text-[12.5px] text-text-secondary">
            Lot {line.lotNumber}
            {line.expiryDate && ` · expires ${formatDate(line.expiryDate)}`}
            {line.foundInCount && " · New lot, not in the ledger"}
          </p>
        </div>
      ),
    },
    { key: "system", header: "System", align: "right", cell: (line) => <span className="tabular-nums">{line.baselineQuantity ?? "—"}</span> },
    {
      key: "counted",
      header: "You counted",
      align: "right",
      cell: (line) => (
        <CountedInput
          value={line.countedQuantity}
          label={`Recount for ${lineName(line)}`}
          onCommit={(quantity) => onRecount(line, quantity)}
        />
      ),
    },
    { key: "difference", header: "Difference", align: "right", role: "secondary", cell: (line) => <DifferenceCell line={line} /> },
    { key: "reason", header: "Why is it different?", cell: (line) => <ReasonCell line={line} onReason={onReason} /> },
  ];

  return (
    <ResponsiveTable
      label="Count review"
      columns={columns}
      rows={lines}
      getRowKey={(line) => line.id}
      empty={<p className="px-5 py-10 text-center text-[13.5px] text-text-secondary">Nothing in this view.</p>}
    />
  );
}
