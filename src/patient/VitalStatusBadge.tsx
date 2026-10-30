import { Check } from "lucide-react";
import type { VitalStatus } from "./vitalsStatus";

const TONES: Record<VitalStatus["tone"], string> = {
  optimal: "bg-[#d7e4e1] text-[#54766f]",
  caution: "bg-amber-100 text-amber-800",
  critical: "bg-[#dc2f3f] text-white",
};

/** The rounded status pill on the top-right of a dashboard card or tile. */
export function VitalStatusBadge({ status }: { status: VitalStatus }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-semibold leading-none ${TONES[status.tone]}`}>
      {status.label}
      {status.tone === "optimal" && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
    </span>
  );
}
