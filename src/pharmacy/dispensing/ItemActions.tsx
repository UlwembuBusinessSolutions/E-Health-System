import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, ChevronDown, PackageX, PackagePlus, Undo2 } from "lucide-react";
import clsx from "clsx";
import type { DispenseLot, PrescriptionItem } from "@/shared/api/pharmacy";
import { Button } from "@/shared/components/Button";
import { canDispenseWhole, hasUsableStock, isFullyDispensed, returnableQuantity } from "./itemState";

export type ItemPanel = "outOfStock" | "part" | "lot" | "substitute" | "return";

interface ItemActionsProps {
  item: PrescriptionItem;
  lot: DispenseLot | null;
  dispensing: boolean;
  activePanel: ItemPanel | null;
  onDispense: () => void;
  onOpenPanel: (panel: ItemPanel) => void;
}

// Router <Link> dressed like a secondary Button: it navigates, so it must be a link.
const LINK_BUTTON_CLASSES =
  "inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border-strong bg-surface-raised px-4 text-[14px] font-semibold text-text-primary hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400";

interface MoreOption {
  panel: ItemPanel;
  label: string;
}

function moreOptionsFor(item: PrescriptionItem, lot: DispenseLot | null, partIsPrimary: boolean): MoreOption[] {
  if (isFullyDispensed(item)) return [];
  const options: MoreOption[] = [];
  const hasStock = lot !== null && lot.available > 0;
  if (hasStock && item.remainingQuantity > 1 && !partIsPrimary) options.push({ panel: "part", label: "Dispense part" });
  if (item.usableLots.length > 1 || item.skippedExpiredLots.length > 0) options.push({ panel: "lot", label: "Change lot" });
  const canSuggest = !hasStock && item.substitutionStatus !== "REQUESTED";
  if (canSuggest) options.push({ panel: "substitute", label: "Ask about a substitute" });
  return options;
}

export function ItemActions({ item, lot, dispensing, activePanel, onDispense, onOpenPanel }: ItemActionsProps) {
  const [moreOpen, setMoreOpen] = useState(false);

  const done = isFullyDispensed(item);
  const hasStock = lot !== null && lot.available > 0;
  const wholeIsPossible = canDispenseWhole(item, lot);
  // When the lot can't cover everything owed, giving part is the useful primary action.
  const partIsPrimary = !done && hasStock && !wholeIsPossible;
  const moreOptions = moreOptionsFor(item, lot, partIsPrimary);

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        {!done && wholeIsPossible && (
          <Button
            icon={<CheckCircle2 className="size-4" aria-hidden />}
            loading={dispensing}
            onClick={onDispense}
          >
            Dispense
          </Button>
        )}
        {partIsPrimary && (
          <Button icon={<CheckCircle2 className="size-4" aria-hidden />} onClick={() => onOpenPanel("part")}>
            Dispense part
          </Button>
        )}
        {item.status === "PENDING" && (
          <Button
            variant="secondary"
            icon={<PackageX className="size-4" aria-hidden />}
            aria-expanded={activePanel === "outOfStock"}
            onClick={() => onOpenPanel("outOfStock")}
          >
            Out of stock
          </Button>
        )}
        {!done && !hasUsableStock(item) && (
          <Link to="/app/pharmacy/receive" className={LINK_BUTTON_CLASSES}>
            <PackagePlus className="size-4" aria-hidden />
            Receive stock
          </Link>
        )}
        {done && returnableQuantity(item) > 0 && (
          <Button
            variant="secondary"
            icon={<Undo2 className="size-4" aria-hidden />}
            aria-expanded={activePanel === "return"}
            onClick={() => onOpenPanel("return")}
          >
            Record a return
          </Button>
        )}
        {moreOptions.length > 0 && (
          <Button
            variant="ghost"
            aria-expanded={moreOpen}
            icon={<ChevronDown className={clsx("size-4 transition-transform motion-reduce:transition-none", moreOpen && "rotate-180")} aria-hidden />}
            onClick={() => setMoreOpen((open) => !open)}
          >
            {moreOpen ? "Fewer options" : "More options"}
          </Button>
        )}
      </div>
      {moreOpen && (
        <div className="mt-2 flex flex-wrap gap-2">
          {moreOptions.map((option) => (
            <Button key={option.panel} variant="secondary" onClick={() => onOpenPanel(option.panel)}>
              {option.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
