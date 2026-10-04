import { Link } from "react-router";
import { CheckCircle2, X } from "lucide-react";
import type { LedgerMovement } from "@/shared/api/pharmacyLedger";

interface ReversalNoticeProps {
  movement: LedgerMovement;
  onDismiss: () => void;
}

// The toast disappears on its own; this stays until dismissed so the follow-up
// link (the usual next step after a wrong receipt) is still there to click.
export function ReversalNotice({ movement, onDismiss }: ReversalNoticeProps) {
  return (
    <div role="status" className="flex items-start gap-3 rounded-lg bg-success-50 px-4 py-3 text-[14px] text-text-primary">
      <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success-600" aria-hidden />
      <p className="flex-1">
        Entry for {movement.productName} reversed.{" "}
        <Link
          to="/app/pharmacy/stock"
          className="inline-flex min-h-11 items-center font-semibold text-brand-600 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          Adjust the correct amount in Stock
        </Link>
      </p>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="grid size-11 shrink-0 place-items-center rounded-lg text-text-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
