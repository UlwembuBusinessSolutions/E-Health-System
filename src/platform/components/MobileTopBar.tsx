import { Link, NavLink, useNavigate } from "react-router-dom";
import clsx from "clsx";
import { Building2, ClipboardList, Gauge, LogOut, Users as UsersIcon } from "lucide-react";
import { usePlatformAuth } from "../PlatformAuthContext";

const NAV_ITEMS = [
  { to: "/platform", label: "Overview", icon: Gauge, end: true },
  { to: "/platform/organizations", label: "Organizations", icon: Building2, end: false },
  { to: "/platform/users", label: "Users", icon: UsersIcon, end: false },
  { to: "/platform/audit", label: "Audit trail", icon: ClipboardList, end: false },
] as const;

// Sidebar.tsx's own nav, laid out horizontally — under lg the permanent
// rail hides entirely (Sidebar.tsx: hidden lg:flex) rather than collapsing
// to an icon strip, so this is what carries the same three destinations on
// a narrower screen.
export function MobileTopBar() {
  const navigate = useNavigate();
  const { logout } = usePlatformAuth();

  return (
    <div className="sticky top-0 z-10 border-b border-ink-800 bg-ink-900 lg:hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <Link to="/platform" className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-brand-500 text-[12px] font-bold text-white">
            U
          </span>
          <p className="text-[13px] font-semibold text-ink-50">Platform console</p>
        </Link>
        <button
          type="button"
          onClick={() => {
            logout();
            navigate("/platform/login", { replace: true });
          }}
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[12.5px] font-medium text-ink-400 hover:bg-ink-800 hover:text-ink-100"
        >
          <LogOut className="size-3.5" aria-hidden />
          Sign out
        </button>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              clsx(
                "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors duration-150",
                isActive ? "bg-ink-800 text-ink-50" : "text-ink-400",
              )
            }
          >
            <Icon className="size-3.5" aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
