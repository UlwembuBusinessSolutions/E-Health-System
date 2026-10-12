import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import type { OpeningStockRow, PostOpeningStockResult } from "@/shared/api/pharmacyPlanning";
import { Card } from "@/shared/components/Card";
import { PageHeader } from "@/shared/components/PageHeader";
import { FacilityField } from "../components/FacilityField";
import { StepIndicator } from "../components/StepIndicator";
import { pluralise } from "../lib/format";
import { invalidateAfterStockMovement } from "../lib/queryKeys";
import { useFacilitySelection } from "../lib/useFacilitySelection";
import { ReviewStep } from "./ReviewStep";
import { UploadStep } from "./UploadStep";

type Stage = "paste" | "review" | "done";

const STEPS = ["Paste rows", "Check", "Post"];
const STEP_INDEX: Record<Stage, number> = { paste: 0, review: 1, done: 2 };
const LINK_CLASS =
  "inline-flex h-11 items-center rounded-lg border border-border-strong bg-surface-raised px-4 text-[14px] font-semibold text-text-primary hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400";

// `/app/pharmacy/opening-stock`: first-day setup, loaded once so the ledger starts true.
export function OpeningStockPage() {
  const queryClient = useQueryClient();
  const { facilityId, facilities, selectFacility } = useFacilitySelection();
  const [stage, setStage] = useState<Stage>("paste");
  const [text, setText] = useState("");
  const [rows, setRows] = useState<OpeningStockRow[]>([]);
  const [result, setResult] = useState<PostOpeningStockResult | null>(null);

  function posted(done: PostOpeningStockResult) {
    setResult(done);
    setStage("done");
    void invalidateAfterStockMovement(queryClient);
  }

  return (
    <div>
      <PageHeader
        title="Load opening stock"
        description="First-day setup. Bring in what is already on the shelf, once, so the ledger starts true."
      />
      <FacilityField facilities={facilities} value={facilityId} onChange={selectFacility} />
      <StepIndicator steps={STEPS} current={STEP_INDEX[stage]} />

      {stage === "paste" && (
        <UploadStep
          initialText={text}
          onCheck={(nextText, nextRows) => {
            setText(nextText);
            setRows(nextRows);
            setStage("review");
          }}
        />
      )}
      {stage === "review" && facilityId && (
        <ReviewStep facilityId={facilityId} rows={rows} onRowsChange={setRows} onBack={() => setStage("paste")} onPosted={posted} />
      )}
      {stage === "done" && result && (
        <Card className="flex flex-col gap-4 p-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-success-500" aria-hidden />
            <div>
              <h2 className="text-[17px] font-semibold text-text-primary">Opening stock posted</h2>
              <p className="text-[13.5px] text-text-secondary">
                {pluralise(result.rowsLoaded, "lot")}, {pluralise(result.totalUnits, "unit")}. Every entry is marked Opening
                balance. This list can&apos;t be imported again. To change a quantity later, use Adjust on the Stock
                screen, which adds a new entry.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/app/pharmacy/stock" className={LINK_CLASS}>View stock</Link>
            <Link to="/app/pharmacy/ledger" className={LINK_CLASS}>See the entries in the Ledger</Link>
          </div>
        </Card>
      )}
    </div>
  );
}
