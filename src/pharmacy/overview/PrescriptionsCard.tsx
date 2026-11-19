import { useState, type ReactNode } from "react";
import clsx from "clsx";
import { CircleCheck, TriangleAlert } from "lucide-react";
import type { PharmacyOverview } from "@/shared/api/pharmacyOverview";
import { ChartCard, ChartTable, type ChartView } from "@/shared/components/ChartCard";
import { BACKLOG_DAYS, backlog, dayTitle, niceScale, plural, shortDay, weekendBands } from "./overviewModel";

type Days = PharmacyOverview["prescriptionsPerDay"];

const PLOT_HEIGHT = 220;
const END_LABEL_MIN_GAP = 16;
const VIEW_WIDTH = 1000;
const VIEW_HEIGHT = 200;

export function PrescriptionsCard({ days }: { days: Days }) {
  const [view, setView] = useState<ChartView>("chart");
  const [hovered, setHovered] = useState<number | null>(null);

  const gap = backlog(days);
  const empty = days.every((day) => day.received === 0 && day.dispensed === 0);

  return (
    <ChartCard
      title="Prescriptions per day"
      description="Written vs dispensed (medicine handed over), over the last 30 full days."
      view={view}
      onViewChange={(next) => {
        setView(next);
        setHovered(null);
      }}
      aside={!empty && <BacklogPill gap={gap} />}
    >
      {view === "table" ? (
        <ChartTable
          caption="Prescriptions written and dispensed per day, newest first"
          headers={["Date", "Written", "Dispensed", "Difference"]}
          numeric={[1, 2, 3]}
          rows={[...days].reverse().map((day) => {
            const difference = day.received - day.dispensed;
            return [dayTitle(day.date), day.received, day.dispensed, difference > 0 ? `+${difference}` : difference];
          })}
          maxHeight={320}
        />
      ) : empty ? (
        <p className="text-[13.5px] text-text-secondary">No prescriptions were written or dispensed here in the last 30 days.</p>
      ) : (
        <LineChart days={days} hovered={hovered} onHover={setHovered} />
      )}
    </ChartCard>
  );
}

function BacklogPill({ gap }: { gap: number }) {
  return gap > 0 ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-50 px-3 py-1.5 text-[12.5px] font-semibold text-warning-600">
      <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
      {plural(gap, "more prescription", "more prescriptions")} written than dispensed in the last {BACKLOG_DAYS} days
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-sunken px-3 py-1.5 text-[12.5px] font-semibold text-text-secondary">
      <CircleCheck className="size-3.5 shrink-0" aria-hidden />
      Dispensing kept up over the last {BACKLOG_DAYS} days
    </span>
  );
}

function LineChart({ days, hovered, onHover }: { days: Days; hovered: number | null; onHover: (index: number | null) => void }) {
  const last = days.length - 1;
  const { top, step } = niceScale(Math.max(...days.map((day) => Math.max(day.received, day.dispensed))));
  const ticks = Array.from({ length: top / step + 1 }, (_, index) => index * step);
  const xPercent = (index: number) => (index / last) * 100;
  const yPercent = (value: number) => 100 - (value / top) * 100;
  const path = (values: number[]) =>
    values
      .map((value, index) => `${index === 0 ? "M" : "L"}${((index / last) * VIEW_WIDTH).toFixed(1)} ${(VIEW_HEIGHT - (value / top) * VIEW_HEIGHT).toFixed(1)}`)
      .join(" ");

  const end = days[last];
  const endGap = (Math.abs(end.received - end.dispensed) / top) * PLOT_HEIGHT;
  const tickIndexes = [0, 7, 14, 21, last];
  const totals = days.reduce((sum, day) => ({ received: sum.received + day.received, dispensed: sum.dispensed + day.dispensed }), { received: 0, dispensed: 0 });

  return (
    <>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-text-secondary" aria-label="Legend">
        <li className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-chart-series-1" aria-hidden />Written</li>
        <li className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-chart-series-2" aria-hidden />Dispensed</li>
        <li className="inline-flex items-center gap-1.5"><span className="size-3 rounded-[3px] border border-border-subtle bg-chart-band" aria-hidden />Weekend</li>
      </ul>
      <div className="flex gap-2 pt-2">
        <div className="relative w-6 shrink-0 text-[11.5px] text-text-secondary" style={{ height: PLOT_HEIGHT }} aria-hidden>
          {ticks.map((tick) => (
            <span key={tick} className="absolute right-0 translate-y-1/2" style={{ bottom: `${(tick / top) * 100}%` }}>
              {tick}
            </span>
          ))}
        </div>
        {/* isolate: the tooltip layers above the lines, never above the app's sticky header. */}
        <div className="relative isolate min-w-0 flex-1" style={{ height: PLOT_HEIGHT }} onMouseLeave={() => onHover(null)}>
          {weekendBands(days.map((day) => day.date)).map((band) => (
            <div key={band.left} className="absolute inset-y-0 bg-chart-band" style={{ left: `${band.left}%`, width: `${band.width}%` }} aria-hidden />
          ))}
          {ticks.map((tick) => (
            <div
              key={tick}
              className={clsx("absolute inset-x-0 border-t", tick === 0 ? "border-chart-axis" : "border-chart-grid")}
              style={{ bottom: `${(tick / top) * 100}%` }}
              aria-hidden
            />
          ))}
          <svg
            viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
            preserveAspectRatio="none"
            className="absolute inset-0 size-full overflow-visible"
            role="img"
            aria-label={`Line chart: ${totals.received} prescriptions written and ${totals.dispensed} dispensed over the last 30 days. Use the Table view for each day.`}
          >
            <path d={path(days.map((day) => day.received))} fill="none" stroke="var(--chart-series-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            <path d={path(days.map((day) => day.dispensed))} fill="none" stroke="var(--chart-series-2)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>

          <Dot left={100} top={yPercent(end.received)} className="bg-chart-series-1" />
          <Dot left={100} top={yPercent(end.dispensed)} className="bg-chart-series-2" />
          {end.received === end.dispensed ? (
            <EndLabel top={yPercent(end.received)}>
              {end.received} written
              <br />
              {end.dispensed} dispensed
            </EndLabel>
          ) : endGap >= END_LABEL_MIN_GAP ? (
            <>
              <EndLabel top={yPercent(end.received)}>{end.received} written</EndLabel>
              <EndLabel top={yPercent(end.dispensed)}>{end.dispensed} dispensed</EndLabel>
            </>
          ) : null}

          <div className="absolute inset-0 flex">
            {days.map((day, index) => (
              <div key={day.date} className="h-full flex-1" onMouseEnter={() => onHover(index)} />
            ))}
          </div>

          {hovered !== null && (
            <HoverReadout day={days[hovered]} left={xPercent(hovered)} receivedTop={yPercent(days[hovered].received)} dispensedTop={yPercent(days[hovered].dispensed)} />
          )}
        </div>
        <div className="w-24 shrink-0" />
      </div>
      <div className="flex gap-2" aria-hidden>
        <div className="w-6 shrink-0" />
        <div className="relative h-4 min-w-0 flex-1 text-[11.5px] text-text-secondary">
          {tickIndexes.map((index, position) => (
            <span
              key={index}
              className={clsx(
                "absolute whitespace-nowrap",
                position === 0 ? "" : position === tickIndexes.length - 1 ? "-translate-x-full" : "hidden -translate-x-1/2 sm:block",
              )}
              style={{ left: `${xPercent(index)}%` }}
            >
              {shortDay(days[index].date)}
            </span>
          ))}
        </div>
        <div className="w-24 shrink-0" />
      </div>
    </>
  );
}

function Dot({ left, top, className }: { left: number; top: number; className: string }) {
  return (
    <span
      className={`pointer-events-none absolute -ml-[5px] -mt-[5px] size-2.5 rounded-full ring-2 ring-surface-raised ${className}`}
      style={{ left: `${left}%`, top: `${top}%` }}
      aria-hidden
    />
  );
}

function EndLabel({ top, children }: { top: number; children: ReactNode }) {
  return (
    <span className="pointer-events-none absolute left-full translate-x-2.5 -translate-y-1/2 whitespace-nowrap text-[12px] leading-tight text-text-secondary" style={{ top: `${top}%` }}>
      {children}
    </span>
  );
}

function HoverReadout({ day, left, receivedTop, dispensedTop }: { day: Days[number]; left: number; receivedTop: number; dispensedTop: number }) {
  const difference = day.received - day.dispensed;
  const onRight = left <= 50;
  return (
    <>
      <div className="pointer-events-none absolute inset-y-0 border-l border-text-secondary" style={{ left: `${left}%` }} aria-hidden />
      <Dot left={left} top={receivedTop} className="bg-chart-series-1" />
      <Dot left={left} top={dispensedTop} className="bg-chart-series-2" />
      <div
        className="pointer-events-none absolute top-2 z-10 w-48 rounded-lg bg-chart-tooltip-bg px-3 py-2.5 text-[12.5px] leading-normal text-chart-tooltip-fg shadow-lg"
        style={onRight ? { left: `calc(${left}% + 12px)` } : { right: `calc(${100 - left}% + 12px)` }}
      >
        <p className="mb-1 text-chart-tooltip-muted">{dayTitle(day.date)}</p>
        <p className="flex items-center gap-2"><span className="h-0.5 w-3.5 bg-chart-series-1" aria-hidden /><strong className="text-[14px]">{day.received}</strong><span className="text-chart-tooltip-muted">written</span></p>
        <p className="flex items-center gap-2"><span className="h-0.5 w-3.5 bg-chart-series-2" aria-hidden /><strong className="text-[14px]">{day.dispensed}</strong><span className="text-chart-tooltip-muted">dispensed</span></p>
        <p className="mt-1 text-chart-tooltip-muted">
          {difference > 0 ? `${difference} more written than dispensed` : difference < 0 ? `${-difference} more dispensed (catching up)` : "Kept up"}
        </p>
      </div>
    </>
  );
}
