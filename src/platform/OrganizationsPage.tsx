import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Building2, ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import { listTenantRegister, reactivateOrganization, suspendOrganization, type TenantRegisterItem } from "@/shared/api/platform";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { Input } from "@/shared/components/Input";
import { PageHeader } from "@/shared/components/PageHeader";
import { StatusPill } from "@/shared/components/StatusPill";
import { SectorTag } from "./components/SectorTag";

const PAGE_SIZE = 25;

// SADM-US-005. The API returns aggregate counts alongside each tenant, so a
// page takes one request rather than a facilities/modules request per row.
export function OrganizationsPage() {
  const queryClient = useQueryClient();
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(0);
    }, 350);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const tenantQuery = useQuery({
    queryKey: ["platform", "tenant-register", { search, page, size: PAGE_SIZE }],
    queryFn: () => listTenantRegister({ page, size: PAGE_SIZE, name: search || undefined }),
  });

  const toggleStatus = useMutation({
    mutationFn: async (tenant: TenantRegisterItem) => {
      setActioningId(tenant.id);
      if (tenant.status === "ACTIVE") await suspendOrganization(tenant.id);
      else await reactivateOrganization(tenant.id);
    },
    onSettled: () => {
      setActioningId(null);
      queryClient.invalidateQueries({ queryKey: ["platform", "tenant-register"] });
      queryClient.invalidateQueries({ queryKey: ["platform", "organizations"] });
    },
  });

  const tenants = tenantQuery.data?.items ?? [];
  const totalItems = tenantQuery.data?.totalItems ?? 0;
  const totalPages = tenantQuery.data?.totalPages ?? 0;

  return (
    <div>
      <PageHeader
        title="Tenant register"
        description="A searchable view of every tenant across the platform."
        action={
          <Link to="/platform/organizations/new" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 text-[14px] font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-brand-600">
            <Plus className="size-4" aria-hidden />
            New tenant
          </Link>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Input label="Search tenants" placeholder="Search by tenant name…" icon={<Search className="size-4" aria-hidden />} value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
        </div>
        {!tenantQuery.isLoading && <span className="inline-flex h-11 shrink-0 items-center rounded-lg bg-surface-sunken px-3.5 text-[13px] font-medium text-text-secondary">{totalItems} tenant{totalItems === 1 ? "" : "s"}</span>}
      </div>

      <Card className="overflow-hidden p-0">
        {tenantQuery.isLoading ? (
          <p className="px-5 py-10 text-center text-[14px] text-text-secondary">Loading tenants…</p>
        ) : tenantQuery.isError ? (
          <p className="px-5 py-10 text-center text-[14px] text-danger-500">Unable to load the tenant register. Please try again.</p>
        ) : tenants.length === 0 ? (
          <p className="px-5 py-10 text-center text-[14px] text-text-secondary">{search ? "No tenants match that name." : "No tenants yet — create the first one."}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead><tr className="border-b border-border-subtle">
                <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wide text-text-secondary">Tenant</th>
                <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wide text-text-secondary">Sector</th>
                <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wide text-text-secondary">Clinics</th>
                <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wide text-text-secondary">Active modules</th>
                <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wide text-text-secondary">Status</th>
                <th className="px-5 py-3 text-right text-[12px] font-medium uppercase tracking-wide text-text-secondary">Action</th><th className="w-10 px-2 py-3" />
              </tr></thead>
              <tbody className="divide-y divide-border-subtle">
                {tenants.map((tenant) => (
                  <tr key={tenant.id} className="group transition-colors duration-150 hover:bg-surface-sunken">
                    <td className="px-5 py-3.5"><Link to={`/platform/organizations/${tenant.id}`} className="flex items-center gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><Building2 className="size-4" aria-hidden /></span><span className="truncate text-[14px] font-semibold text-text-primary">{tenant.name}</span></Link></td>
                    <td className="px-5 py-3.5"><SectorTag sector={tenant.sector} /></td>
                    <td className="px-5 py-3.5 font-mono text-[13px] text-text-secondary tabular-nums">{tenant.clinicCount}</td>
                    <td className="px-5 py-3.5 font-mono text-[13px] text-text-secondary tabular-nums">{tenant.activeModuleCount}</td>
                    <td className="px-5 py-3.5"><StatusPill tone={tenant.status === "ACTIVE" ? "success" : "danger"}>{tenant.status === "ACTIVE" ? "Active" : "Suspended"}</StatusPill></td>
                    <td className="px-5 py-3.5 text-right"><Button variant="secondary" size="md" loading={actioningId === tenant.id && toggleStatus.isPending} onClick={() => toggleStatus.mutate(tenant)}>{tenant.status === "ACTIVE" ? "Suspend" : "Reactivate"}</Button></td>
                    <td className="px-2 py-3.5"><Link to={`/platform/organizations/${tenant.id}`} className="flex size-8 items-center justify-center rounded-md text-text-secondary opacity-0 transition-opacity duration-150 group-hover:opacity-100 hover:bg-surface-raised hover:text-text-primary" aria-label={`View ${tenant.name}`}><ChevronRight className="size-4" aria-hidden /></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {totalPages > 1 && (
        <nav className="mt-4 flex items-center justify-between gap-3" aria-label="Tenant register pages">
          <p className="text-[13px] text-text-secondary">Page {page + 1} of {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="secondary" icon={<ChevronLeft className="size-4" aria-hidden />} disabled={page === 0} onClick={() => setPage((current) => current - 1)}>Previous</Button>
            <Button variant="secondary" icon={<ChevronRight className="size-4" aria-hidden />} disabled={page >= totalPages - 1} onClick={() => setPage((current) => current + 1)}>Next</Button>
          </div>
        </nav>
      )}
    </div>
  );
}
