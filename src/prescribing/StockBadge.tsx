import { CircleAlert, CircleCheck, CircleX } from "lucide-react";
import { StatusPill } from "@/shared/components/StatusPill";
import type { StockLevel } from "@/shared/api/prescribing";

// Stock state is carried by the icon and the words, not by colour alone.
export function StockBadge({ level, available }: { level: StockLevel; available: number }) {
  if (level === "OUT") {
    return (
      <StatusPill tone="danger" icon={<CircleX className="size-3.5" aria-hidden />}>
        Out of stock
      </StatusPill>
    );
  }
  if (level === "LOW") {
    return (
      <StatusPill tone="warning" icon={<CircleAlert className="size-3.5" aria-hidden />}>
        {`Low · ${available} left`}
      </StatusPill>
    );
  }
  return (
    <StatusPill tone="success" icon={<CircleCheck className="size-3.5" aria-hidden />}>
      {`In stock · ${available}`}
    </StatusPill>
  );
}
