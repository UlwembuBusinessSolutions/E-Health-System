import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Activity, Building2, Hospital, Users, type LucideIcon } from "lucide-react";
import { getPlatformDashboard } from "@/shared/api/platform";
import { usePlatformAuth } from "./PlatformAuthContext";

const shortDate = (iso: string) => new Date(iso).toLocaleString("en-ZA", {
  year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
});

export function OverviewPage() {
  const { operator } = usePlatformAuth();
  const query = useQuery({
    queryKey: ["platform", "dashboard"],
    queryFn: getPlatformDashboard,
    staleTime: 30_000,
  });
  const data = query.data;

  return (
    <div className="space-y-5 pb-8">
      <header className="mb-1 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-text-primary">Platform Dashboard</h1>
          <p className="mt-1 text-[14px] text-text-secondary">Super Admin operational view across the whole Ulwembu platform{operator ? ` · ${operator.firstName} ${operator.lastName}` : ""}.</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${data?.systemHealth.status === "HEALTHY" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
            {data?.systemHealth.status === "HEALTHY" ? "All systems operational" : "System status"}
          </span>
          <Link to="/platform/organizations" className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800">+ Manage clinics</Link>
        </div>
      </header>

      {query.isError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">Dashboard data could not be loaded. Check your connection and refresh.</div>}
      {query.isLoading && <div className="rounded-xl border border-border-subtle bg-white p-6 text-sm text-text-secondary">Loading platform metrics…</div>}
      {data && <>
        <section aria-label="Platform totals" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric icon={Building2} label="Active tenants" value={data.summary.activeTenants} caption="Currently enabled organisations" />
          <Metric icon={Hospital} label="Active clinics" value={data.summary.clinics} caption="Across active tenants" />
          <Metric icon={Users} label="Active admins" value={data.summary.activeOrganizationAdmins} caption="Enabled organization admin accounts" />
          <Metric icon={Activity} label="Module adoption" value={`${data.summary.modulesEnabled}/${data.summary.totalModules}`} caption="Average enabled modules per active tenant" />
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.7fr_1fr]">
          <div className="overflow-hidden rounded-xl border border-border-subtle bg-white">
            <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
              <h2 className="font-semibold text-text-primary">Module adoption by tenant</h2>
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">Tenant comparison</span>
            </div>
            <div className="space-y-5 p-5">
              <p className="text-xs text-text-secondary">See which modules each active tenant has enabled. Foundation modules remain available platform-wide.</p>
              {data.tenants.map((tenant, index) => {
                const modules = tenant.enabledModuleCodes;
                return <div key={tenant.id} className={index > 0 ? "border-t border-border-subtle pt-4" : ""}>
                  <div className="mb-1 flex items-baseline justify-between gap-4">
                    <div><h3 className="font-semibold text-text-primary">{tenant.name}</h3><p className="text-xs text-text-secondary">Platform tenant · {tenant.sector.toLowerCase()}</p></div>
                    <span className="shrink-0 text-sm font-semibold">{tenant.modulesEnabled}/{tenant.totalModules} modules</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-teal-600" style={{ width: `${Math.min(100, tenant.modulesEnabled / Math.max(1, tenant.totalModules) * 100)}%` }} /></div>
                  <div className="mt-2 flex flex-wrap gap-1.5" aria-label={`Enabled modules for ${tenant.name}`}>
                    {modules.slice(0, 8).map((code) => <span key={code} className="rounded-full border border-border-subtle bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-text-secondary">{code}</span>)}
                    {tenant.modulesEnabled > 8 && <span className="rounded-full border border-border-subtle bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-text-secondary">+{tenant.modulesEnabled - 8} more</span>}
                  </div>
                </div>;
              })}
              {data.tenants.length === 0 && <p className="py-4 text-sm text-text-secondary">No tenants available.</p>}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border-subtle bg-white">
            <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
              <h2 className="font-semibold text-text-primary">System health</h2>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${data.systemHealth.status === "HEALTHY" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{data.systemHealth.status === "HEALTHY" ? "Healthy" : data.systemHealth.status}</span>
            </div>
            <div className="divide-y divide-border-subtle px-5">
              {data.systemHealth.services.map((service) => <div key={service.name} className="flex items-center justify-between py-3"><div><h3 className="text-sm font-semibold text-text-primary">{service.name}</h3><p className="text-xs text-text-secondary">Operational · prototype indicator</p></div><span className="text-sm font-semibold">{service.availability}%</span></div>)}
            </div>
            <div className="m-4 rounded-lg border border-teal-100 bg-teal-50/60 p-3"><h3 className="text-xs font-semibold text-text-primary">Performance acceptance target</h3><p className="mt-1 text-xs leading-relaxed text-text-secondary">Dashboard UI target is under 5 seconds under normal load. Aggregation, caching and performance testing are implementation follow up.</p></div>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-border-subtle bg-white">
          <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4"><h2 className="font-semibold text-text-primary">Tenant adoption overview</h2><Link to="/platform/organizations" className="rounded-md border border-border-strong px-3 py-2 text-xs font-semibold text-text-primary hover:bg-surface-sunken">Manage clinics</Link></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[740px] text-left text-xs"><thead className="border-b border-border-subtle text-[10px] uppercase tracking-wide text-text-secondary"><tr>{["Tenant", "Status", "Clinics", "Active admins", "Modules", "Action"].map((label) => <th key={label} className="px-5 py-3 font-semibold">{label}</th>)}</tr></thead><tbody className="divide-y divide-border-subtle">{data.tenants.map((tenant) => <tr key={tenant.id} className="hover:bg-slate-50"><td className="px-5 py-3"><Link to={`/platform/organizations/${tenant.id}`} className="font-semibold text-text-primary hover:text-teal-700">{tenant.name}</Link><p className="text-[10px] text-text-secondary">{tenant.sector.toLowerCase()}</p></td><td className="px-5 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${tenant.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{tenant.status === "ACTIVE" ? "Active" : "Suspended"}</span></td><td className="px-5 py-3">{tenant.clinics}</td><td className="px-5 py-3">{tenant.activeAdmins}</td><td className="px-5 py-3">{tenant.modulesEnabled}/{tenant.totalModules}</td><td className="px-5 py-3"><Link to={`/platform/organizations/${tenant.id}`} className="rounded-md border border-border-strong px-3 py-1.5 font-semibold text-text-primary hover:bg-surface-sunken">View clinics</Link></td></tr>)}</tbody></table></div>
        </section>

        <section className="overflow-hidden rounded-xl border border-border-subtle bg-white">
          <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4"><h2 className="font-semibold text-text-primary">Recent platform activity</h2><Link to="/platform/audit" className="rounded-md border border-border-strong px-3 py-2 text-xs font-semibold text-text-primary hover:bg-surface-sunken">View audit</Link></div>
          <div className="divide-y divide-border-subtle">{data.recentActivity.map((event) => <div key={event.id} className="flex items-start justify-between gap-4 px-5 py-3"><div><p className="text-xs font-semibold text-text-primary">{event.action.replaceAll("_", " ")}</p><p className="mt-0.5 text-xs text-text-secondary">{event.detail || "Platform activity"}{event.organizationName ? ` · ${event.organizationName}` : ""}</p></div><time className="shrink-0 text-[10px] text-text-secondary">{shortDate(event.createdAt)}</time></div>)}{data.recentActivity.length === 0 && <p className="px-5 py-6 text-sm text-text-secondary">No recent platform activity.</p>}</div>
        </section>
      </>}
    </div>
  );
}

function Metric({ icon: Icon, label, value, caption }: { icon: LucideIcon; label: string; value: string | number; caption: string }) {
  return <div className="rounded-xl border border-border-subtle bg-white p-4 shadow-sm"><div className="mb-3 flex size-9 items-center justify-center rounded-lg border border-border-subtle bg-slate-50 text-teal-700"><Icon className="size-4" aria-hidden /></div><p className="text-2xl font-bold text-text-primary">{value}</p><p className="text-xs text-text-secondary">{label}</p><p className="mt-1 text-[10px] text-teal-700">{caption}</p></div>;
}
