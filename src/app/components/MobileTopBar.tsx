import { NavLink, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { Gauge, LogOut, Pill, Stethoscope, Ticket, UserRound, Users as UsersIcon } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { getTenantSlug } from "@/shared/api/auth";
import { getOrganizationSelf } from "@/shared/api/organization";

// Sidebar.tsx's own nav, laid out horizontally — under lg the permanent
// rail hides entirely, same split as the Platform Console's equivalent.
export function MobileTopBar() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const orgQuery = useQuery({ queryKey: ["organization", "self"], queryFn: getOrganizationSelf });
  const org = orgQuery.data;

  const navItems = [
    { to: "/app", label: "Dashboard", icon: Gauge, end: true },
    { to: "/app/patients", label: "Patients", icon: UserRound, end: false },
    { to: "/app/queue", label: "Queue", icon: Ticket, end: false },
    { to: "/app/triage", label: "Triage", icon: Stethoscope, end: false },
    { to: "/app/pharmacy", label: "Pharmacy", icon: Pill, end: false },
    ...(user?.role === "ORG_ADMIN" ? [{ to: "/app/staff", label: "Staff", icon: UsersIcon, end: false }] : []),
  ];

  // navigate() before logout() — see Sidebar.tsx's own why-note on why the
  // order matters here.
  const handleSignOut = () => {
    const slug = getTenantSlug();
    navigate(slug ? `/org/${slug}/login` : "/login", { replace: true });
    logout();
  };

  return (
    <div className="sticky top-0 z-10 border-b border-border-subtle bg-surface-raised lg:hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          {org?.logoUrl ? (
            <img src={org.logoUrl} alt="" className="size-7 shrink-0 rounded-md object-cover" />
          ) : (
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-brand-500 text-[12px] font-bold text-white">
              {org?.shortName?.charAt(0) ?? org?.displayName?.charAt(0) ?? "U"}
            </span>
          )}
          <p className="truncate text-[13px] font-semibold text-text-primary">{org?.displayName ?? "Loading…"}</p>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[12.5px] font-medium text-text-secondary hover:bg-surface-sunken hover:text-text-primary"
        >
          <LogOut className="size-3.5" aria-hidden />
          Sign out
        </button>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              clsx(
                "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors duration-150",
                isActive ? "bg-brand-50 text-brand-700" : "text-text-secondary",
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
