import { useRef } from "react";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { postOpeningStock, validateOpeningStock, type OpeningStockRow, type PostOpeningStockResult } from "@/shared/api/pharmacyPlanning";
import { Button } from "@/shared/components/Button";
import { useToast } from "@/shared/components/toast/ToastProvider";
import { ErrorState } from "../components/ErrorState";
import { SkeletonRows } from "../components/SkeletonRows";
import { SummaryRail } from "../components/SummaryRail";
import { describeError } from "../lib/problem";
import { CsvReviewTable } from "./CsvReviewTable";
import { STATUS_LABELS, summarise } from "./openingCsv";

interface ReviewStepProps {
  facilityId: string;
  rows: OpeningStockRow[];
  onRowsChange: (rows: OpeningStockRow[]) => void;
  onBack: () => void;
  onPosted: (result: PostOpeningStockResult) => void;
}

export function ReviewStep({ facilityId, rows, onRowsChange, onBack, onPosted }: ReviewStepProps) {
  const { showToast } = useToast();
  // One key for this review: posting twice (double click, retry) cannot load the stock twice.
  const idempotencyKey = useRef(crypto.randomUUID());

  const check = useQuery({
    queryKey: ["pharmacy", "opening-stock", "validate", facilityId, rows],
    queryFn: () => validateOpeningStock({ facilityId, rows }),
    enabled: rows.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  const post = useMutation({
    mutationFn: () => postOpeningStock({ facilityId, rows }, idempotencyKey.current),
    onSuccess: onPosted,
    onError: (error) => showToast(describeError(error), "error"),
  });

  const results = check.data?.results ?? [];
  const summary = summarise(rows, results);
  const canPost = rows.length > 0 && !check.isFetching && results.length === rows.length && summary.needFixing === 0;

  function edit(index: number, field: keyof OpeningStockRow, value: string) {
    onRowsChange(rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  if (check.isLoading) return <SkeletonRows rows={6} />;
  if (check.error && !check.data) return <ErrorState message={describeError(check.error)} onRetry={() => void check.refetch()} />;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <CsvReviewTable
        rows={rows}
        results={results}
        refreshing={check.isFetching}
        onEdit={edit}
        onRemove={(index) => onRowsChange(rows.filter((_, i) => i !== index))}
      />
      <SummaryRail
        rows={[
          { label: "Ready to post", value: summary.ready },
          { label: "Need fixing", value: summary.needFixing },
          { label: "Units ready", value: summary.unitsReady },
        ]}
      >
        {summary.problems.length > 0 && (
          <ul className="text-[13px] text-danger-600">
            {summary.problems.map((problem) => (
              <li key={problem.status}>
                {STATUS_LABELS[problem.status]}: {problem.count}
              </li>
            ))}
          </ul>
        )}
        <p className="rounded-lg bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-600">
          Opening stock can be loaded one time only. Check every row before you post.
        </p>
        <p role="status" className="text-[13px] text-text-secondary">
          {canPost ? "Everything checks out." : "Fix the rows marked in red to continue."}
        </p>
        <Button size="lg" disabled={!canPost} loading={post.isPending} onClick={() => post.mutate()}>
          Post as opening balance
        </Button>
        <Button variant="secondary" onClick={onBack}>
          Back to paste
        </Button>
      </SummaryRail>
    </div>
  );
}
