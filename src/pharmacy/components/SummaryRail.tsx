import type { ReactNode } from "react";
import { Card } from "@/shared/components/Card";

export interface SummaryRow {
  label: string;
  value: ReactNode;
}

interface SummaryRailProps {
  title?: string;
  rows: SummaryRow[];
  /** Notes, warnings and the primary action sit under the figures. */
  children?: ReactNode;
}

// On large screens this is the sticky right-hand column of a review step; on
// phones it simply stacks under the content, so callers place it after it.
export function SummaryRail({ title = "Summary", rows, children }: SummaryRailProps) {
  return (
    <Card className="p-5 lg:sticky lg:top-4">
      <h2 className="text-[15px] font-semibold text-text-primary">{title}</h2>
      <dl className="mt-3 divide-y divide-border-subtle text-[14px]">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3 py-2">
            <dt className="text-text-secondary">{row.label}</dt>
            <dd className="font-semibold tabular-nums text-text-primary">{row.value}</dd>
          </div>
        ))}
      </dl>
      {children && <div className="mt-4 flex flex-col gap-3">{children}</div>}
    </Card>
  );
}
