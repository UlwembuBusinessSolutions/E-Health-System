import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { CountSummary } from "@/shared/api/pharmacyCounts";
import { PageHeader } from "@/shared/components/PageHeader";
import { FacilityField } from "../components/FacilityField";
import { StepIndicator } from "../components/StepIndicator";
import { useFacilitySelection } from "../lib/useFacilitySelection";
import { pharmacyKeys } from "../lib/queryKeys";
import { CountStep } from "./CountStep";
import { DoneView } from "./DoneView";
import { ReviewStep } from "./ReviewStep";
import { SetupStep } from "./SetupStep";

type Stage = "setup" | "count" | "review" | "done";

const STEPS = ["Set up", "Count", "Review and post"];
const STEP_INDEX: Record<Stage, number> = { setup: 0, count: 1, review: 2, done: 3 };

// `/app/pharmacy/counts`. The count itself is a server-side draft, so this page
// only remembers which draft is open and which step is showing: leaving or
// reloading never loses a typed number.
export function StockCountPage() {
  const queryClient = useQueryClient();
  const { facilityId, facilities, selectFacility } = useFacilitySelection();
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
