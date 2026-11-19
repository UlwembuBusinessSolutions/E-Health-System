import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { CalendarX2, Clock, OctagonAlert, TriangleAlert, type LucideIcon } from "lucide-react";
import type { PharmacyOverview } from "@/shared/api/pharmacyOverview";
import { formatDate } from "../lib/format";
import { needsOrdering, plural, waitedText } from "./overviewModel";

interface OverviewTilesProps {
  overview: PharmacyOverview;
  facilityId: string;
  now: Date;
}

// The "act now" numbers. Each tile opens the screen where it is dealt with;
// the icon colour hints at urgency but the label always says what it is.
export function OverviewTiles({ overview, facilityId, now }: OverviewTilesProps) {
  const facilityQuery = `?facilityId=${facilityId}`;
  const out = overview.stockCover.filter((row) => row.level === "OUT");
  const runningOut = overview.stockCover.filter(needsOrdering);
  const { waiting, expiry } = overview;

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(13.5rem,100%),1fr))] gap-4">
      <Tile
        to={`/app/pharmacy/dispensing${facilityQuery}`}
        icon={Clock}
        iconClassName="text-brand-500"
        label="Waiting to be dispensed"
        value={waiting.count}
        detail={waiting.count > 0 && waiting.oldestSince ? `Oldest has waited ${waitedText(waiting.oldestSince, now)}` : "Nothing waiting"}
      />
      <Tile
        to={`/app/pharmacy/stock${facilityQuery}`}
        icon={OctagonAlert}
        iconClassName="text-chart-critical"
        label="Out of stock"
        value={out.length}
        detail={out.length === 0 ? "Everything is in stock" : out.length === 1 ? out[0].displayName : `Including ${out[0].displayName}`}
      />
      <Tile
        to={`/app/pharmacy/reorder${facilityQuery}`}
        icon={TriangleAlert}
        iconClassName="text-warning-500"
        label="Runs out within 30 days"
        value={runningOut.length}
        unit={runningOut.length === 1 ? "product" : "products"}
        detail={runningOut.length === 0 ? "Nothing at the current rate of use" : "Order now or soon, see below"}
      />
      <Tile
        to={`/app/pharmacy/stock${facilityQuery}`}
        icon={CalendarX2}
        iconClassName="text-chart-soon"
        label="Expiring within 90 days"
        value={expiry.within90Count}
        unit={expiry.within90Count === 1 ? "batch" : "batches"}
        detail={
          expiry.expiredCount > 0 ? (
            <span className="font-semibold text-critical-600">
              {plural(expiry.expiredCount, "batch", "batches")} already expired
            </span>
          ) : expiry.nextExpiry ? (
            `Next one expires ${formatDate(expiry.nextExpiry)}`
          ) : (
            "Nothing expires in the next 6 months"
          )
        }
      />
    </div>
  );
}

interface TileProps {
  to: string;
  icon: LucideIcon;
  iconClassName: string;
  label: string;
  value: number;
  unit?: string;
  detail: ReactNode;
}

function Tile({ to, icon: Icon, iconClassName, label, value, unit, detail }: TileProps) {
  return (
    <Link
      to={to}
      className="flex flex-col gap-1.5 rounded-2xl border border-border-subtle bg-surface-raised px-5 py-4 text-text-primary shadow-card transition-colors duration-150 hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
    >
      <span className="flex items-center gap-2 text-[13.5px] text-text-secondary">
        <Icon className={`size-[18px] shrink-0 ${iconClassName}`} aria-hidden />
        {label}
      </span>
      <span className="text-[32px] font-semibold leading-tight">
        {value.toLocaleString("en-ZA")}
        {unit && <span className="ml-1.5 text-[15px] font-medium text-text-secondary">{unit}</span>}
      </span>
      <span className="text-[12.5px] text-text-secondary">{detail}</span>
    </Link>
  );
}
