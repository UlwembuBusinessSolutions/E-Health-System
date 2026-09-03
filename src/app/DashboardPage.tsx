import { useRef, type ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Camera, LayoutGrid, ShieldCheck, UserPlus, Users as UsersIcon } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { getOrganizationSelf, getOrganizationModules, uploadOrganizationLogo } from "@/shared/api/organization";
import { listStaff } from "@/shared/api/staff";
import { Card } from "@/shared/components/Card";
import { Button } from "@/shared/components/Button";
import { StatCard } from "@/shared/components/StatCard";
import { StatusPill } from "@/shared/components/StatusPill";
import { PageHeader } from "@/shared/components/PageHeader";

function sectorLabel(sector: string): string {
  return sector.charAt(0) + sector.slice(1).toLowerCase();
}

// The real dashboard DashboardPlaceholder.tsx stood in for — same
// "prove login -> session -> protected route works" role that placeholder
// filled, now backed by real org and module data instead of just an email
// and a logout button. Structure adapted from the eHealth Prototype's own
// tenantDashboard() (stat row + enabled-modules card), minus the "Clinics"
// stat/card the prototype has: this app's schema-per-org tenancy has no
// clinic sub-entity to count, unlike the prototype's tenant-with-clinics
// model.
export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isOrgAdmin = user?.role === "ORG_ADMIN";

  const orgQuery = useQuery({ queryKey: ["organization", "self"], queryFn: getOrganizationSelf });
  const modulesQuery = useQuery({ queryKey: ["organization", "modules"], queryFn: getOrganizationModules });
  // ORG_ADMIN-only server-side (StaffController.list()) — disabled for
  // everyone else so this doesn't fire a request that can only ever 403.
  const staffQuery = useQuery({ queryKey: ["staff", "list"], queryFn: listStaff, enabled: isOrgAdmin });

  const logoMutation = useMutation({
    mutationFn: uploadOrganizationLogo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization", "self"] });
    },
  });

  const handleLogoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) logoMutation.mutate(file);
  };

  const org = orgQuery.data;
  const modules = modulesQuery.data ?? [];
  const enabledModules = modules.filter((m) => m.enabled);

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${user?.firstName ?? "there"}`}
        description={org ? `${org.displayName} is ${org.status === "ACTIVE" ? "active" : "suspended"}.` : " "}
        action={
          isOrgAdmin && (
            <Button icon={<UserPlus className="size-4" aria-hidden />} onClick={() => navigate("/app/staff/new")}>
              Add staff member
            </Button>
          )
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {isOrgAdmin && (
          <StatCard
            label="Staff"
            value={staffQuery.data?.length ?? "—"}
            icon={UsersIcon}
            hint="Accounts in your organization"
          />
        )}
        <StatCard
          label="Active modules"
          value={modules.length ? `${enabledModules.length}/${modules.length}` : "—"}
          icon={LayoutGrid}
          hint="Entitlements set by the platform team"
        />
        <StatCard
          label="Status"
          value={org ? (org.status === "ACTIVE" ? "Active" : "Suspended") : "—"}
          icon={ShieldCheck}
          hint={org ? sectorLabel(org.sector) + " sector" : undefined}
        />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden p-0">
          <div className="border-b border-border-subtle px-5 py-4">
            <h2 className="text-[14.5px] font-semibold text-text-primary">Enabled modules</h2>
            <p className="text-[12.5px] text-text-secondary">
              {enabledModules.length} of {modules.length || 20} switched on for your organization
            </p>
          </div>
          <div className="divide-y divide-border-subtle">
            {modulesQuery.isLoading ? (
              <p className="px-5 py-8 text-center text-[13.5px] text-text-secondary">Loading…</p>
            ) : enabledModules.length === 0 ? (
              <p className="px-5 py-8 text-center text-[13.5px] text-text-secondary">No modules enabled yet.</p>
            ) : (
              enabledModules.map((mod) => (
                <div key={mod.code} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="shrink-0 rounded bg-brand-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-brand-700">
                      {mod.code}
                    </span>
                    <span className="truncate text-[13px] text-text-primary">{mod.displayName}</span>
                  </div>
                  <StatusPill tone="success">On</StatusPill>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-[14.5px] font-semibold text-text-primary">Your organization</h2>
          <div className="mt-4 flex items-center gap-4">
            <button
              type="button"
              onClick={() => isOrgAdmin && fileInputRef.current?.click()}
              disabled={!isOrgAdmin || logoMutation.isPending}
              className="group relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border-subtle bg-surface-sunken text-text-secondary disabled:cursor-default"
              aria-label={isOrgAdmin ? "Upload organization logo" : undefined}
              title={isOrgAdmin ? "Upload logo" : undefined}
            >
              {org?.logoUrl ? (
                <img src={org.logoUrl} alt="" className="size-full object-cover" />
              ) : (
                <span className="text-[16px] font-bold">{org?.shortName?.charAt(0) ?? "?"}</span>
              )}
              {isOrgAdmin && (
                <span className="absolute inset-0 flex items-center justify-center bg-ink-900/0 text-white opacity-0 transition-all duration-150 group-hover:bg-ink-900/50 group-hover:opacity-100">
                  <Camera className="size-4" aria-hidden />
                </span>
              )}
            </button>
            {isOrgAdmin && (
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleLogoChange}
              />
            )}
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold text-text-primary">{org?.displayName ?? "—"}</p>
              <p className="font-mono text-[12.5px] text-text-secondary">{org?.slug ?? " "}</p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-4 border-t border-border-subtle pt-5">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-text-secondary">Sector</p>
              <p className="mt-1 text-[13.5px] text-text-primary">{org ? sectorLabel(org.sector) : "—"}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-text-secondary">Your role</p>
              <p className="mt-1 text-[13.5px] text-text-primary">{user?.role === "ORG_ADMIN" ? "Administrator" : (user?.role ?? "—")}</p>
            </div>
          </div>

          {logoMutation.isError && (
            <p role="alert" className="mt-3 text-[12.5px] text-danger-600">
              {logoMutation.error instanceof Error ? logoMutation.error.message : "Couldn't upload that logo."}
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
