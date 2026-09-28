import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Building2, PauseCircle, Plus, ShieldCheck, UserPlus, Users as UsersIcon } from "lucide-react";
import { listOrganizations, listPlatformOperators } from "@/shared/api/platform";
import { Card } from "@/shared/components/Card";
import { PageHeader } from "@/shared/components/PageHeader";
import { StatCard } from "@/shared/components/StatCard";
import { StatusPill } from "@/shared/components/StatusPill";
import { usePlatformAuth } from "./PlatformAuthContext";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}

function formatRelative(iso: string | null): string {
  if (!iso) return "Never signed in";
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diffMs / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return formatDate(iso);
}

// The landing screen after sign-in — a glance at platform health before
// drilling into either roster. Both queries below reuse the exact same
// cache keys OrganizationsPage/UsersPage use (["platform", "organizations"],
// ["platform", "operators"]), so navigating from here into either list
// doesn't re-fetch data this page already has warm.
export function OverviewPage() {
  const { operator } = usePlatformAuth();

  const organizationsQuery = useQuery({
    queryKey: ["platform", "organizations", { search: "", statusFilter: "", sort: "newest" as const }],
    queryFn: () => listOrganizations({ sort: "newest" }),
  });

  const operatorsQuery = useQuery({
    queryKey: ["platform", "operators"],
    queryFn: listPlatformOperators,
  });

  const organizations = organizationsQuery.data ?? [];
  const operators = operatorsQuery.data ?? [];
  const activeCount = organizations.filter((o) => o.status === "ACTIVE").length;
  const suspendedCount = organizations.length - activeCount;

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${operator?.firstName ?? "there"}`}
        description="Everything this platform has been sold to, and everyone with the keys to sell it."
        action={
          <>
            <Link
              to="/platform/users/new"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border-strong bg-surface-raised px-4 text-[14px] font-semibold text-text-primary transition-colors duration-150 hover:bg-surface-sunken"
            >
              <UserPlus className="size-4" aria-hidden />
              New operator
            </Link>
            <Link
              to="/platform/organizations/new"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 text-[14px] font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-brand-600"
            >
              <Plus className="size-4" aria-hidden />
              New tenant
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Organizations" value={organizations.length} icon={Building2} />
        <StatCard label="Active" value={activeCount} icon={ShieldCheck} />
        <StatCard label="Suspended" value={suspendedCount} icon={PauseCircle} />
        <StatCard label="Platform operators" value={operators.length} icon={UsersIcon} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-0">
          <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
            <h2 className="text-[14.5px] font-semibold text-text-primary">Recent organizations</h2>
            <Link to="/platform/organizations" className="text-[13px] font-medium text-brand-600 hover:text-brand-700">
              View all
            </Link>
          </div>
          <div className="divide-y divide-border-subtle">
            {organizationsQuery.isLoading && (
              <p className="px-5 py-6 text-center text-[13.5px] text-text-secondary">Loading…</p>
            )}
            {organizations.length === 0 && !organizationsQuery.isLoading && (
              <p className="px-5 py-6 text-center text-[13.5px] text-text-secondary">No organizations yet.</p>
            )}
            {organizations.slice(0, 5).map((org) => (
              <Link
                key={org.id}
                to={`/platform/organizations/${org.id}`}
                className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors duration-150 hover:bg-surface-sunken"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-medium text-text-primary">{org.displayName}</p>
                  <p className="font-mono text-[12px] text-text-secondary">{org.slug}</p>
                </div>
                <StatusPill tone={org.status === "ACTIVE" ? "success" : "danger"}>
                  {org.status === "ACTIVE" ? "Active" : "Suspended"}
                </StatusPill>
              </Link>
            ))}
          </div>
        </Card>

        <Card className="p-0">
          <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
            <h2 className="text-[14.5px] font-semibold text-text-primary">Platform operators</h2>
            <Link to="/platform/users" className="text-[13px] font-medium text-brand-600 hover:text-brand-700">
              View all
            </Link>
          </div>
          <div className="divide-y divide-border-subtle">
            {operatorsQuery.isLoading && (
              <p className="px-5 py-6 text-center text-[13.5px] text-text-secondary">Loading…</p>
            )}
            {operators.length === 0 && !operatorsQuery.isLoading && (
              <p className="px-5 py-6 text-center text-[13.5px] text-text-secondary">No operators yet.</p>
            )}
            {operators.slice(0, 5).map((op) => (
              <div key={op.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-medium text-text-primary">
                    {op.firstName} {op.lastName}
                  </p>
                  <p className="truncate text-[12px] text-text-secondary">{formatRelative(op.lastLoginAt)}</p>
                </div>
                <StatusPill
                  tone={op.status === "ACTIVE" ? "success" : op.status === "LOCKED" ? "warning" : "neutral"}
                >
                  {op.status === "ACTIVE" ? "Active" : op.status === "LOCKED" ? "Locked" : "Disabled"}
                </StatusPill>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
