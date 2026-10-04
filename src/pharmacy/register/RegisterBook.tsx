import { Lock } from "lucide-react";
import type { RegisterEntry, RegisterEntryKind } from "@/shared/api/pharmacyCounts";
import type { PaginationState } from "../components/PaginationFooter";
import { ResponsiveTable, type TableColumn } from "../components/ResponsiveTable";
import { formatDateTime } from "../lib/format";

const KIND_LABELS: Record<RegisterEntryKind, string> = {
  DISPENSED: "Dispensed",
  RECEIVED: "Received",
  DESTROYED: "Destroyed",
  LOST: "Lost",
  RETURNED: "Returned to supplier",
  OPENING: "Opening balance",
};

const DASH = "—";

function twoLines(top: string | null, bottom: string | null) {
  if (!top && !bottom) return DASH;
  return (
    <div>
      <p>{top ?? DASH}</p>
      {bottom && <p className="text-[12.5px] text-text-secondary">{bottom}</p>}
    </div>
  );
}

const COLUMNS: TableColumn<RegisterEntry>[] = [
  { key: "date", header: "Date / time", role: "primary", cell: (entry) => <span className="font-medium">{formatDateTime(entry.entryAt)}</span> },
  { key: "rx", header: "RX number", cell: (entry) => entry.rxSerial ?? KIND_LABELS[entry.kind] },
  { key: "patient", header: "Patient · ID", cell: (entry) => twoLines(entry.patientName, entry.patientIdRef) },
  { key: "prescriber", header: "Prescriber · Reg. no.", cell: (entry) => twoLines(entry.prescriberName, entry.prescriberRegNo) },
  { key: "in", header: "In", align: "right", cell: (entry) => (entry.quantityIn ? <span className="tabular-nums">{entry.quantityIn}</span> : DASH) },
  { key: "out", header: "Out", align: "right", cell: (entry) => (entry.quantityOut ? <span className="tabular-nums">{entry.quantityOut}</span> : DASH) },
  { key: "balance", header: "Balance", align: "right", role: "secondary", cell: (entry) => <span className="font-semibold tabular-nums">{entry.balanceAfter}</span> },
  { key: "by", header: "Dispensed by", cell: (entry) => entry.dispensedByName },
  { key: "witness", header: "Witnessed by", cell: (entry) => entry.witnessedByName ?? DASH },
  { key: "lot", header: "Lot", cell: (entry) => entry.lotNumber },
];

interface RegisterBookProps {
  entries: RegisterEntry[];
  loading: boolean;
  errorMessage: string | null;
  onRetry: () => void;
  pagination: PaginationState;
}

// Read-only on purpose: the register is a legal record, so there is no edit or
// delete control anywhere. A mistake is corrected by a new entry.
export function RegisterBook({ entries, loading, errorMessage, onRetry, pagination }: RegisterBookProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-center gap-2 text-[13px] text-text-secondary">
        <Lock className="size-4 shrink-0" aria-hidden />
        A mistake is fixed by a new entry that refers back to the old one. There is no edit or delete on this book.
      </p>
      <ResponsiveTable
        label="Scheduled medicine register"
        columns={COLUMNS}
        rows={entries}
        getRowKey={(entry) => entry.id}
        loading={loading}
        errorMessage={errorMessage}
        onRetry={onRetry}
        pagination={pagination}
      />
    </div>
  );
}
