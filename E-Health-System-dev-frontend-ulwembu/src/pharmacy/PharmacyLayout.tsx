import { NavLink, Outlet } from "react-router-dom";
import clsx from "clsx";
import { ClipboardList, Package, Pill, ScrollText } from "lucide-react";

// Shared nav across the pharmacy module — plan section 11: "Preserve
// /app/pharmacy as the current dispensing queue. Add shared pharmacy
// navigation: Overview | Dispensing | Stock | Products | Ledger | Expiry |
// Stock counts." Phase 1 only builds Dispensing (already existed),
// Products, Stock and Ledger — Overview/Expiry/Counts/Transfers are later
// phases (pharmacy-stock-ledger-context.md's own delivery order), so
// they're deliberately absent here rather than linked to pages that don't
// exist yet.
const TABS = [
  { to: "/app/pharmacy", label: "Dispensing", icon: Pill, end: true },
  { to: "/app/pharmacy/stock", label: "Stock", icon: Package, end: false },
  { to: "/app/pharmacy/products", label: "Products", icon: ClipboardList, end: false },
  { to: "/app/pharmacy/ledger", label: "Ledger", icon: ScrollText, end: false },
];

export function PharmacyLayout() {
  return (
    <div>
      <nav aria-label="Pharmacy" className="mb-6 flex flex-wrap gap-1 border-b border-border-subtle">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              clsx(
                "flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-[13.5px] font-medium transition-colors duration-150",
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
      </nav>
      <Outlet />
    </div>
  );
}
