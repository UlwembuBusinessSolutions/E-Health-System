import { CheckCircle2, Copy } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { useToast } from "@/shared/components/toast/ToastProvider";
import { pluralise } from "@/pharmacy/lib/format";
import { buildSupplierMessage, type PostedSummary } from "./postedSummary";

interface ReceiptPostedViewProps {
  summary: PostedSummary;
  onReceiveAnother: () => void;
}

const LINK_CLASS =
  "inline-flex h-11 items-center justify-center rounded-lg border border-border-strong bg-surface-raised px-4 text-[14px] font-semibold text-text-primary hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400";

export function ReceiptPostedView({ summary, onReceiveAnother }: ReceiptPostedViewProps) {
  const { showToast } = useToast();
  const facilityQuery = `?facilityId=${encodeURIComponent(summary.facilityId)}`;

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(buildSupplierMessage(summary));
      showToast("Message copied. Paste it into an email or chat to the supplier.", "success");
    } catch {
      showToast("Couldn't copy the message. Select and copy it manually.", "error");
    }
  }

  return (
    <Card className="mx-auto flex max-w-xl flex-col items-center gap-4 p-6 text-center sm:p-8">
      <span className="grid size-14 place-items-center rounded-full bg-success-50 text-success-600">
        <CheckCircle2 className="size-8" aria-hidden />
      </span>
      <div role="status">
        <h1 className="text-[20px] font-semibold text-text-primary">Receipt {summary.receiptNumber} posted</h1>
        <p className="mt-1 text-[14px] text-text-secondary">
          {pluralise(summary.lineCount, "line")} and {pluralise(summary.acceptedUnits, "unit")} are now on the shelf
          and in the ledger.
        </p>
      </div>

      {summary.flagged.length > 0 && (
        <section aria-label="Flagged for the supplier" className="w-full rounded-lg bg-amber-50 p-4 text-left">
          <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-amber-600">
            Flagged for the supplier
          </h2>
          <ul className="flex flex-col gap-2 text-[13.5px] text-text-primary">
            {summary.flagged.map((item, index) => (
              <li key={`${item.name}-${index}`}>
                <strong>{item.name}</strong> · {item.reason}
                {item.detail && <span className="block text-text-secondary">{item.detail}</span>}
              </li>
            ))}
          </ul>
          <Button variant="secondary" className="mt-3" icon={<Copy className="size-4" aria-hidden />} onClick={() => void copyMessage()}>
            Copy message for supplier
          </Button>
        </section>
      )}

      <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
        <Link to={`/app/pharmacy/stock${facilityQuery}`} className={LINK_CLASS}>
          View stock
        </Link>
        <Link to={`/app/pharmacy/ledger${facilityQuery}`} className={LINK_CLASS}>
          View ledger
        </Link>
        <Button onClick={onReceiveAnother}>Receive another delivery</Button>
      </div>
    </Card>
  );
}
