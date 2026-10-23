import { useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Minus, RefreshCw } from "lucide-react";
import { listOrganizationModules, listOrganizations, toggleOrganizationModule, type ModuleEntitlement } from "@/shared/api/platform";
import { ApiError } from "@/shared/api/client";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { PageHeader } from "@/shared/components/PageHeader";

const PHASE_LABELS: Record<ModuleEntitlement["phase"], string> = {
  FOUNDATION: "Foundation",
  MVP0: "MVP0",
  PHASE_2: "Phase 2",
  PHASE_3: "Phase 3",
  PHASE_4: "Phase 4",
};

interface PendingToggle {
  organizationId: string;
  organizationName: string;
  module: ModuleEntitlement;
}

export function ModuleEntitlementMatrixPage() {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<PendingToggle | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  const organizationsQuery = useQuery({
    queryKey: ["platform", "organizations", "entitlement-matrix"],
    queryFn: () => listOrganizations({ sort: "newest" }),
  });
  const organizations = organizationsQuery.data ?? [];

  const moduleQueries = useQueries({
    queries: organizations.map((organization) => ({
      queryKey: ["platform", "organizations", organization.id, "modules"],
      queryFn: () => listOrganizationModules(organization.id),
    })),
  });

  const modulesByOrganization = Object.fromEntries(
    organizations.map((organization, index) => [organization.id, moduleQueries[index]?.data ?? []]),
  );
  const moduleColumns = moduleQueries.find((query) => query.data?.length)?.data ?? [];
  const isLoadingModules = moduleQueries.some((query) => query.isLoading);
  const moduleError = moduleQueries.find((query) => query.error)?.error;

  const toggleModule = useMutation({
    mutationFn: ({ organizationId, module }: PendingToggle) =>
      toggleOrganizationModule(organizationId, module.code, !module.enabled),
    onMutate: () => setPageError(null),
    onSuccess: (_data, variables) => {
      setPending(null);
      queryClient.invalidateQueries({
        queryKey: ["platform", "organizations", variables.organizationId, "modules"],
      });
      queryClient.invalidateQueries({ queryKey: ["platform", "organizations"] });
    },
    onError: (error) => {
      setPageError(error instanceof ApiError ? error.message : "Could not update that entitlement. Nothing changed.");
    },
  });

  const refresh = () => {
    setPageError(null);
    void queryClient.invalidateQueries({ queryKey: ["platform", "organizations"] });
  };

  const error = pageError ?? (organizationsQuery.error instanceof ApiError ? organizationsQuery.error.message : null);
  const isLoading = organizationsQuery.isLoading || isLoadingModules;

  return (
    <div>
      <PageHeader
        title="Module entitlement matrix"
        description="Audit every tenant's access to every platform module."
        action={
          <Button variant="secondary" icon={<RefreshCw className="size-4" aria-hidden />} onClick={refresh}>
            Refresh
          </Button>
        }
      />

      {error && (
        <div role="alert" className="mb-5 rounded-lg border border-danger-500/30 bg-danger-50 px-4 py-3 text-[13.5px] text-danger-600">
          {error}
        </div>
      )}
      {moduleError && !error && (
        <div role="alert" className="mb-5 rounded-lg border border-danger-500/30 bg-danger-50 px-4 py-3 text-[13.5px] text-danger-600">
          {moduleError instanceof ApiError ? moduleError.message : "Some module data could not be loaded."}
        </div>
      )}

      <Card className="overflow-hidden p-0">
        {isLoading ? (
          <p className="px-5 py-10 text-center text-[13.5px] text-text-secondary">Loading entitlement matrix…</p>
        ) : organizations.length === 0 ? (
          <p className="px-5 py-10 text-center text-[13.5px] text-text-secondary">No organizations yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full border-collapse text-[13px]">
              <caption className="sr-only">Module entitlements by organization</caption>
              <thead>
                <tr className="border-b border-border-subtle bg-surface-sunken">
                  <th className="sticky left-0 z-10 min-w-52 border-r border-border-subtle bg-surface-sunken px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                    Tenant
                  </th>
                  {moduleColumns.map((module) => (
                    <th key={module.code} className="min-w-24 border-r border-border-subtle px-3 py-3 text-center last:border-r-0" title={`${module.displayName} — ${PHASE_LABELS[module.phase]}`}>
                      <span className="block font-mono text-[11px] font-semibold text-brand-700">{module.code}</span>
                      <span className="mt-0.5 block text-[10px] font-normal text-text-secondary">{PHASE_LABELS[module.phase]}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {organizations.map((organization) => {
                  const modules = modulesByOrganization[organization.id];
                  return (
                    <tr key={organization.id} className="hover:bg-surface-sunken/60">
                      <th scope="row" className="sticky left-0 z-10 border-r border-border-subtle bg-surface-raised px-5 py-3 text-left">
                        <span className="block max-w-52 truncate font-medium text-text-primary" title={organization.displayName}>
                          {organization.displayName}
                        </span>
                        <span className="mt-0.5 block font-mono text-[11px] font-normal text-text-secondary">
                          {organization.slug} · {organization.enabledModuleCount}/{organization.totalModuleCount} on
                        </span>
                      </th>
                      {moduleColumns.map((column) => {
                        const module = modules.find((candidate) => candidate.code === column.code);
                        if (!module) {
                          return <td key={column.code} className="border-r border-border-subtle px-3 py-3 text-center text-text-secondary">—</td>;
                        }
                        return (
                          <td key={module.code} className="border-r border-border-subtle px-3 py-3 text-center last:border-r-0">
                            <button
                              type="button"
                              disabled={module.foundation || toggleModule.isPending}
                              onClick={() => setPending({ organizationId: organization.id, organizationName: organization.displayName, module })}
                              aria-label={`${module.displayName} for ${organization.displayName}: ${module.foundation ? "always on" : module.enabled ? "enabled" : "disabled"}`}
                              title={module.foundation ? `${module.displayName} is always on` : `Toggle ${module.displayName}`}
                              className={`inline-flex size-8 items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 ${
                                module.foundation
                                  ? "cursor-not-allowed border-border-subtle bg-surface-sunken text-text-secondary"
                                  : module.enabled
                                    ? "border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100"
                                    : "border-border-strong bg-surface-raised text-text-secondary hover:bg-surface-sunken"
                              }`}
                            >
                              {module.enabled ? <Check className="size-4" aria-hidden /> : <Minus className="size-4" aria-hidden />}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4" role="dialog" aria-modal="true" aria-labelledby="entitlement-confirm-title">
          <Card className="w-full max-w-md p-6 shadow-xl">
            <h2 id="entitlement-confirm-title" className="text-[16px] font-semibold text-text-primary">
              {pending.module.enabled ? "Disable" : "Enable"} {pending.module.displayName}?
            </h2>
            <p className="mt-2 text-[13.5px] leading-6 text-text-secondary">
              {pending.module.enabled ? "Staff will lose" : "Staff will gain"} access to this module at {pending.organizationName} immediately.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setPending(null)} disabled={toggleModule.isPending}>
                Cancel
              </Button>
              <Button onClick={() => toggleModule.mutate(pending)} loading={toggleModule.isPending}>
                {pending.module.enabled ? "Disable module" : "Enable module"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}