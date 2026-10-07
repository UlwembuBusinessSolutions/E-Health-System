import { Check, Minus } from "lucide-react";
import type { CountLine } from "@/shared/api/pharmacyCounts";
import { Button } from "@/shared/components/Button";
import { StatusPill } from "@/shared/components/StatusPill";
import { ExpiryText } from "../components/ExpiryText";
import { ResponsiveTable, type TableColumn } from "../components/ResponsiveTable";
import { daysUntil } from "../lib/format";
import { isCounted } from "./countMath";
import { CountedInput } from "./CountedInput";

interface CountSheetProps {
  lines: CountLine[];
  /** The line whose save is in flight; its input is briefly locked. */
  savingLineId: string | null;
  onCount: (line: CountLine, quantity: number) => void;
  onRemoveExpired: (line: CountLine) => void;
}

function isExpired(line: CountLine): boolean {
  return line.expiryDate !== null && daysUntil(line.expiryDate) < 0;
}

function lineName(line: CountLine): string {
  return `${line.productName} lot ${line.lotNumber}`;
}

export function CountSheet({ lines, savingLineId, onCount, onRemoveExpired }: CountSheetProps) {
  const columns: TableColumn<CountLine>[] = [
    {
      key: "product",
      header: "Product",
      role: "primary",
      cell: (line) => (
        <div>
          <p className="font-medium text-text-primary">{line.productName}</p>
          <p className="text-[12.5px] text-text-secondary">
            {[line.productCode, line.foundInCount ? "Found on the shelf" : null].filter(Boolean).join(" · ")}
          </p>
        </div>
      ),
    },
    { key: "lot", header: "Lot", cell: (line) => <span className="tabular-nums">{line.lotNumber}</span> },
    { key: "expiry", header: "Expiry", cell: (line) => <ExpiryText date={line.expiryDate} /> },
    {
      key: "counted",
      header: "How many on the shelf?",
      cell: (line) => (
        <CountedInput
          value={line.countedQuantity}
          label={`Counted quantity for ${lineName(line)}`}
          disabled={savingLineId === line.id}
          onCommit={(quantity) => onCount(line, quantity)}
        />
      ),
    },
    {
      key: "status",
      header: "Status",
      role: "secondary",
      cell: (line) =>
        isCounted(line) ? (
          <StatusPill tone="success" icon={<Check className="size-3.5" aria-hidden />}>Counted</StatusPill>
        ) : (
          <StatusPill tone="neutral" icon={<Minus className="size-3.5" aria-hidden />}>Not counted</StatusPill>
        ),
    },
    {
      key: "actions",
      header: "",
      cell: (line) =>
        isExpired(line) && line.countedQuantity !== 0 ? (
          <Button variant="secondary" onClick={() => onRemoveExpired(line)}>
            Remove as expired
          </Button>
        ) : null,
    },
  ];

  return (
    <ResponsiveTable
      label="Lots to count"
      columns={columns}
      rows={lines}
      getRowKey={(line) => line.id}
      empty={<p className="px-5 py-10 text-center text-[13.5px] text-text-secondary">No lots match. Go back and choose another scope.</p>}
    />
  );
}
