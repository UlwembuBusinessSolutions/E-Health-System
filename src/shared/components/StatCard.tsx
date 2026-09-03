import type { ComponentType } from "react";
import { Card } from "@/shared/components/Card";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: ComponentType<{ className?: string }>;
  hint?: string;
}

// font-mono on the figure only — the one place in this pattern where a
// number reads as a measurement rather than prose, same reasoning as
// tabular-nums on the table columns elsewhere. Shared between the Platform
// Console and the tenant app rather than duplicated — both need the same
// "glance at a count" card.
export function StatCard({ label, value, icon: Icon, hint }: StatCardProps) {
  return (
    <Card className="flex items-start justify-between gap-3 p-5">
      <div className="min-w-0">
        <p className="text-[12.5px] font-medium uppercase tracking-wide text-text-secondary">{label}</p>
        <p className="mt-1.5 font-mono text-[28px] font-medium leading-none text-text-primary tabular-nums">
          {value}
        </p>
        {hint && <p className="mt-2 text-[12.5px] text-text-secondary">{hint}</p>}
      </div>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
        <Icon className="size-4.5" />
      </span>
    </Card>
  );
}
