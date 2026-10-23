import { useId, useState } from "react";
import { ChevronDown, ClipboardCheck, Mail, Phone, Printer, UserRound } from "lucide-react";
import clsx from "clsx";
import type { Prescription } from "@/shared/api/pharmacy";
import { Button } from "@/shared/components/Button";
import { printPrescription } from "@/shared/lib/printPrescription";
import { blockedItems, collectableItems } from "./itemState";

interface CardActionsProps {
  prescription: Prescription;
  onConfirmCollection: () => void;
  onThirdParty: () => void;
  onMessage: () => void;
}

const SECONDARY_LINK_CLASSES =
  "inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border-strong bg-surface-raised px-4 text-[14px] font-semibold text-text-primary hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400";

// One primary action and a "More" disclosure, at every screen width: the
// secondary actions (third party, print, call, message) are used far less
// often than handing over, and four buttons per card swamp a busy queue.
export function CardActions({ prescription: p, onConfirmCollection, onThirdParty, onMessage }: CardActionsProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreId = useId();

  const canHandOver = collectableItems(p).length > 0;
  const skippedCount = blockedItems(p).length;

  return (
    <div className="border-t border-border-subtle pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={!canHandOver}
          icon={<ClipboardCheck className="size-4" aria-hidden />}
          onClick={onConfirmCollection}
        >
          Confirm collection
        </Button>
        <Button
          variant="ghost"
          aria-expanded={moreOpen}
          aria-controls={moreId}
          icon={<ChevronDown className={clsx("size-4 transition-transform motion-reduce:transition-none", moreOpen && "rotate-180")} aria-hidden />}
          onClick={() => setMoreOpen((open) => !open)}
        >
          {moreOpen ? "Fewer" : "More"}
        </Button>
      </div>
      {skippedCount > 0 && (
        <p className="mt-2 text-[13px] text-text-secondary">
          Items with no stock stay pending. Mark them out of stock to tell the patient and prescriber.
        </p>
      )}
      {moreOpen && (
        <div id={moreId} className="mt-2 flex flex-wrap gap-2">
          <Button variant="secondary" disabled={!canHandOver} icon={<UserRound className="size-4" aria-hidden />} onClick={onThirdParty}>
            Third-party collection
          </Button>
          <Button variant="secondary" icon={<Printer className="size-4" aria-hidden />} onClick={() => printPrescription(p.id)}>
            Print
          </Button>
          {p.prescriberPhone && (
            <a href={`tel:${p.prescriberPhone}`} className={SECONDARY_LINK_CLASSES}>
              <Phone className="size-4" aria-hidden />
              Call {p.prescriberName ?? "prescriber"}
            </a>
          )}
          <Button variant="secondary" icon={<Mail className="size-4" aria-hidden />} onClick={onMessage}>
            Message prescriber
          </Button>
        </div>
      )}
    </div>
  );
}
