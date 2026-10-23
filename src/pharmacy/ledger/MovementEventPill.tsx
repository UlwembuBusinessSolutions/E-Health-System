import clsx from "clsx";
import { ArrowDownToLine, ArrowUpFromLine, Flag, SlidersHorizontal, Trash2, Undo2, type LucideIcon } from "lucide-react";
import { EVENT_LABELS, type MovementEventKind } from "./lib/movementEvents";

const STYLES: Record<MovementEventKind, { icon: LucideIcon; classes: string }> = {
  RECEIVED: { icon: ArrowDownToLine, classes: "bg-success-50 text-success-600" },
  DISPENSED: { icon: ArrowUpFromLine, classes: "bg-brand-50 text-brand-700" },
  REMOVED: { icon: Trash2, classes: "bg-danger-50 text-danger-600" },
  REVERSAL: { icon: Undo2, classes: "bg-amber-50 text-amber-600" },
  ADJUSTED: { icon: SlidersHorizontal, classes: "bg-surface-sunken text-text-primary" },
  OPENING: { icon: Flag, classes: "bg-surface-sunken text-text-primary" },
};

// Icon plus word: the event is never conveyed by colour alone.
export function MovementEventPill({ kind }: { kind: MovementEventKind }) {
  const { icon: Icon, classes } = STYLES[kind];
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[12.5px] font-semibold",
        classes,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {EVENT_LABELS[kind]}
    </span>
  );
}
