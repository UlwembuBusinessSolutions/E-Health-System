import { NavLink, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { ClipboardList, Gauge, LogOut, Pill, Ticket, UserRound, Users as UsersIcon } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { getTenantSlug } from "@/shared/api/auth";
import { getOrganizationSelf } from "@/shared/api/organization";

function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

// The tenant app's own rail — light surface-raised against the app's
// surface canvas, brand-500 accent, deliberately the opposite register from
// the Platform Console's dark ink-900 sidebar (platform/components/Sidebar.tsx's
// own why-note): that one reads as "internal control plane," this one is
// the actual clinic-facing product, same visual family as the photographic
// tenant login it follows. Structure (logo mark, nav list, active-item
// accent bar, account footer) mirrors the platform sidebar exactly — same
// component, different palette — so switching between the two products
// still feels like one system.
export function Sidebar() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const orgQuery = useQuery({ queryKey: ["organization", "self"], queryFn: getOrganizationSelf });
  const org = orgQuery.data;

  // const navItems = [
  //   { to: "/app", label: "Dashboard", icon: Gauge, end: true },
  //   { to: "/app/patients", label: "Patients", icon: UserRound, end: false },
  //   { to: "/app/queue", label: "Queue", icon: Ticket, end: false },
  //   { to: "/app/pharmacy", label: "Pharmacy", icon: Pill, end: false },
  //   ...(user?.role === "ORG_ADMIN" ? [{ to: "/app/staff", label: "Staff", icon: UsersIcon, end: false }] : []),
  // ];

  const navItems = [
  { to: "/app", label: "Dashboard", icon: Gauge, end: true },
  { to: "/app/patients", label: "Patients", icon: UserRound, end: false },
  { to: "/app/queue", label: "Queue", icon: Ticket, end: false },
  { to: "/app/pharmacy", label: "Pharmacy", icon: Pill, end: false },
  ...(user?.role === "ORG_ADMIN" ? [{ to: "/app/staff", label: "Staff", icon: UsersIcon, end: false }] : []),
  ...(user?.role === "ORG_ADMIN" || user?.role === "Compliance Officer"
    ? [{ to: "/app/audit", label: "Audit", icon: ClipboardList, end: false }]
    : []),
];

  const handleSignOut = () => {
    const slug = getTenantSlug();
    navigate(slug ? `/org/${slug}/login` : "/login", { replace: true });
    logout();
  };

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border-subtle bg-surface-raised lg:flex">
      <div className="flex items-center gap-2.5 px-5 pb-2 pt-6">
        {org?.logoUrl ? (
          <img src={org.logoUrl} alt="" className="size-8 shrink-0 rounded-md object-cover" />
        ) : (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-brand-500 text-[13px] font-bold text-white">
            {org?.shortName?.charAt(0) ?? org?.displayName?.charAt(0) ?? "U"}
          </span>
        )}
        <div className="min-w-0 leading-tight">
          <p className="truncate text-[13.5px] font-semibold text-text-primary">
            {org?.displayName ?? "Loading…"}
          </p>
          <p className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">
            {org?.shortName ?? " "}
          </p>
        </div>
      </div>

      <nav className="mt-6 flex flex-1 flex-col gap-0.5 px-3">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              clsx(
                "group relative flex items-center gap-2.5 rounded-md px-3 py-2.5 text-[13.5px] font-medium transition-colors duration-150",
                isActive
                  ? "bg-brand-50 text-brand-700"
                  : "text-text-secondary hover:bg-surface-sunken hover:text-text-primary",
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={clsx(
                    "absolute -left-3 h-4.5 w-0.5 rounded-r bg-brand-500 transition-opacity duration-150",
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

      {user && (
        <div className="border-t border-border-subtle p-3">
          <div className="flex items-center gap-2.5 rounded-md px-2 py-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-brand-500/30 bg-brand-50 text-[11.5px] font-semibold text-brand-700">
              {initials(user.firstName, user.lastName)}
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-[13px] font-semibold text-text-primary">
                {user.firstName} {user.lastName}
              </p>
              <p className="truncate text-[12px] text-text-secondary">{user.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="mt-1 flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-[13px] font-medium text-text-secondary transition-colors duration-150 hover:bg-surface-sunken hover:text-text-primary"
          >
            <LogOut className="size-4" aria-hidden />
            Sign out
          </button>
        </div>
      )}
    </aside>
  );
}
