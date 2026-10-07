import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Download, Undo2 } from "lucide-react";
import { undoImport, type ImportResult } from "@/shared/api/pharmacyImport";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { useToast } from "@/shared/components/toast/ToastProvider";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { downloadTextFile } from "../lib/csv";
import { pluralise } from "../lib/format";
import { describeError } from "../lib/problem";
import { invalidateAfterStockMovement, pharmacyKeys } from "../lib/queryKeys";
import { LEFT_OUT_FILENAME, leftOutCsv, type LeftOutRow } from "./importCsv";

interface DoneStepProps {
  result: ImportResult;
  leftOut: LeftOutRow[];
  onStartAnother: () => void;
}

const LINK_CLASS =
  "inline-flex h-11 items-center rounded-lg border border-border-strong bg-surface-raised px-4 text-[14px] font-semibold text-text-primary hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400";

function Tile({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <div className={`rounded-xl p-4 ${tone}`}>
      <p className="text-[26px] font-bold tabular-nums">{value}</p>
      <p className="text-[13.5px]">{label}</p>
    </div>
  );
}

// Step 4: what happened, the rows that were left out, and the way back.
export function DoneStep({ result, leftOut, onStartAnother }: DoneStepProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [undone, setUndone] = useState(false);

  const undo = useMutation({
    mutationFn: () => undoImport(result.batchId),
    onSuccess: () => {
      setUndone(true);
      setConfirming(false);
      showToast("Import undone. The stock and the new products are gone again.", "success");
      void invalidateAfterStockMovement(queryClient);
      void queryClient.invalidateQueries({ queryKey: pharmacyKeys.imports.all });
    },
    onError: (error) => {
      setConfirming(false);
      showToast(describeError(error), "error");
    },
  });

  if (undone) {
    return (
      <Card className="flex flex-col gap-4 p-6">
        <h2 className="text-[17px] font-semibold text-text-primary">Import undone</h2>
        <p className="text-[13.5px] text-text-secondary">
          Everything this file added was taken back out, and the products it created are archived. Your register keeps the
          history of both.
        </p>
        <div>
          <Button onClick={onStartAnother}>Start another import</Button>
        </div>
      </Card>
    );
  }

  const stockRows = result.rowsImported;
  return (
    <div className="flex flex-col gap-5">
      <Card className="grid gap-6 p-6 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <CheckCircle2 className="size-9 text-success-500" aria-hidden />
          <h2 className="text-[22px] font-semibold text-text-primary">Imported {pluralise(stockRows, "row")}</h2>
          <p className="text-[14px] leading-relaxed text-text-secondary">
            {pluralise(result.productsCreated, "new product")} created.{" "}
            {result.receiptsCreated > 0
              ? `${pluralise(result.unitsReceived, "unit")} received on ${pluralise(result.receiptsCreated, "receipt")}.`
              : "No stock was added."}{" "}
            {leftOut.length > 0 && `${pluralise(leftOut.length, "row")} left out.`}
          </p>
          <div className="mt-1 flex flex-wrap gap-3">
            <Link to="/app/pharmacy/stock" className={LINK_CLASS}>
              See it in Stock
            </Link>
            <Link to="/app/pharmacy/ledger" className={LINK_CLASS}>
              Open the ledger
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Tile value={result.productsCreated} label="new products" tone="bg-brand-50 text-brand-700" />
          <Tile value={result.receiptsCreated} label="receipts" tone="bg-surface-sunken text-text-primary" />
          <Tile value={result.scheduledRows} label="in the scheduled register" tone="bg-amber-50 text-amber-600" />
          <Tile value={leftOut.length} label="rows left out" tone="bg-danger-50 text-danger-600" />
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="flex flex-col gap-3 p-5">
          <h3 className="text-[16px] font-semibold text-text-primary">The rows you left out</h3>
          {leftOut.length === 0 ? (
            <p className="text-[13.5px] text-text-secondary">No rows were left out. Everything in your file went in.</p>
          ) : (
            <>
              <p className="text-[13.5px] text-text-secondary">
                Download them with the reason beside each one. Fix them in Excel and import that file again.
              </p>
              <div>
                <Button
                  variant="secondary"
                  icon={<Download className="size-4" aria-hidden />}
                  onClick={() => downloadTextFile(LEFT_OUT_FILENAME, leftOutCsv(leftOut))}
                >
                  Download left-out rows (.csv)
                </Button>
              </div>
            </>
          )}
        </Card>
        <Card className="flex flex-col gap-3 border-brand-200 p-5">
          <h3 className="text-[16px] font-semibold text-text-primary">Undo this import</h3>
          <p className="text-[13.5px] text-text-secondary">
            Takes back everything this file added in one go. It works for 24 hours, and only while none of the imported stock
            has been dispensed or removed.
          </p>
          <div>
            <Button variant="secondary" icon={<Undo2 className="size-4" aria-hidden />} onClick={() => setConfirming(true)}>
              Undo import
            </Button>
          </div>
        </Card>
      </div>

      <div>
        <Button variant="secondary" onClick={onStartAnother}>
          Start another import
        </Button>
      </div>

      <ConfirmDialog
        open={confirming}
        tone="danger"
        title="Undo this import?"
        body="The stock this file added comes off the shelf and the products it created are archived. If any of that stock has already been used, nothing changes and you will be told why."
        confirmLabel="Undo import"
        loading={undo.isPending}
        onConfirm={() => undo.mutate()}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
