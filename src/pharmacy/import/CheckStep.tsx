import { useState } from "react";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { Card } from "@/shared/components/Card";
import { Button } from "@/shared/components/Button";
import { useToast } from "@/shared/components/toast/ToastProvider";
import { checkImport, runImport, type ImportResult, type ImportRow } from "@/shared/api/pharmacyImport";
import { ErrorState } from "../components/ErrorState";
import { FilterChips } from "../components/FilterChips";
import { SkeletonRows } from "../components/SkeletonRows";
import { describeError } from "../lib/problem";
import { pharmacyKeys } from "../lib/queryKeys";
import { ImportReviewTable, type ReviewItem } from "./ImportReviewTable";

interface CheckStepProps {
  facilityId: string;
  fileName: string;
  supplierId: string | null;
  invoiceNumber: string;
  rows: ImportRow[];
  onEdit: (index: number, changes: Partial<ImportRow>) => void;
  onSkip: (index: number, reason: string) => void;
  onBack: () => void;
  onImported: (result: ImportResult) => void;
}

type Filter = "new" | "restock" | "fix";

const RING_RADIUS = 34;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

function ReadyRing({ ready, total }: { ready: number; total: number }) {
  const percent = total === 0 ? 0 : Math.round((ready / total) * 100);
  return (
    <div className="relative size-20 shrink-0">
      <svg viewBox="0 0 84 84" className="size-20 -rotate-90" aria-hidden>
        <circle cx="42" cy="42" r={RING_RADIUS} fill="none" strokeWidth="9" className="stroke-ink-100" />
        <circle
          cx="42"
          cy="42"
          r={RING_RADIUS}
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          className="stroke-brand-500 transition-[stroke-dasharray] duration-300"
          strokeDasharray={`${(RING_LENGTH * percent) / 100} ${RING_LENGTH}`}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-[18px] font-bold tabular-nums text-text-primary">{percent}%</span>
    </div>
  );
}

// Step 3: what every row would do. Problem rows get one-click decisions; nothing is saved until Import.
export function CheckStep({ facilityId, fileName, supplierId, invoiceNumber, rows, onEdit, onSkip, onBack, onImported }: CheckStepProps) {
  const { showToast } = useToast();
  const [filter, setFilter] = useState<Filter | null>(null);

  const check = useQuery({
    queryKey: pharmacyKeys.imports.check(supplierId, invoiceNumber, rows),
    queryFn: () => checkImport({ supplierId, invoiceNumber, rows }),
    enabled: rows.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  const run = useMutation({
    mutationFn: () => runImport({ facilityId, fileName, supplierId, invoiceNumber, rows }),
    onSuccess: onImported,
    onError: (error) => showToast(describeError(error), "error"),
  });

  const results = check.data?.rows ?? [];
  const summary = check.data?.summary;
  const settled = !check.isFetching && results.length === rows.length;
  const canImport = settled && rows.length > 0 && check.data?.allOk === true;

  if (check.isLoading) return <SkeletonRows rows={6} />;
  if (check.error && !check.data) return <ErrorState message={describeError(check.error)} onRetry={() => void check.refetch()} />;
  if (rows.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-3 p-8 text-center">
        <p className="text-[14px] text-text-secondary">Every row has been left out, so there is nothing to import.</p>
        <Button variant="secondary" onClick={onBack}>
          Back to the file
        </Button>
      </Card>
    );
  }

  const items: ReviewItem[] = rows.map((row, index) => ({ index, row, result: results[index] }));
  const matches = (item: ReviewItem) =>
    filter === null ||
    (filter === "fix" && item.result?.status === "PROBLEM") ||
    (filter === "new" && item.result?.status === "NEW_PRODUCT") ||
    (filter === "restock" && item.result?.status === "RESTOCK");
  const shown = items.filter(matches);
  const problems = summary?.problems ?? 0;

  return (
    <div className="flex flex-col gap-5">
      <Card className="flex flex-wrap items-center gap-x-8 gap-y-4 p-5">
        <div className="flex items-center gap-4">
          <ReadyRing ready={summary?.ready ?? 0} total={summary?.total ?? rows.length} />
          <div>
            <p className="text-[17px] font-semibold text-text-primary">
              {summary?.ready ?? 0} of {summary?.total ?? rows.length} rows are ready
            </p>
            <p role="status" className="text-[13.5px] text-text-secondary">
              {problems === 0 ? "Everything checks out." : `${problems} still ${problems === 1 ? "needs" : "need"} a decision.`}
            </p>
          </div>
        </div>
        <dl className="flex flex-wrap gap-x-8 gap-y-3">
          {[
            ["New products", summary?.newProducts ?? 0],
            ["Restocked rows", summary?.restockRows ?? 0],
            ["Units going on the shelf", (summary?.units ?? 0).toLocaleString("en-ZA")],
            ["Go into the scheduled register", summary?.scheduledRows ?? 0],
          ].map(([label, value]) => (
            <div key={label} className="flex flex-col">
              <dd className="text-[22px] font-bold tabular-nums text-text-primary">{value}</dd>
              <dt className="text-[13px] text-text-secondary">{label}</dt>
            </div>
          ))}
        </dl>
      </Card>

      <FilterChips
        label="Show rows"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "new", label: "New products", count: items.filter((item) => item.result?.status === "NEW_PRODUCT").length },
          { value: "restock", label: "Restock", count: items.filter((item) => item.result?.status === "RESTOCK").length },
          { value: "fix", label: "Needs a decision", count: problems },
        ]}
      />

      <ImportReviewTable items={shown} refreshing={check.isFetching} onEdit={onEdit} onSkip={onSkip} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[13.5px] text-text-secondary">
            {canImport ? "Nothing is saved until you press Import." : "Fix or skip the rows marked in red to continue."}
          </span>
          <Button size="lg" disabled={!canImport} loading={run.isPending} onClick={() => run.mutate()}>
            Import {summary?.ready ?? rows.length} {(summary?.ready ?? rows.length) === 1 ? "row" : "rows"}
          </Button>
        </div>
      </div>
    </div>
  );
}
