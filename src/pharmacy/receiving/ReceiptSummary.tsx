import { CheckCircle2, Save } from "lucide-react";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { formatDateTime, pluralise } from "@/pharmacy/lib/format";
import { useMediaQuery } from "@/pharmacy/lib/useMediaQuery";

interface ReceiptSummaryProps {
  lineCount: number;
  acceptedUnits: number;
  supplierName: string | null;
  flaggedCount: number;
  /** The next thing to fix; null means the receipt can be posted. */
  hint: string | null;
  /** Server-side failure from the last post attempt. */
  errorMessage: string | null;
  posting: boolean;
  canSaveDraft: boolean;
  /** ISO time of the saved draft for this facility, if any. */
  draftSavedAt: string | null;
  onPost: () => void;
  onSaveDraft: () => void;
}

// One layout is rendered at a time (not two hidden by CSS): the rail on
// desktop, a sticky bottom bar below `lg` so Post is always reachable.
export function ReceiptSummary(props: ReceiptSummaryProps) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  return isDesktop ? <SummaryRail {...props} /> : <SummaryBar {...props} />;
}

function PostButton({ hint, posting, onPost }: Pick<ReceiptSummaryProps, "hint" | "posting" | "onPost">) {
  return (
    <Button
      size="lg"
      icon={<CheckCircle2 className="size-4" aria-hidden />}
      loading={posting}
      disabled={hint !== null}
      onClick={onPost}
      className="flex-1"
    >
      Post receipt
    </Button>
  );
}

function SummaryRail(props: ReceiptSummaryProps) {
  const { lineCount, acceptedUnits, supplierName, flaggedCount, hint, errorMessage, canSaveDraft, draftSavedAt, onSaveDraft } = props;
  return (
    <aside aria-label="Receipt summary" className="sticky top-4 self-start">
      <Card className="flex flex-col gap-4 p-5">
        <h2 className="text-[15px] font-semibold text-text-primary">Receipt summary</h2>
        <dl className="grid grid-cols-2 gap-3 text-[13px] text-text-secondary">
          <div>
            <dt>Product lines</dt>
            <dd className="text-[20px] font-semibold tabular-nums text-text-primary">{lineCount}</dd>
          </div>
          <div>
            <dt>Accepted units</dt>
            <dd className="text-[20px] font-semibold tabular-nums text-text-primary">{acceptedUnits.toLocaleString("en-ZA")}</dd>
          </div>
        </dl>
        <p className="text-[13.5px] text-text-secondary">
          Supplier: <strong className="text-text-primary">{supplierName ?? "Not chosen yet"}</strong>
        </p>
        <p className="text-[13.5px] text-text-secondary">
          {flaggedCount === 0 ? "No problems flagged." : `${pluralise(flaggedCount, "line")} flagged for the supplier.`}
        </p>

        <div role="status" className="text-[13.5px]">
          {hint ? <span className="text-amber-600">{hint}</span> : <span className="text-success-600">Ready to post.</span>}
        </div>
        {errorMessage && (
          <p role="alert" className="text-[13.5px] text-danger-600">
            {errorMessage}
          </p>
        )}

        <div className="flex flex-col gap-2">
          <PostButton hint={hint} posting={props.posting} onPost={props.onPost} />
          <Button variant="secondary" icon={<Save className="size-4" aria-hidden />} disabled={!canSaveDraft || props.posting} onClick={onSaveDraft}>
            Save draft
          </Button>
        </div>
        {draftSavedAt && <p className="text-[12.5px] text-text-secondary">Draft saved {formatDateTime(draftSavedAt)}.</p>}
        <p className="text-[12.5px] text-text-secondary">
          Posting adds accepted quantities to stock and records the receipt in the ledger.
        </p>
      </Card>
    </aside>
  );
}

function SummaryBar(props: ReceiptSummaryProps) {
  const { lineCount, acceptedUnits, flaggedCount, hint, errorMessage, canSaveDraft, onSaveDraft } = props;
  return (
    <aside
      aria-label="Receipt summary"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border-subtle bg-surface-raised px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-card"
    >
      <p role="status" className="mb-2 text-[13px] text-text-secondary">
        <strong className="text-text-primary">
          {pluralise(lineCount, "line")} · {pluralise(acceptedUnits, "unit")}
        </strong>
        {flaggedCount > 0 && ` · ${flaggedCount} flagged`}
        {" · "}
        {hint ? <span className="text-amber-600">{hint}</span> : <span className="text-success-600">Ready to post.</span>}
      </p>
      {errorMessage && (
        <p role="alert" className="mb-2 text-[13px] text-danger-600">
          {errorMessage}
        </p>
      )}
      <div className="flex gap-2">
        <Button variant="secondary" aria-label="Save draft" disabled={!canSaveDraft || props.posting} onClick={onSaveDraft}>
          <Save className="size-4" aria-hidden />
        </Button>
        <PostButton hint={hint} posting={props.posting} onPost={props.onPost} />
      </div>
    </aside>
  );
}
