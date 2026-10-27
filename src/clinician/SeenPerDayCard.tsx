import { useState } from "react";
import clsx from "clsx";
import type { ClinicianDashboard } from "@/shared/api/clinicianDashboard";
import { ChartCard, ChartTable, LegendSwatch, type ChartView } from "@/shared/components/ChartCard";
import { dayTitle, isWeekend, niceScale, shortDay } from "@/shared/lib/chartFormat";
import { averageText, seenText, weekdayAverage, weekendColumns } from "./clinicianModel";

type Days = ClinicianDashboard["seenPerDay"];

const PLOT_HEIGHT = 200;

export function SeenPerDayCard({ days }: { days: Days }) {
  const [view, setView] = useState<ChartView>("chart");
  const [hovered, setHovered] = useState<number | null>(null);
  const average = weekdayAverage(days);
  const empty = days.every((day) => day.count === 0);

  return (
    <ChartCard
      title="Patients I saw per day"
      description={`Consultations you signed here, last 30 full days.${average !== null && !empty ? ` Weekday average ${averageText(average)}.` : ""}`}
      view={view}
      onViewChange={(next) => {
        setView(next);
        setHovered(null);
      }}
    >
      {view === "table" ? (
        <ChartTable
          caption="Patients seen per day, newest first"
          headers={["Date", "Patients seen"]}
          numeric={[1]}
          rows={[...days].reverse().map((day) => [`${dayTitle(day.date)}${isWeekend(day.date) ? " (weekend)" : ""}`, day.count])}
          maxHeight={320}
        />
      ) : empty ? (
        <p className="text-[13.5px] text-text-secondary">You haven't signed any consultations here in the last 30 days.</p>
      ) : (
        <Columns days={days} hovered={hovered} onHover={setHovered} />
      )}
    </ChartCard>
  );
}

function Columns({ days, hovered, onHover }: { days: Days; hovered: number | null; onHover: (index: number | null) => void }) {
  const { top, step } = niceScale(Math.max(...days.map((day) => day.count)));
  const ticks = Array.from({ length: top / step + 1 }, (_, index) => index * step);
  const slot = 100 / days.length;
  const tickIndexes = [0, 7, 14, 21, days.length - 1];
  const total = days.reduce((sum, day) => sum + day.count, 0);

  return (
    <>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-text-secondary" aria-label="Legend">
        <LegendSwatch className="bg-chart-series-1" label="Patients seen" />
        <LegendSwatch className="border border-border-subtle bg-chart-band" label="Weekend" />
      </ul>
      <div className="flex gap-2 pt-2">
        <div className="relative w-6 shrink-0 text-[11.5px] text-text-secondary" style={{ height: PLOT_HEIGHT }} aria-hidden>
          {ticks.map((tick) => (
            <span key={tick} className="absolute right-0 translate-y-1/2" style={{ bottom: `${(tick / top) * 100}%` }}>
              {tick}
            </span>
          ))}
        </div>
        <div
          className="relative isolate min-w-0 flex-1"
          style={{ height: PLOT_HEIGHT }}
          onMouseLeave={() => onHover(null)}
          role="img"
          aria-label={`Column chart: ${seenText(total)} over the last 30 days. Use the Table view for each day.`}
        >
          {weekendColumns(days.map((day) => day.date)).map((band) => (
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
          <div className="absolute inset-0 flex" aria-hidden>
            {days.map((day, index) => (
              <div key={day.date} className="relative h-full flex-1" onMouseEnter={() => onHover(index)}>
                {day.count > 0 && (
                  <div
                    className={clsx("absolute bottom-0 left-1/2 w-3/5 max-w-5 -translate-x-1/2 rounded-t", hovered === index ? "bg-chart-series-1 brightness-90" : "bg-chart-series-1")}
                    style={{ height: `${(day.count / top) * 100}%` }}
                  />
                )}
              </div>
            ))}
          </div>
          {hovered !== null && <Readout day={days[hovered]} centre={(hovered + 0.5) * slot} />}
        </div>
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
              style={{ left: position === 0 ? 0 : position === tickIndexes.length - 1 ? "100%" : `${(index + 0.5) * slot}%` }}
            >
              {shortDay(days[index].date)}
            </span>
          ))}
        </div>
      </div>
    </>
  );
}

function Readout({ day, centre }: { day: Days[number]; centre: number }) {
  const onRight = centre <= 50;
  return (
    <div
      className="pointer-events-none absolute top-2 z-10 w-44 rounded-lg bg-chart-tooltip-bg px-3 py-2.5 text-[12.5px] leading-normal text-chart-tooltip-fg shadow-lg"
      style={onRight ? { left: `calc(${centre}% + 14px)` } : { right: `calc(${100 - centre}% + 14px)` }}
    >
      <p className="text-chart-tooltip-muted">
        {dayTitle(day.date)}
        {isWeekend(day.date) ? " (weekend)" : ""}
      </p>
      <p>
        <strong className="text-[15px]">{day.count}</strong> <span className="text-chart-tooltip-muted">{day.count === 1 ? "patient" : "patients"} seen</span>
      </p>
    </div>
  );
}
