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

function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

// The persistent rail every /platform screen (past login) renders inside —
// dark ink-900 against the light surface canvas the pages themselves use,
// so "internal control plane" reads as a distinct register from the
// clinic-facing app without inventing a single new color: ink-* and
// brand-* are both already index.css's own scale, just applied in a
// configuration nothing else in the app uses yet.
export function Sidebar() {
  const navigate = useNavigate();
  const { operator, logout } = usePlatformAuth();

  const handleSignOut = () => {
    logout();
    navigate("/platform/login", { replace: true });
  };

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-ink-800 bg-ink-900 lg:flex">
      <Link to="/platform" className="flex items-center gap-2.5 rounded-md px-5 pb-2 pt-6 transition-opacity duration-150 hover:opacity-80">
        <span className="flex size-8 items-center justify-center rounded-md bg-brand-500 text-[13px] font-bold text-white">
          U
        </span>
        <div className="leading-tight">
          <p className="text-[13.5px] font-semibold text-ink-50">Ulwembu</p>
          <p className="text-[11px] font-medium uppercase tracking-wider text-ink-500">Platform console</p>
        </div>
      </Link>

      <nav className="mt-6 flex flex-1 flex-col gap-0.5 px-3">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              clsx(
                "group relative flex items-center gap-2.5 rounded-md px-3 py-2.5 text-[13.5px] font-medium transition-colors duration-150",
                isActive ? "bg-ink-800 text-ink-50" : "text-ink-400 hover:bg-ink-800/60 hover:text-ink-100",
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={clsx(
                    "absolute -left-3 h-4.5 w-0.5 rounded-r bg-brand-400 transition-opacity duration-150",
                    isActive ? "opacity-100" : "opacity-0",
                  )}
                  aria-hidden
                />
                <Icon className="size-4" aria-hidden />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {operator && (
        <div className="border-t border-ink-800 p-3">
          <div className="flex items-center gap-2.5 rounded-md px-2 py-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-brand-500/30 bg-brand-500/15 text-[11.5px] font-semibold text-brand-300">
              {initials(operator.firstName, operator.lastName)}
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-[13px] font-semibold text-ink-100">
                {operator.firstName} {operator.lastName}
              </p>
              <p className="truncate text-[12px] text-ink-500">{operator.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="mt-1 flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-[13px] font-medium text-ink-400 transition-colors duration-150 hover:bg-ink-800/60 hover:text-ink-100"
          >
            <LogOut className="size-4" aria-hidden />
            Sign out
          </button>
        </div>
      )}
    </aside>
  );
}
