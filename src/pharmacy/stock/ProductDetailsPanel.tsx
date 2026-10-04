import { useState } from "react";
import clsx from "clsx";
import { Archive, ArchiveRestore, Copy, Pencil } from "lucide-react";
import type { BatchRow, StockRow } from "@/shared/api/pharmacyStock";
import { Button } from "@/shared/components/Button";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { formatQuantity } from "../lib/units";
import { HistoryTab } from "./HistoryTab";
import { LinkButton } from "./LinkButton";
import { LotsTab } from "./LotsTab";
import { useProductArchive } from "./useProductArchive";

type PanelTab = "LOTS" | "HISTORY";

interface ProductDetailsPanelProps {
  row: StockRow;
  facilityId: string;
  onRemoveFromLot: (lot: BatchRow) => void;
  onEdit: () => void;
}

// What opens under a stock row: its lots or its movement history, plus the
// less frequent product actions (edit, copy, archive).
export function ProductDetailsPanel({ row, facilityId, onRemoveFromLot, onEdit }: ProductDetailsPanelProps) {
  const [tab, setTab] = useState<PanelTab>("LOTS");
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [archiveBlockedMessage, setArchiveBlockedMessage] = useState<string | null>(null);
  const archiveMutation = useProductArchive(facilityId, row, !row.archived, () => setConfirmingArchive(false));

  function handleArchiveClick() {
    // Archiving hides a product from receiving and dispensing, so it must not
    // strand units on the shelf that nobody can then see or dispense.
    if (!row.archived && row.available > 0) {
      setArchiveBlockedMessage(
        `${row.displayName} still has ${formatQuantity(row.available, row.baseUnit)} on the shelf. Remove or dispense all of it before archiving.`,
      );
      return;
    }
    setArchiveBlockedMessage(null);
    if (row.archived) archiveMutation.mutate();
    else setConfirmingArchive(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Product details" className="flex gap-2">
          <TabButton selected={tab === "LOTS"} onClick={() => setTab("LOTS")}>
            {row.serialTracked ? "Serial numbers" : "Lots"}
          </TabButton>
          <TabButton selected={tab === "HISTORY"} onClick={() => setTab("HISTORY")}>
            History
          </TabButton>
        </div>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <Button variant="secondary" icon={<Pencil className="size-4" aria-hidden />} onClick={onEdit}>
            Edit product
          </Button>
          <LinkButton
            to={`/app/pharmacy/products/new?copyFrom=${row.productId}&facilityId=${facilityId}`}
            icon={<Copy className="size-4" aria-hidden />}
          >
            Copy product
          </LinkButton>
          <Button
            variant="secondary"
            icon={row.archived ? <ArchiveRestore className="size-4" aria-hidden /> : <Archive className="size-4" aria-hidden />}
            loading={archiveMutation.isPending && row.archived}
            onClick={handleArchiveClick}
          >
            {row.archived ? "Reactivate" : "Archive"}
          </Button>
        </div>
      </div>

      {archiveBlockedMessage && (
        <p role="alert" className="rounded-lg bg-amber-50 px-3.5 py-2.5 text-[13.5px] text-amber-600">
          {archiveBlockedMessage}
        </p>
      )}

      {tab === "LOTS" ? (
        <LotsTab product={row} onRemoveFromLot={onRemoveFromLot} />
      ) : (
        <HistoryTab productId={row.productId} facilityId={facilityId} />
      )}

      <ConfirmDialog
        open={confirmingArchive}
        title={`Archive ${row.displayName}?`}
        body="It will no longer appear when receiving or dispensing. You can reactivate it later, and its history stays."
        confirmLabel="Archive"
        loading={archiveMutation.isPending}
        onConfirm={() => archiveMutation.mutate()}
        onCancel={() => setConfirmingArchive(false)}
      />
    </div>
  );
}

function TabButton({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={clsx(
        "min-h-11 rounded-lg px-4 text-[14px] font-semibold",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
        selected ? "bg-brand-700 text-white" : "border border-border-strong bg-surface-raised text-text-primary hover:bg-surface-sunken",
      )}
    >
      {children}
    </button>
  );
}
