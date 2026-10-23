import { useState } from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { OctagonAlert } from "lucide-react";
import type { ExpiringLot, PharmacyOverview } from "@/shared/api/pharmacyOverview";
import { formatDate } from "../lib/format";
import { formatQuantity } from "../lib/units";
import { ChartCard, ChartTable, LegendSwatch, type ChartView } from "@/shared/components/ChartCard";
import { monthLong, monthShort, niceScale, plural } from "./overviewModel";

const PLOT_HEIGHT = 168;
const NEXT_UP = 3;

export function ExpiryCard({ expiry, facilityId }: { expiry: PharmacyOverview["expiry"]; facilityId: string }) {
  const [view, setView] = useState<ChartView>("chart");
  const [picked, setPicked] = useState<string | null>(null);

  const totals = expiry.months.map((month) => month.within90Count + month.laterCount);
  const { top, step } = niceScale(Math.max(0, ...totals), 2);
  const ticks = Array.from({ length: top / step + 1 }, (_, index) => index * step);
  const pickedMonth = expiry.months.find((month) => month.month === picked) ?? null;
  const listed = pickedMonth ? expiry.lots.filter((lot) => lot.expiryDate.startsWith(pickedMonth.month)) : expiry.lots.slice(0, NEXT_UP);
  const truncated = expiry.totalLots > expiry.lots.length;

  return (
    <ChartCard
      title="Batches expiring by month"
      description="This month and the next five. Select a month to see its batches."
      view={view}
      onViewChange={setView}
      className="flex-[2_1_24rem]"
    >
      {expiry.expiredCount > 0 && (
        <div role="alert" className="flex items-start gap-2 rounded-lg bg-critical-50 px-3 py-2.5 text-[13px] text-critical-600">
          <OctagonAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {plural(expiry.expiredCount, "batch has", "batches have")} already expired and{" "}
            {expiry.expiredCount === 1 ? "is" : "are"} still in stock.{" "}
            <Link to={`/app/pharmacy/stock?facilityId=${facilityId}`} className="font-semibold underline underline-offset-2">
              Review in Stock
            </Link>
          </span>
        </div>
      )}

      {view === "table" ? (
        expiry.lots.length === 0 ? (
          <p className="text-[13.5px] text-text-secondary">Nothing expires in the next 6 months.</p>
        ) : (
          <>
            <ChartTable
              caption="Batches expiring in the next 6 months"
              headers={["Product", "Lot", "Quantity", "Expires", "Days left"]}
              numeric={[2, 4]}
              rows={expiry.lots.map((lot) => [lot.productName, lot.lotNumber, formatQuantity(lot.quantity, lot.baseUnit), formatDate(lot.expiryDate), lot.daysLeft])}
              maxHeight={360}
            />
            {truncated && <TruncatedNote shown={expiry.lots.length} total={expiry.totalLots} />}
          </>
        )
      ) : (
        <>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-text-secondary" aria-label="Legend">
            <LegendSwatch className="bg-chart-soon" label="Within 90 days" />
            <LegendSwatch className="bg-chart-ok" label="Later" />
          </ul>
          <div className="flex gap-2 pt-3">
            <div className="relative w-5 shrink-0 text-[11.5px] text-text-secondary" style={{ height: PLOT_HEIGHT }} aria-hidden>
              {ticks.map((tick) => (
                <span key={tick} className="absolute right-0 translate-y-1/2" style={{ bottom: `${(tick / top) * 100}%` }}>
                  {tick}
                </span>
              ))}
            </div>
            <div className="relative min-w-0 flex-1" style={{ height: PLOT_HEIGHT }}>
              {ticks.map((tick) => (
                <div
                  key={tick}
                  className={clsx("absolute inset-x-0 border-t", tick === 0 ? "border-chart-axis" : "border-chart-grid")}
                  style={{ bottom: `${(tick / top) * 100}%` }}
                  aria-hidden
                />
              ))}
              <div className="absolute inset-0 flex">
                {expiry.months.map((month) => {
                  const total = month.within90Count + month.laterCount;
                  const selected = picked === month.month;
                  return (
                    <button
                      key={month.month}
                      type="button"
                      aria-pressed={selected}
                      aria-label={`${monthLong(month.month)}: ${plural(total, "batch", "batches")}${month.within90Count > 0 && month.laterCount > 0 ? `, ${month.within90Count} within 90 days` : ""}`}
                      onClick={() => setPicked(selected ? null : month.month)}
                      className={clsx(
                        "relative flex-1 rounded-lg transition-colors duration-150 hover:bg-surface-sunken",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400",
                        selected && "bg-surface-sunken",
                      )}
                    >
                      <span className="absolute bottom-0 left-1/2 flex w-6 -translate-x-1/2 flex-col-reverse gap-[2px]" style={{ height: `${(total / top) * 100}%` }}>
                        {month.within90Count > 0 && (
                          <span className={clsx("bg-chart-soon", month.laterCount === 0 && "rounded-t")} style={{ flexGrow: month.within90Count }} />
                        )}
                        {month.laterCount > 0 && <span className="rounded-t bg-chart-ok" style={{ flexGrow: month.laterCount }} />}
                      </span>
                      {total > 0 && (
                        <span className="absolute left-1/2 -translate-x-1/2 -translate-y-1 text-[12.5px] font-semibold text-text-primary" style={{ bottom: `${(total / top) * 100}%` }}>
                          {total}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="-mt-2 flex gap-2" aria-hidden>
            <div className="w-5 shrink-0" />
            <div className="flex flex-1">
              {expiry.months.map((month) => (
                <span key={month.month} className="flex-1 text-center text-[11.5px] text-text-secondary">
                  {monthShort(month.month)}
                </span>
              ))}
            </div>
          </div>

          <div className="border-t border-border-subtle pt-3">
            <h3 className="mb-2 text-[13px] font-semibold text-text-primary">
              {pickedMonth ? (listed.length === 0 ? `Nothing expires in ${monthLong(pickedMonth.month)}` : `Expiring in ${monthLong(pickedMonth.month)}`) : "Next to expire"}
            </h3>
            {!pickedMonth && listed.length === 0 ? (
              <p className="text-[13px] text-text-secondary">Nothing expires in the next 6 months.</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {listed.map((lot) => (
                  <LotItem key={`${lot.lotNumber}-${lot.productName}-${lot.expiryDate}`} lot={lot} />
                ))}
              </ul>
            )}
            {pickedMonth && truncated && <TruncatedNote shown={expiry.lots.length} total={expiry.totalLots} />}
          </div>
        </>
      )}
    </ChartCard>
  );
}

function LotItem({ lot }: { lot: ExpiringLot }) {
  return (
    <li className="flex items-start justify-between gap-3">
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold text-text-primary">{lot.productName}</span>
        <span className="block text-[12px] text-text-secondary">
          Lot {lot.lotNumber} · {formatQuantity(lot.quantity, lot.baseUnit)}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-[13px] text-text-primary">{formatDate(lot.expiryDate)}</span>
        <span className="block text-[12px] text-text-secondary">{plural(lot.daysLeft, "day")} left</span>
      </span>
    </li>
  );
}

function TruncatedNote({ shown, total }: { shown: number; total: number }) {
  return (
    <p className="mt-2 text-[12px] text-text-secondary">
      Showing the first {shown.toLocaleString("en-ZA")} of {total.toLocaleString("en-ZA")} batches. The full list is in Stock.
    </p>
  );
}
