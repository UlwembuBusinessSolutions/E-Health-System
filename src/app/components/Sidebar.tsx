import { NavLink, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import {
  ClipboardList,
  Gauge,
  LogOut,
  Package,
  Pill,
  Ticket,
  UserRound,
  Users as UsersIcon,
} from "lucide-react";

import { useAuth } from "@/auth/AuthContext";
import { getTenantSlug } from "@/shared/api/auth";
import { getOrganizationSelf } from "@/shared/api/organization";

export function Sidebar() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const orgQuery = useQuery({
    queryKey: ["organization", "self"],
    queryFn: getOrganizationSelf,
  });

  const org = orgQuery.data;

  const navItems = [
    {
      to: "/app",
      label: "Dashboard",
      icon: Gauge,
      end: true,
    },
    {
      to: "/app/patients",
      label: "Patients",
      icon: UserRound,
      end: false,
    },
    {
      to: "/app/queue",
      label: "Queue",
      icon: Ticket,
      end: false,
    },
    {
      to: "/app/pharmacy",
      label: "Pharmacy",
      icon: Pill,
      end: false,
    },
    {
      to: "/app/pharmacy",
      label: "Stock",
      icon: Package,
      end: false,
    },
    ...(user?.role === "ORG_ADMIN"
      ? [
          {
            to: "/app/staff",
            label: "Staff",
            icon: UsersIcon,
            end: false,
          },
        ]
      : []),
    ...(user?.role === "ORG_ADMIN" ||
    user?.role === "Compliance Officer"
      ? [
          {
            to: "/app/audit",
            label: "Audit",
            icon: ClipboardList,
            end: false,
          },
        ]
      : []),
  ];

  const handleSignOut = () => {
    const slug = getTenantSlug();

    navigate(
      slug ? `/org/${slug}/login` : "/login",
      { replace: true },
    );

    logout();
  };

  return (
    <aside className="hidden h-screen w-64 shrink-0 flex-col border-r border-border-subtle bg-surface-raised lg:flex">
      <div className="flex min-h-16 items-center border-b border-border-subtle px-5">
        <div className="flex min-w-0 items-center gap-3">
          {org?.logoUrl ? (
            <img
              src={org.logoUrl}
              alt=""
              className="size-8 shrink-0 rounded-md object-cover"
            />
          ) : (
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-brand-500 text-[13px] font-bold text-white">
              {org?.shortName?.charAt(0) ??
                org?.displayName?.charAt(0) ??
                "U"}
            </span>
          )}

          <p className="truncate text-[13.5px] font-semibold text-text-primary">
            {org?.displayName ?? "Loading…"}
          </p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-1">
          {navItems.map(
            ({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  clsx(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors duration-150",
                    isActive
                      ? "bg-brand-50 text-brand-700"
                      : "text-text-secondary hover:bg-surface-sunken hover:text-text-primary",
                  )
                }
              >
                <Icon
                  className="size-4 shrink-0"
                  aria-hidden
                />

                <span>{label}</span>
              </NavLink>
            ),
          )}
        </div>
      </nav>

      <div className="border-t border-border-subtle p-3">
        <button
          type="button"
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium text-text-secondary transition-colors hover:bg-surface-sunken hover:text-text-primary"
        >
          <LogOut className="size-4" aria-hidden />
          Sign out
        </button>
      </div>
    </aside>
  );
}