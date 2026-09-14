import clsx from "clsx";

export type PillTone = "success" | "danger" | "warning" | "neutral";

const TONE_CLASSES: Record<PillTone, string> = {
  success: "bg-success-50 text-success-600",
  danger: "bg-danger-50 text-danger-600",
  warning: "bg-amber-50 text-amber-600",
  neutral: "bg-ink-100 text-ink-600",
};

// Semantic status color, kept deliberately separate from brand-* (the
// product's one accent) — a pill's color here means "state of the record,"
// never "this is interactive" or "this is the primary action." Shared
// between the Platform Console and the tenant app rather than duplicated —
// both need the exact same "state of a record" affordance (an organization,
// a platform operator, a staff member).
export function StatusPill({ tone, children }: { tone: PillTone; children: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium",
        TONE_CLASSES[tone],
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {children}
    </span>
  );
}
