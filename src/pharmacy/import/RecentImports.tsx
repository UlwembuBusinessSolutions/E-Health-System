import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listRecentImports, undoImport, type ImportBatch } from "@/shared/api/pharmacyImport";
import { Button } from "@/shared/components/Button";
import { StatusPill } from "@/shared/components/StatusPill";
import { useToast } from "@/shared/components/toast/ToastProvider";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ErrorState } from "../components/ErrorState";
import { ResponsiveTable, type TableColumn } from "../components/ResponsiveTable";
import { formatDateTime, pluralise } from "../lib/format";
import { describeError } from "../lib/problem";
import { invalidateAfterStockMovement, pharmacyKeys } from "../lib/queryKeys";

interface RecentImportsProps {
  facilityId: string;
}

function resultText(batch: ImportBatch): string {
  const parts: string[] = [];
  if (batch.productsCreated > 0) parts.push(pluralise(batch.productsCreated, "new product"));
  if (batch.receiptsCreated > 0) parts.push(`${pluralise(batch.unitsReceived, "unit")} received`);
  return parts.join(", ") || pluralise(batch.rowsImported, "row");
}

export function RecentImports({ facilityId }: RecentImportsProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [undoing, setUndoing] = useState<ImportBatch | null>(null);

  const recent = useQuery({
    queryKey: pharmacyKeys.imports.recent(facilityId),
    queryFn: () => listRecentImports(facilityId),
    enabled: facilityId !== "",
  });

  const undo = useMutation({
    mutationFn: (batch: ImportBatch) => undoImport(batch.id),
    onSuccess: () => {
      showToast("Import undone.", "success");
      void invalidateAfterStockMovement(queryClient);
      void queryClient.invalidateQueries({ queryKey: pharmacyKeys.imports.all });
    },
    onError: (error) => showToast(describeError(error), "error"),
    onSettled: () => setUndoing(null),
  });

  if (recent.error) return <ErrorState message={describeError(recent.error)} onRetry={() => void recent.refetch()} />;
  if (!recent.isLoading && (recent.data ?? []).length === 0) return null;

  const columns: TableColumn<ImportBatch>[] = [
    { key: "file", header: "File", role: "primary", cell: (batch) => batch.fileName || "Pasted rows" },
    { key: "when", header: "When", cell: (batch) => `${formatDateTime(batch.createdAt)} by ${batch.createdByName}` },
    { key: "result", header: "Result", cell: resultText },
    {
      key: "action",
      header: "",
      role: "secondary",
      align: "right",
      cell: (batch) =>
        batch.status === "UNDONE" ? (
          <StatusPill tone="neutral">Undone</StatusPill>
        ) : batch.canUndo ? (
          <Button variant="secondary" onClick={() => setUndoing(batch)}>
            Undo
          </Button>
        ) : (
          <span className="text-[13px] text-text-secondary">Locked</span>
        ),
    },
  ];

  return (
    <section aria-labelledby="recent-imports" className="flex flex-col gap-3">
      <h2 id="recent-imports" className="text-[17px] font-semibold text-text-primary">
        Recent imports
      </h2>
      <ResponsiveTable
        label="Recent imports"
        columns={columns}
        rows={recent.data ?? []}
        loading={recent.isLoading}
        getRowKey={(batch) => batch.id}
      />
      <ConfirmDialog
        open={undoing !== null}
        tone="danger"
        title="Undo this import?"
        body="The stock this file added comes off the shelf and the products it created are archived. If any of that stock has already been used, nothing changes and you will be told why."
        confirmLabel="Undo import"
        loading={undo.isPending}
        onConfirm={() => undoing && undo.mutate(undoing)}
        onCancel={() => setUndoing(null)}
      />
    </section>
  );
}
