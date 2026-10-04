import { NavLink, Outlet } from "react-router-dom";
import clsx from "clsx";
import {
  ClipboardCheck,
  Package,
  PackagePlus,
  PackageOpen,
  Pill,
  ScrollText,
  ShieldCheck,
  ShoppingCart,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { PharmacyMoreMenu, type MoreMenuLink } from "./PharmacyMoreMenu";

interface PharmacyTab {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Dispensing lives at the module root, so it must match exactly or it would stay active everywhere. */
  end?: boolean;
}

// Day-to-day work gets a tab; rarer jobs (counts, suppliers, the scheduled
// register, one-off opening stock) live under "More". Routes for pages that
// aren't built yet are listed here on purpose: the integrator registers them.
const TABS: PharmacyTab[] = [
  { to: "/app/pharmacy", label: "Dispensing", icon: Pill, end: true },
  { to: "/app/pharmacy/stock", label: "Stock", icon: Package },
  { to: "/app/pharmacy/receive", label: "Receive", icon: PackagePlus },
  { to: "/app/pharmacy/reorder", label: "Reorder", icon: ShoppingCart },
  { to: "/app/pharmacy/ledger", label: "Ledger", icon: ScrollText },
];

const MORE_LINKS: MoreMenuLink[] = [
  { to: "/app/pharmacy/counts", label: "Count stock", icon: ClipboardCheck },
  { to: "/app/pharmacy/suppliers", label: "Suppliers", icon: Truck },
  { to: "/app/pharmacy/register", label: "Scheduled register", icon: ShieldCheck },
  { to: "/app/pharmacy/opening-stock", label: "Load opening stock", icon: PackageOpen },
];

export function PharmacyLayout() {
  return (
    <div>
      <nav aria-label="Pharmacy" className="mb-6 flex items-end border-b border-border-subtle">
        {/* The strip scrolls sideways on narrow screens instead of wrapping; "More" stays outside it so its dropdown isn't clipped. */}
        <div className="flex min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                clsx(
                  "flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3.5 text-[13.5px] font-medium transition-colors duration-150",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400",
                  isActive
                    ? "border-brand-500 text-brand-700"
                    : "border-transparent text-text-secondary hover:text-text-primary",
                )
              }
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </NavLink>
          ))}
        </div>
        <PharmacyMoreMenu links={MORE_LINKS} />
      </nav>
      <Outlet />
    </div>
  );
}
