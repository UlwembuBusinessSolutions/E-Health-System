import { useState } from "react";
import type { CountSummary } from "@/shared/api/pharmacyCounts";
import { Button } from "@/shared/components/Button";
import { ErrorState } from "../components/ErrorState";
import { FilterChips } from "../components/FilterChips";
import { SkeletonRows } from "../components/SkeletonRows";
import { SummaryRail } from "../components/SummaryRail";
import { describeError } from "../lib/problem";
import { CancelCountDialog } from "./CancelCountDialog";
import { formatSigned, matchesFilter, totalsOf, type ReviewFilter } from "./countMath";
import { ReviewTable } from "./ReviewTable";
import { useStockCount } from "./useStockCount";

interface ReviewStepProps {
  countId: string;
  onBackToCounting: () => void;
  onPosted: (result: CountSummary) => void;
  onCancelled: () => void;
}

export function ReviewStep({ countId, onBackToCounting, onPosted, onCancelled }: ReviewStepProps) {
  const { detail, setCounted, setReason, post, cancel } = useStockCount(countId, true);
  const [filter, setFilter] = useState<ReviewFilter>("ALL");
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  if (detail.isLoading) return <SkeletonRows rows={6} />;
  if (detail.error || !detail.data) {
    return <ErrorState message={describeError(detail.error)} onRetry={() => void detail.refetch()} />;
  }

  const lines = detail.data.lines;
  const totals = totalsOf(lines);
  const differences = totals.short + totals.over;
  const canPost = totals.counted > 0 && totals.missingReasons === 0;

  const chips = [
    { value: "ALL" as const, label: "All", count: lines.length },
    { value: "DIFFERENCES" as const, label: "Differences", count: differences },
    { value: "LARGE" as const, label: "Large", count: totals.large },
    { value: "NOT_COUNTED" as const, label: "Not counted", count: totals.total - totals.counted },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="flex min-w-0 flex-col gap-4">
        <FilterChips label="Show lots" options={chips} value={filter} onChange={(next) => setFilter(next ?? "ALL")} />
        <ReviewTable
          lines={lines.filter((line) => matchesFilter(line, filter))}
          onRecount={(line, quantity) => setCounted.mutate({ lineId: line.id, quantity })}
          onReason={(line, reason) => setReason.mutate({ lineId: line.id, reason })}
        />
      </div>

      <SummaryRail
        rows={[
          { label: "Lots counted", value: `${totals.counted} of ${totals.total}` },
          { label: "Matches", value: totals.matches },
          { label: "Short", value: totals.short },
          { label: "Over", value: totals.over },
          { label: "Net units", value: formatSigned(totals.netUnits) },
        ]}
      >
        {totals.large > 0 && (
          <p className="text-[13px] text-amber-600">
            {totals.large} large {totals.large === 1 ? "difference" : "differences"}. Change the number in the
            &ldquo;You counted&rdquo; box to recount before you post.
          </p>
        )}
        <p className="text-[12.5px] text-text-secondary">Large means more than 10% off the ledger, or more than 50 units.</p>
        {totals.missingReasons > 0 && (
          <p role="status" className="text-[13px] text-text-secondary">
            Choose a reason for the {totals.missingReasons} {totals.missingReasons === 1 ? "difference" : "differences"} still missing one.
          </p>
        )}
        <Button size="lg" disabled={!canPost} loading={post.isPending} onClick={() => post.mutate(undefined, { onSuccess: onPosted })}>
          Post adjustments
        </Button>
        <Button variant="secondary" onClick={onBackToCounting}>
          Back to counting
        </Button>
        <Button variant="ghost" onClick={() => setConfirmingCancel(true)}>
          Cancel count
        </Button>
      </SummaryRail>

      <CancelCountDialog
        open={confirmingCancel}
        loading={cancel.isPending}
        onConfirm={() => cancel.mutate(undefined, { onSuccess: onCancelled })}
        onCancel={() => setConfirmingCancel(false)}
      />
    </div>
  );
}
