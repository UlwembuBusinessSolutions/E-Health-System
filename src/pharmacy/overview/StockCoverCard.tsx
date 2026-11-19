import { useState } from "react";
import { Link } from "react-router-dom";
import { Package } from "lucide-react";
import type { CoverLevel, StockCover } from "@/shared/api/pharmacyOverview";
import { EmptyState } from "../components/EmptyState";
import { formatQuantity } from "../lib/units";
import { ChartCard, ChartTable, LegendSwatch, type ChartView } from "@/shared/components/ChartCard";
import {
  COVER_CHART_ROWS,
  COVER_SCALE_DAYS,
  LEVEL_STATUS,
  coverPercent,
  daysLeftText,
  usageText,
} from "./overviewModel";

const BAR_COLOR: Record<CoverLevel, string> = {
  OUT: "bg-chart-critical",
  CRITICAL: "bg-chart-critical",
  WARNING: "bg-chart-warning",
  OK: "bg-chart-ok",
  NO_RECENT_USE: "bg-chart-ok",
};

const PILL: Partial<Record<CoverLevel, { label: string; className: string }>> = {
  OUT: { label: "Order now", className: "bg-critical-50 text-critical-600" },
  CRITICAL: { label: "Order now", className: "bg-critical-50 text-critical-600" },
  WARNING: { label: "Order soon", className: "bg-warning-50 text-warning-600" },
};

const SCALE_MARKS = [7, 30];

export function StockCoverCard({ rows, facilityId }: { rows: StockCover[]; facilityId: string }) {
  const [view, setView] = useState<ChartView>("chart");
  const shown = rows.slice(0, COVER_CHART_ROWS);

  return (
    <ChartCard
      title="Days of stock left"
      description="Stock on hand ÷ average daily use over the last 30 days. Shortest first."
      view={view}
      onViewChange={setView}
      className="flex-[3_1_32rem]"
    >
      {rows.length === 0 ? (
        <EmptyState icon={Package} title="No products here yet" description="Add products to this facility to see how long its stock lasts." />
      ) : view === "table" ? (
        <ChartTable
          caption="Days of stock left for every product at this facility"
          headers={["Product", "On hand", "Average use", "Days left", "Status"]}
          numeric={[1, 3]}
          rows={rows.map((row) => [
            row.displayName,
            formatQuantity(row.available, row.baseUnit),
            usageText(row),
            row.daysLeft === null ? "—" : row.daysLeft.toLocaleString("en-ZA"),
            LEVEL_STATUS[row.level],
          ])}
        />
      ) : (
        <>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-text-secondary" aria-label="Legend">
            <LegendSwatch className="bg-chart-critical" label="Under 7 days" />
            <LegendSwatch className="bg-chart-warning" label="7–30 days" />
            <LegendSwatch className="bg-chart-ok" label="Over 30 days" />
          </ul>
          <div>
            <div className="px-2">
              <div className="relative h-4 text-[11.5px] text-text-secondary" aria-hidden>
                <span className="absolute left-0">0</span>
                {SCALE_MARKS.map((mark) => (
                  <span key={mark} className="absolute -translate-x-1/2" style={{ left: `${(mark / COVER_SCALE_DAYS) * 100}%` }}>
                    {mark}
                  </span>
                ))}
                <span className="absolute right-0">{COVER_SCALE_DAYS}+ days</span>
              </div>
            </div>
            <ul>
              {shown.map((row) => (
                <CoverRow key={row.productId} row={row} />
              ))}
            </ul>
          </div>
          <Link
            to={`/app/pharmacy/stock?facilityId=${facilityId}`}
            className="self-start text-[13.5px] font-semibold text-text-accent underline-offset-2 hover:underline"
          >
            View all {rows.length.toLocaleString("en-ZA")} products in Stock
          </Link>
        </>
      )}
    </ChartCard>
  );
}

function CoverRow({ row }: { row: StockCover }) {
  const pill = PILL[row.level];
  const percent = coverPercent(row);
  return (
    <li className="border-b border-border-subtle px-2 py-2.5 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13.5px] font-semibold leading-snug text-text-primary">{row.displayName}</p>
          <p className="mt-0.5 text-[12px] text-text-secondary">
            {formatQuantity(row.available, row.baseUnit)} on hand · {usageText(row)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
          <span className={row.level === "NO_RECENT_USE" ? "text-[13px] text-text-secondary" : "text-[13.5px] font-semibold text-text-primary"}>
            {daysLeftText(row)}
          </span>
          {pill && <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${pill.className}`}>{pill.label}</span>}
        </div>
      </div>
      <div className="relative mt-2 h-2.5" aria-hidden>
        <div className="absolute -inset-y-[3px] left-0 border-l border-chart-axis" />
        {SCALE_MARKS.map((mark) => (
          <div key={mark} className="absolute -inset-y-[3px] border-l border-chart-grid" style={{ left: `${(mark / COVER_SCALE_DAYS) * 100}%` }} />
        ))}
        {percent > 0 && (
          <div className={`absolute inset-y-0 left-0 rounded-r ${BAR_COLOR[row.level]}`} style={{ width: `${percent}%` }} />
        )}
      </div>
    </li>
  );
}
