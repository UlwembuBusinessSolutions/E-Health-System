import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Building2, ChevronDown, ChevronRight, Download, Plus, Search } from "lucide-react";
import {
  listOrganizations,
  suspendOrganization,
  reactivateOrganization,
  type OrganizationStatus,
  type OrganizationSummary,
} from "@/shared/api/platform";
import { Card } from "@/shared/components/Card";
import { Button } from "@/shared/components/Button";
import { Input } from "@/shared/components/Input";
import { PageHeader } from "@/shared/components/PageHeader";
import { StatusPill } from "@/shared/components/StatusPill";
import { SectorTag } from "./components/SectorTag";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}

// RFC 4180's one rule that actually bites here: a value containing a comma,
// quote or newline gets wrapped in quotes with internal quotes doubled.
// Everything else in a register export (names, slugs, dates) never needs
// it, but doing it unconditionally is cheaper than a "does this field need
// escaping" check on every one of them.
function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function exportOrganizationsCsv(organizations: OrganizationSummary[]): void {
  const header = ["Organization", "Slug", "Sector", "Status", "Modules enabled", "Created"];
  const rows = organizations.map((org) => [
    csvCell(org.displayName),
    csvCell(org.slug),
    csvCell(org.sector),
    csvCell(org.status === "ACTIVE" ? "Active" : "Suspended"),
    csvCell(`${org.enabledModuleCount}/${org.totalModuleCount}`),
    csvCell(formatDate(org.createdAt)),
  ]);
  const csv = [header, ...rows].map((row) => row.join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `ulwembu-organizations-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// The seller side of the product — internal only, gated by
// RequirePlatformAuth two levels up. Every client organization, searchable
// and filterable, with the one action that stands in for licensing today:
// suspend/reactivate (backend-auth-guide.html Section 3's "license off"
// switch). Admin management lives one level deeper, at the org detail page
// a row's chevron leads to — this list stays about the roster, not any one
// organization's internals.
export function OrganizationsPage() {
  const queryClient = useQueryClient();
  const [actioningId, setActioningId] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrganizationStatus | "">("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");

  useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const organizationsQuery = useQuery({
    queryKey: ["platform", "organizations", { search, statusFilter, sort }],
    queryFn: () => listOrganizations({ q: search || undefined, status: statusFilter || undefined, sort }),
  });

  const hasActiveFilters = search !== "" || statusFilter !== "";

  const toggleStatus = useMutation({
    mutationFn: async (org: OrganizationSummary) => {
      setActioningId(org.id);
      if (org.status === "ACTIVE") {
        await suspendOrganization(org.id);
      } else {
        await reactivateOrganization(org.id);
      }
    },
    onSettled: () => {
      setActioningId(null);
      queryClient.invalidateQueries({ queryKey: ["platform", "organizations"] });
    },
  });

  return (
    <div>
      <PageHeader
        title="Organizations"
        description="Every client this platform has been sold to."
        action={
          <>
            <Button
              variant="secondary"
              icon={<Download className="size-4" aria-hidden />}
              disabled={!organizationsQuery.data?.length}
              onClick={() => organizationsQuery.data && exportOrganizationsCsv(organizationsQuery.data)}
            >
              Export CSV
            </Button>
            <Link
              to="/platform/organizations/new"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 text-[14px] font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-brand-600"
            >
              <Plus className="size-4" aria-hidden />
              New organization
            </Link>
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Input
            label="Search"
            placeholder="Search by name or slug…"
            icon={<Search className="size-4" aria-hidden />}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="status-filter" className="text-[13px] font-medium text-text-primary">
            Status
          </label>
          <div className="relative">
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as OrganizationStatus | "")}
              className="h-11 w-full appearance-none rounded-lg border border-border-strong bg-surface-raised pl-3.5 pr-10 text-[15px] text-text-primary outline-none transition-colors duration-150 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 sm:w-40"
            >
              <option value="">All</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-text-secondary"
              aria-hidden
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="sort-order" className="text-[13px] font-medium text-text-primary">
            Sort
          </label>
          <div className="relative">
            <select
              id="sort-order"
              value={sort}
              onChange={(e) => setSort(e.target.value as "newest" | "oldest")}
              className="h-11 w-full appearance-none rounded-lg border border-border-strong bg-surface-raised pl-3.5 pr-10 text-[15px] text-text-primary outline-none transition-colors duration-150 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 sm:w-44"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-text-secondary"
              aria-hidden
            />
          </div>
        </div>
        {!organizationsQuery.isLoading && (
          <span className="inline-flex h-11 shrink-0 items-center rounded-lg bg-surface-sunken px-3.5 text-[13px] font-medium text-text-secondary">
            {organizationsQuery.data?.length ?? 0} organization{organizationsQuery.data?.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      <Card className="overflow-hidden p-0">
        {organizationsQuery.isLoading ? (
          <p className="px-5 py-10 text-center text-[14px] text-text-secondary">Loading organizations…</p>
        ) : organizationsQuery.data?.length === 0 ? (
          <p className="px-5 py-10 text-center text-[14px] text-text-secondary">
            {hasActiveFilters ? "No organizations match your search or filter." : "No organizations yet — create the first one."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wide text-text-secondary">
                    Organization
                  </th>
                  <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wide text-text-secondary">
                    Sector
                  </th>
                  <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wide text-text-secondary">
                    Modules
                  </th>
                  <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wide text-text-secondary">
                    Status
                  </th>
                  <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wide text-text-secondary">
                    Created
                  </th>
                  <th className="px-5 py-3 text-right text-[12px] font-medium uppercase tracking-wide text-text-secondary">
                    Action
                  </th>
                  <th className="w-10 px-2 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {organizationsQuery.data?.map((org) => (
                  <tr key={org.id} className="group transition-colors duration-150 hover:bg-surface-sunken">
                    <td className="px-5 py-3.5">
                      <Link to={`/platform/organizations/${org.id}`} className="flex items-center gap-3">
                        {org.logoUrl ? (
                          <img
                            src={org.logoUrl}
                            alt=""
                            className="size-9 shrink-0 rounded-lg border border-border-subtle object-cover"
                          />
                        ) : (
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                            <Building2 className="size-4" aria-hidden />
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-semibold text-text-primary">{org.displayName}</p>
                          <p className="truncate font-mono text-[12.5px] text-text-secondary">{org.slug}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-5 py-3.5">
                      <SectorTag sector={org.sector} />
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-sunken">
                          <div
                            className="h-full rounded-full bg-brand-500"
                            style={{ width: `${(org.enabledModuleCount / org.totalModuleCount) * 100}%` }}
                          />
                        </div>
                        <span className="font-mono text-[12.5px] text-text-secondary tabular-nums">
                          {org.enabledModuleCount}/{org.totalModuleCount}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusPill tone={org.status === "ACTIVE" ? "success" : "danger"}>
                        {org.status === "ACTIVE" ? "Active" : "Suspended"}
                      </StatusPill>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[13px] text-text-secondary tabular-nums">
                      {formatDate(org.createdAt)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Button
                        variant="secondary"
                        size="md"
                        loading={actioningId === org.id && toggleStatus.isPending}
                        onClick={() => toggleStatus.mutate(org)}
                      >
                        {org.status === "ACTIVE" ? "Suspend" : "Reactivate"}
                      </Button>
                    </td>
                    <td className="px-2 py-3.5">
                      <Link
                        to={`/platform/organizations/${org.id}`}
                        className="flex size-8 items-center justify-center rounded-md text-text-secondary opacity-0 transition-opacity duration-150 group-hover:opacity-100 hover:bg-surface-raised hover:text-text-primary"
                        aria-label={`View ${org.displayName}`}
                      >
                        <ChevronRight className="size-4" aria-hidden />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
