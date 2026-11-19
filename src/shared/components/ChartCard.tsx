import { useId, type ReactNode } from "react";
import clsx from "clsx";
import { Card } from "@/shared/components/Card";

export type ChartView = "chart" | "table";

interface ChartCardProps {
  title: string;
  description: string;
  view: ChartView;
  onViewChange: (view: ChartView) => void;
  /** Extra header content beside the view switch, such as a status pill. */
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}

// Every dashboard chart has a table twin, so no value is only reachable by
// hovering or by telling colours apart.
export function ChartCard({ title, description, view, onViewChange, aside, className, children }: ChartCardProps) {
  const headingId = useId();
  return (
    <Card className={clsx("flex min-w-0 flex-col gap-4 p-5", className)}>
      <section aria-labelledby={headingId} className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-[1_1_240px]">
            <h2 id={headingId} className="text-[15.5px] font-semibold text-text-primary">
              {title}
            </h2>
            <p className="mt-0.5 text-[13px] text-text-secondary">{description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {aside}
            <div role="group" aria-label={`${title}: show as`} className="inline-flex shrink-0 overflow-hidden rounded-lg border border-border-strong">
              {(["chart", "table"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={view === option}
                  onClick={() => onViewChange(option)}
                  className={clsx(
                    "min-h-11 px-4 text-[13px] capitalize transition-colors duration-150 not-first:border-l not-first:border-border-strong",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400",
                    view === option
                      ? "bg-brand-50 font-semibold text-brand-700"
                      : "bg-surface-raised text-text-secondary hover:text-text-primary",
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </div>
        {children}
      </section>
    </Card>
  );
}

/** A plain data table for a chart's table view; scrolls sideways on narrow screens. */
export function ChartTable({ caption, headers, numeric, rows, maxHeight }: {
  caption: string;
  headers: string[];
  /** Indexes of right-aligned number columns. */
  numeric: number[];
  rows: ReactNode[][];
  maxHeight?: number;
}) {
  return (
    <div className="overflow-auto rounded-lg border border-border-subtle" style={maxHeight ? { maxHeight } : undefined}>
      <table className="w-full min-w-[30rem] border-collapse text-[13px]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {headers.map((header, index) => (
              <th
                key={header}
                scope="col"
                className={clsx(
                  "sticky top-0 border-b border-border-subtle bg-surface-sunken px-3 py-2 text-[12px] font-semibold text-text-secondary",
                  numeric.includes(index) ? "text-right" : "text-left",
                )}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, rowIndex) => (
            <tr key={rowIndex} className="border-b border-border-subtle last:border-b-0">
              {cells.map((cell, index) => (
                <td
                  key={index}
                  className={clsx("px-3 py-2 text-text-primary", numeric.includes(index) && "text-right tabular-nums")}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A colour key for a legend list; the label carries the meaning, never the colour alone. */
export function LegendSwatch({ className, label }: { className: string; label: ReactNode }) {
  return (
    <li className="inline-flex items-center gap-1.5">
      <span className={`size-3 shrink-0 rounded-[3px] ${className}`} aria-hidden />
      {label}
    </li>
  );
}
