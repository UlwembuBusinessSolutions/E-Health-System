import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { getCount, type CountSummary } from "@/shared/api/pharmacyCounts";
import { Card } from "@/shared/components/Card";
import { PageHeader } from "@/shared/components/PageHeader";
import { formatDateTime, pluralise } from "../lib/format";
import { describeError } from "../lib/problem";
import { FacilityField } from "../components/FacilityField";
import { StepIndicator } from "../components/StepIndicator";
import { useFacilitySelection } from "../lib/useFacilitySelection";
import { pharmacyKeys } from "../lib/queryKeys";
import { CountStep } from "./CountStep";
import { DoneView } from "./DoneView";
import { ReviewStep } from "./ReviewStep";
import { SetupStep } from "./SetupStep";
import { differenceOf, formatSigned, reasonLabel } from "./countMath";

type Stage = "setup" | "count" | "review" | "done";

const STEPS = ["Set up", "Count", "Review and post"];
const STEP_INDEX: Record<Stage, number> = { setup: 0, count: 1, review: 2, done: 3 };

// `/app/pharmacy/counts`. The count itself is a server-side draft, so this page
// only remembers which draft is open and which step is showing: leaving or
// reloading never loses a typed number.
export function StockCountPage() {
  const queryClient = useQueryClient();
  const { facilityId, facilities, selectFacility } = useFacilitySelection();
  const [searchParams] = useSearchParams();
  const selectedCountId = searchParams.get("countId");
  const [stage, setStage] = useState<Stage>("setup");
  const [countId, setCountId] = useState("");
  const [result, setResult] = useState<CountSummary | null>(null);

  function backToSetup() {
    setStage("setup");
    setCountId("");
    setResult(null);
  }

  function openCount(id: string) {
    setCountId(id);
    setStage("count");
  }

  function saveForLater() {
    void queryClient.invalidateQueries({ queryKey: pharmacyKeys.counts.list(facilityId, "DRAFT") });
    backToSetup();
  }

  if (selectedCountId) {
    return <CountHistoryDetail countId={selectedCountId} facilityId={facilityId} />;
  }

  function changeFacility(id: string) {
    selectFacility(id);
    backToSetup();
  }

  return (
    <div>
      <PageHeader
        title="Stock count"
        description="Check the shelf against the ledger. Any difference is posted as an Adjusted entry with a reason."
      />
      <FacilityField facilities={facilities} value={facilityId} onChange={changeFacility} />
      <StepIndicator steps={STEPS} current={STEP_INDEX[stage]} />

      {stage === "setup" && facilityId && <SetupStep facilityId={facilityId} onCountReady={openCount} />}
      {stage === "count" && (
        <CountStep
          countId={countId}
          onFinish={() => setStage("review")}
          onSaveForLater={saveForLater}
          onCancelled={saveForLater}
        />
      )}
      {stage === "review" && (
        <ReviewStep
          countId={countId}
          onBackToCounting={() => setStage("count")}
          onPosted={(posted) => {
            setResult(posted);
            setStage("done");
          }}
          onCancelled={saveForLater}
        />
      )}
      {stage === "done" && result && <DoneView posted={result} onStartNew={backToSetup} />}
    </div>
  );
}

function CountHistoryDetail({ countId, facilityId }: { countId: string; facilityId: string }) {
  const detail = useQuery({
    queryKey: pharmacyKeys.counts.detail(countId, false),
    queryFn: () => getCount(countId),
    enabled: countId !== "",
  });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Stock count variance" description="Read-only posted stock-take record."
        action={<Link to={`/app/pharmacy/counts?facilityId=${encodeURIComponent(facilityId)}`}
          className="inline-flex h-11 items-center gap-2 rounded-lg border border-border-strong px-4 text-sm font-semibold text-text-primary hover:bg-surface-sunken">
          <ArrowLeft className="size-4" aria-hidden /> Back to stock counts
        </Link>} />
      {detail.isLoading && <Card className="p-5"><p role="status" className="text-sm text-text-secondary">Loading stock count…</p></Card>}
      {detail.isError && <Card className="p-5">
        <p role="alert" className="text-sm text-danger-600">{describeError(detail.error, "Stock count could not be loaded.")}</p>
        <button type="button" disabled={detail.isFetching} onClick={() => void detail.refetch()}
          className="mt-3 text-sm font-semibold text-brand-700 underline">Retry</button>
      </Card>}
      {detail.data && detail.data.facilityId !== facilityId && (
        <Card className="p-5"><p role="alert" className="text-sm text-danger-600">This count does not belong to the selected clinic.</p></Card>
      )}
      {detail.data && detail.data.facilityId === facilityId && (
        <>
          <Card className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Posted stock take</p>
            <h2 className="mt-1 text-lg font-semibold text-text-primary">{detail.data.reference} · {detail.data.scopeLabel}</h2>
            <p className="mt-1 text-sm text-text-secondary">
              {detail.data.postedAt ? formatDateTime(detail.data.postedAt) : "Posted time unavailable"}
              {" · "}{pluralise(detail.data.differences ?? 0, "variance")}
              {" · "}{detail.data.postedByName ?? "Staff member"}
            </p>
          </Card>
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-left text-[13px]">
              <thead><tr className="border-b border-border-subtle text-[11px] uppercase text-text-secondary">
                <th className="px-4 py-3">Product</th><th className="px-4 py-3">Batch</th>
                <th className="px-4 py-3 text-right">Variance</th><th className="px-4 py-3">Reason</th>
              </tr></thead>
              <tbody className="divide-y divide-border-subtle">
                {detail.data.lines.filter((line) => (differenceOf(line) ?? 0) !== 0).map((line) => (
                  <tr key={line.id}>
                    <td className="px-4 py-3">{line.productName}</td>
                    <td className="px-4 py-3">{line.lotNumber}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatSigned(differenceOf(line) ?? 0)}</td>
                    <td className="px-4 py-3">{line.reason ? reasonLabel(line.reason) : "Not recorded"}</td>
                  </tr>
                ))}
                {detail.data.lines.filter((line) => (differenceOf(line) ?? 0) !== 0).length === 0 && (
                  <tr><td className="px-4 py-4 text-text-secondary" colSpan={4}>No variance lines were found in this posted count.</td></tr>
                )}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
