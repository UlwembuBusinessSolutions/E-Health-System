import { useRef, type ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Camera, Hospital, LayoutGrid, ShieldCheck, UserPlus, Users } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { getOrganizationSelf, getOrganizationModules, uploadOrganizationLogo } from "@/shared/api/organization";
import { getManagedFacilities } from "@/shared/api/facilities";
import { listStaff } from "@/shared/api/staff";
import { listTenantAudit } from "@/shared/api/audit";
import type { LucideIcon } from "lucide-react";

function sectorLabel(sector: string): string {
  return sector.charAt(0) + sector.slice(1).toLowerCase();
}

function dateTime(value: string): string {
  return new Date(value).toLocaleString("en-ZA", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isOrgAdmin = user?.role === "ORG_ADMIN";

  const orgQuery = useQuery({ queryKey: ["organization", "self"], queryFn: getOrganizationSelf });
  const modulesQuery = useQuery({ queryKey: ["organization", "modules"], queryFn: getOrganizationModules });
  const facilitiesQuery = useQuery({ queryKey: ["facilities", "managed"], queryFn: getManagedFacilities, enabled: isOrgAdmin });
  const staffQuery = useQuery({ queryKey: ["staff", "list"], queryFn: listStaff, enabled: isOrgAdmin });
  const auditQuery = useQuery({ queryKey: ["audit", "tenant", { page: 0, size: 8 }], queryFn: () => listTenantAudit({ page: 0, size: 8 }), enabled: isOrgAdmin });

  const logoMutation = useMutation({
    mutationFn: uploadOrganizationLogo,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organization", "self"] }),
  });
  const handleLogoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) logoMutation.mutate(file);
  };

  const org = orgQuery.data;
  const modules = modulesQuery.data ?? [];
  const enabledModules = modules.filter((module) => module.enabled);
  const facilities = facilitiesQuery.data ?? [];
  const staff = staffQuery.data ?? [];
  const activeStaff = staff.filter((person) => person.status === "ACTIVE");
  const activeFacilities = facilities.filter((facility) => facility.active);
  const services = [
    { name: "Organization profile", ready: !orgQuery.isError },
    { name: "Module entitlements", ready: !modulesQuery.isError },
    { name: "Staff directory", ready: !isOrgAdmin || !staffQuery.isError },
    { name: "Facility directory", ready: !isOrgAdmin || !facilitiesQuery.isError },
  ];
  const healthy = services.every((service) => service.ready);

  return (
    <div className="space-y-5 pb-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-text-primary">Organisation dashboard</h1>
          <p className="mt-1 text-[14px] text-text-secondary">{org ? `${org.displayName} operational overview.` : "Your organisation operational overview."}</p>
        </div>
        {isOrgAdmin && <button type="button" onClick={() => navigate("/app/staff/new")} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-600"><UserPlus className="size-4" aria-hidden />Add staff member</button>}
      </header>

      <section aria-label="Organisation totals" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Hospital} label="Active facilities" value={isOrgAdmin ? (facilitiesQuery.isLoading ? "—" : activeFacilities.length) : "—"} caption="Facilities in your organisation" />
        <Metric icon={Users} label="Active staff" value={isOrgAdmin ? (staffQuery.isLoading ? "—" : activeStaff.length) : "—"} caption="Enabled staff accounts" />
        <Metric icon={LayoutGrid} label="Module adoption" value={modules.length ? `${enabledModules.length}/${modules.length}` : "—"} caption="Modules enabled for your organisation" />
        <Metric icon={ShieldCheck} label="Organisation status" value={org ? (org.status === "ACTIVE" ? "Active" : "Suspended") : "—"} caption={org ? `${sectorLabel(org.sector)} sector` : "Current status"} />
      </section>

      {(orgQuery.isError || modulesQuery.isError || facilitiesQuery.isError || staffQuery.isError) && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">Some organisation dashboard data could not be loaded. Refresh the page or check your connection.</div>}

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.7fr_1fr]">
        <div className="overflow-hidden rounded-xl border border-border-subtle bg-white">
          <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4"><div><h2 className="font-semibold text-text-primary">Module adoption</h2><p className="mt-0.5 text-xs text-text-secondary">{enabledModules.length} of {modules.length || 20} modules enabled for your organisation</p></div><Link to="/app/settings" className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">Manage modules</Link></div>
          <div className="space-y-4 p-5">
            {modulesQuery.isLoading ? <p className="text-sm text-text-secondary">Loading modules…</p> : modules.map((module, index) => <div key={module.code} className={index ? "border-t border-border-subtle pt-4" : ""}>
              <div className="mb-1 flex items-baseline justify-between gap-4"><div><h3 className="font-semibold text-text-primary">{module.displayName}</h3><p className="text-xs text-text-secondary">{module.code} · {module.foundation ? "Foundation module" : module.phase.replaceAll("_", " ")}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${module.enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{module.enabled ? "On" : "Off"}</span></div>
              </div>)}
            {!modulesQuery.isLoading && modules.length === 0 && <p className="text-sm text-text-secondary">No module information is available.</p>}
            {modules.length > 0 && <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-teal-600" style={{ width: `${Math.min(100, enabledModules.length / modules.length * 100)}%` }} /></div>}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border-subtle bg-white">
          <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4"><h2 className="font-semibold text-text-primary">Organisation health</h2><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${healthy ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{healthy ? "Healthy" : "Needs attention"}</span></div>
          <div className="divide-y divide-border-subtle px-5">{services.map((service) => <div key={service.name} className="flex items-center justify-between py-3"><div><h3 className="text-sm font-semibold text-text-primary">{service.name}</h3><p className="text-xs text-text-secondary">{service.ready ? "Connected" : "Unable to load"}</p></div><span className={`text-xs font-semibold ${service.ready ? "text-emerald-700" : "text-red-700"}`}>{service.ready ? "Ready" : "Error"}</span></div>)}</div>
          <div className="m-4 rounded-lg border border-teal-100 bg-teal-50/60 p-3"><h3 className="text-xs font-semibold text-text-primary">Your organisation</h3><div className="mt-3 flex items-center gap-3"><button type="button" onClick={() => isOrgAdmin && fileInputRef.current?.click()} disabled={!isOrgAdmin || logoMutation.isPending} className="group relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border-subtle bg-white text-text-secondary" aria-label="Upload organisation logo" title="Upload logo">{org?.logoUrl ? <img src={org.logoUrl} alt="" className="size-full object-cover" /> : <span className="text-sm font-bold">{org?.shortName?.charAt(0) ?? "?"}</span>}<span className="absolute inset-0 flex items-center justify-center bg-ink-900/0 text-white opacity-0 transition-all group-hover:bg-ink-900/50 group-hover:opacity-100"><Camera className="size-4" aria-hidden /></span></button><input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleLogoChange} /><div className="min-w-0"><p className="truncate text-sm font-semibold text-text-primary">{org?.displayName ?? "—"}</p><p className="truncate font-mono text-xs text-text-secondary">{org?.slug}</p></div></div><div className="mt-3 grid grid-cols-2 gap-3 border-t border-teal-100 pt-3 text-xs"><div><span className="text-text-secondary">Sector</span><p className="mt-1 text-text-primary">{org ? sectorLabel(org.sector) : "—"}</p></div><div><span className="text-text-secondary">Your role</span><p className="mt-1 text-text-primary">Administrator</p></div></div>{logoMutation.isError && <p role="alert" className="mt-2 text-xs text-danger-600">Couldn't upload that logo. Please try again.</p>}</div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-border-subtle bg-white">
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4"><h2 className="font-semibold text-text-primary">Facility overview</h2><Link to="/app/settings" className="rounded-md border border-border-strong px-3 py-2 text-xs font-semibold text-text-primary hover:bg-surface-sunken">Manage facilities</Link></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-xs"><thead className="border-b border-border-subtle text-[10px] uppercase tracking-wide text-text-secondary"><tr>{["Facility", "Code", "Type", "Status"].map((label) => <th key={label} className="px-5 py-3 font-semibold">{label}</th>)}</tr></thead><tbody className="divide-y divide-border-subtle">{activeFacilities.map((facility) => <tr key={facility.id}><td className="px-5 py-3 font-semibold text-text-primary">{facility.name}</td><td className="px-5 py-3 font-mono">{facility.code}</td><td className="px-5 py-3">{facility.type.toLowerCase()}</td><td className="px-5 py-3"><span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">Active</span></td></tr>)}</tbody></table>{facilitiesQuery.isLoading && <p className="px-5 py-6 text-sm text-text-secondary">Loading facilities…</p>}{!facilitiesQuery.isLoading && activeFacilities.length === 0 && <p className="px-5 py-6 text-sm text-text-secondary">No active facilities are available.</p>}</div>
      </section>

      <section className="overflow-hidden rounded-xl border border-border-subtle bg-white">
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4"><h2 className="font-semibold text-text-primary">Recent organisation activity</h2><Link to="/app/audit" className="rounded-md border border-border-strong px-3 py-2 text-xs font-semibold text-text-primary hover:bg-surface-sunken">View audit</Link></div>
        <div className="divide-y divide-border-subtle">{auditQuery.data?.items.map((event) => <div key={event.id} className="flex items-start justify-between gap-4 px-5 py-3"><div><p className="text-xs font-semibold text-text-primary">{event.action.replaceAll("_", " ")}</p><p className="mt-0.5 text-xs text-text-secondary">{event.actorName} · {event.entityType}</p></div><time className="shrink-0 text-[10px] text-text-secondary">{dateTime(event.createdAt)}</time></div>)}{auditQuery.isLoading && <p className="px-5 py-6 text-sm text-text-secondary">Loading activity…</p>}{!auditQuery.isLoading && auditQuery.data?.items.length === 0 && <p className="px-5 py-6 text-sm text-text-secondary">No recent organisation activity.</p>}</div>
      </section>
    </div>
  );
}

function Metric({ icon: Icon, label, value, caption }: { icon: LucideIcon; label: string; value: string | number; caption: string }) {
  return <div className="rounded-xl border border-border-subtle bg-white p-4 shadow-sm"><div className="mb-3 flex size-9 items-center justify-center rounded-lg border border-border-subtle bg-slate-50 text-teal-700"><Icon className="size-4" aria-hidden /></div><p className="text-2xl font-bold text-text-primary">{value}</p><p className="text-xs text-text-secondary">{label}</p><p className="mt-1 text-[10px] text-teal-700">{caption}</p></div>;
}
