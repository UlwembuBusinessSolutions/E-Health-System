import type { ReactNode } from "react";
import { Archive, CalendarClock, CalendarX, CheckCircle2, PackageX, TrendingDown } from "lucide-react";
import { StatusPill, type PillTone } from "@/shared/components/StatusPill";

export type StockStatus = "IN_STOCK" | "LOW" | "OUT" | "EXPIRED" | "EXPIRING_SOON" | "ARCHIVED";

interface StatusPresentation {
  label: string;
  tone: PillTone;
  icon: ReactNode;
}

const ICON_CLASS = "size-3.5";

// Every state has its own icon and wording, so it reads without colour.
const PRESENTATION: Record<StockStatus, StatusPresentation> = {
  IN_STOCK: { label: "In stock", tone: "success", icon: <CheckCircle2 className={ICON_CLASS} aria-hidden /> },
  LOW: { label: "Low", tone: "warning", icon: <TrendingDown className={ICON_CLASS} aria-hidden /> },
  OUT: { label: "Out", tone: "danger", icon: <PackageX className={ICON_CLASS} aria-hidden /> },
  EXPIRED: { label: "Expired", tone: "danger", icon: <CalendarX className={ICON_CLASS} aria-hidden /> },
  EXPIRING_SOON: { label: "Expires soon", tone: "warning", icon: <CalendarClock className={ICON_CLASS} aria-hidden /> },
  ARCHIVED: { label: "Archived", tone: "neutral", icon: <Archive className={ICON_CLASS} aria-hidden /> },
};

export function StockStatusPill({ status }: { status: StockStatus }) {
  const { label, tone, icon } = PRESENTATION[status];
  return (
    <StatusPill tone={tone} icon={icon}>
      {label}
    </StatusPill>
  );
}
