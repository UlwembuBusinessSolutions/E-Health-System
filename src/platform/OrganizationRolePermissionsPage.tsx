import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, KeyRound, LockKeyhole, Save, Search, ShieldCheck } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import {
  getOrganization,
  listOrganizationRolePermissions,
  updateOrganizationRolePermissions,
  type RoleWithPermissions,
} from "@/shared/api/platform";
import { ApiError } from "@/shared/api/client";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";

function areSameCodes(first: string[], second: string[]): boolean {
  return first.length === second.length && first.every((code, index) => code === second[index]);
}

function defaultRole(roles: RoleWithPermissions[]): RoleWithPermissions | undefined {
  return roles.find((role) => role.name !== "ORG_ADMIN") ?? roles[0];
}

export function OrganizationRolePermissionsPage() {
  const { id } = useParams<{ id: string }>();
  const organizationId = id ?? "";
  const queryClient = useQueryClient();
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [editedPermissions, setEditedPermissions] = useState<Record<string, string[]>>({});
  const [search, setSearch] = useState("");

  const organizationQuery = useQuery({
    queryKey: ["platform", "organizations", organizationId],
    queryFn: () => getOrganization(organizationId),
    enabled: !!organizationId,
  });
  const catalogueQuery = useQuery({
    queryKey: ["platform", "organizations", organizationId, "role-permissions"],
    queryFn: () => listOrganizationRolePermissions(organizationId),
    enabled: !!organizationId,
  });

  const roles = catalogueQuery.data?.roles ?? [];
  const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? defaultRole(roles);

  useEffect(() => {
    if (!selectedRoleId && roles.length > 0) {
      setSelectedRoleId(defaultRole(roles)?.id ?? "");
    }
  }, [roles, selectedRoleId]);

  const draftCodes = editedPermissions[selectedRole?.id ?? ""] ?? selectedRole?.permissionCodes ?? [];
  const currentCodes = selectedRole?.permissionCodes ?? [];
  const sortedDraftCodes = [...draftCodes].sort();
  const hasChanges = !areSameCodes(sortedDraftCodes, [...currentCodes].sort());

  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, string[]>();
    const normalizedSearch = search.trim().toLowerCase();
    for (const code of catalogueQuery.data?.availablePermissions ?? []) {
      if (normalizedSearch && !code.toLowerCase().includes(normalizedSearch)) continue;
      const separator = code.indexOf(":");
      const group = separator > 0 ? code.slice(0, separator) : "Other";
      groups.set(group, [...(groups.get(group) ?? []), code]);
    }
    return [...groups.entries()].sort(([first], [second]) => first.localeCompare(second));
  }, [catalogueQuery.data?.availablePermissions, search]);

  const savePermissions = useMutation({
    mutationFn: () => {
      if (!selectedRole) throw new Error("Select a role before saving permissions.");
      return updateOrganizationRolePermissions(organizationId, selectedRole.id, sortedDraftCodes);
    },
    onSuccess: (change) => {
      if (selectedRole) {
        setEditedPermissions((previous) => ({ ...previous, [selectedRole.id]: change.after }));
      }
      void queryClient.invalidateQueries({
        queryKey: ["platform", "organizations", organizationId, "role-permissions"],
      });
    },
  });

  const handleRoleChange = (roleId: string) => {
    setSelectedRoleId(roleId);
    setSearch("");
    savePermissions.reset();
  };

  const togglePermission = (code: string, checked: boolean) => {
    const nextCodes = new Set(draftCodes);
    if (checked) nextCodes.add(code);
    else nextCodes.delete(code);
    if (selectedRole) {
      setEditedPermissions((previous) => ({ ...previous, [selectedRole.id]: [...nextCodes] }));
    }
    savePermissions.reset();
  };

  const loading = organizationQuery.isLoading || catalogueQuery.isLoading;
  const error =
    organizationQuery.error instanceof ApiError
      ? organizationQuery.error.message
      : catalogueQuery.error instanceof ApiError
        ? catalogueQuery.error.message
        : organizationQuery.error || catalogueQuery.error
          ? "Role permissions could not be loaded. Try again."
          : null;

  return (
    <div className="mx-auto w-full max-w-6xl pb-10">
      <Link
        to={`/platform/organizations/${organizationId}`}
        className="mb-5 inline-flex items-center gap-1.5 rounded-md text-[13.5px] font-medium text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to organization
      </Link>

      <div className="mb-6 overflow-hidden rounded-2xl border border-border-subtle bg-surface-raised shadow-card">
        <div className="flex flex-col gap-5 bg-ink-900 px-5 py-6 text-white sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-brand-400/30 bg-brand-500/15 text-brand-300">
              <ShieldCheck className="size-6" aria-hidden />
            </span>
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-300">
                Access control
              </p>
              <h1 className="text-[22px] font-semibold tracking-tight sm:text-[25px]">Role permissions</h1>
              <p className="mt-1 max-w-2xl text-[13px] leading-5 text-ink-300">
                Set what each role can do. Changes apply to everyone assigned that role in this organization.
              </p>
            </div>
          </div>
          {organizationQuery.data && (
            <div className="flex items-center gap-2 self-start rounded-lg border border-ink-700 bg-ink-800/70 px-3 py-2 sm:self-center">
              <span className="flex size-7 items-center justify-center rounded-md bg-ink-700 text-brand-300">
                <KeyRound className="size-3.5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="max-w-56 truncate text-[12.5px] font-medium text-ink-50">
                  {organizationQuery.data.displayName}
                </p>
                <p className="font-mono text-[10.5px] text-ink-400">{organizationQuery.data.slug}</p>
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <div>
            <p className="text-[13px] font-medium text-text-primary">Configure a role's permission set</p>
            <p className="mt-0.5 text-[12.5px] text-text-secondary">
              Select a role below, then choose the permissions it should have.
            </p>
          </div>
          <Button
            icon={<Save className="size-4" aria-hidden />}
            loading={savePermissions.isPending}
            disabled={!selectedRole || selectedRole.name === "ORG_ADMIN" || !hasChanges}
            onClick={() => savePermissions.mutate()}
          >
            Save changes
          </Button>
        </div>
      </div>

      {(error || savePermissions.error) && (
        <div role="alert" className="mb-5 flex items-start gap-2.5 rounded-xl border border-danger-500/30 bg-danger-50 px-4 py-3 text-[13.5px] text-danger-600">
          {savePermissions.error instanceof ApiError
            ? savePermissions.error.message
            : error ??
              (savePermissions.error
                ? "Couldn't update role permissions. No changes were saved."
                : null)}
        </div>
      )}
      {savePermissions.isSuccess && savePermissions.data.changed && (
        <div role="status" className="mb-5 flex items-center gap-2.5 rounded-xl border border-success-500/30 bg-success-50 px-4 py-3 text-[13.5px] text-success-600">
          <Check className="size-4 shrink-0" aria-hidden />
          <span>Permissions updated for <strong>{savePermissions.data.roleName}</strong>.</span>
        </div>
      )}
      {savePermissions.isSuccess && !savePermissions.data.changed && (
        <div role="status" className="mb-5 rounded-xl border border-border-subtle bg-surface-sunken px-4 py-3 text-[13.5px] text-text-secondary">
          No permission changes were needed.
        </div>
      )}

      {loading ? (
        <Card className="flex flex-col items-center px-5 py-14 text-center">
          <span className="mb-3 flex size-11 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <KeyRound className="size-5 animate-pulse" aria-hidden />
          </span>
          <p className="text-[14px] font-medium text-text-primary">Loading role permissions</p>
          <p className="mt-1 text-[13px] text-text-secondary">Getting this organization's roles and permission catalogue…</p>
        </Card>
      ) : error ? null : roles.length === 0 ? (
        <Card className="flex flex-col items-center px-5 py-14 text-center">
          <span className="mb-3 flex size-11 items-center justify-center rounded-full bg-surface-sunken text-text-secondary">
            <ShieldCheck className="size-5" aria-hidden />
          </span>
          <p className="text-[14px] font-medium text-text-primary">No roles found</p>
          <p className="mt-1 text-[13px] text-text-secondary">This organization does not have any roles to configure.</p>
        </Card>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.7fr)]">
            <Card className="p-5 sm:p-6">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">Selected role</p>
                  <p className="mt-1 text-[13px] text-text-secondary">Choose a role to inspect or edit its access.</p>
                </div>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <KeyRound className="size-[18px]" aria-hidden />
                </span>
              </div>
              <label htmlFor="role-select" className="sr-only">Select a role</label>
              <select
                id="role-select"
                value={selectedRole?.id ?? ""}
                onChange={(event) => handleRoleChange(event.target.value)}
                className="h-12 w-full rounded-xl border border-border-strong bg-surface-raised px-3.5 text-[14px] font-semibold text-text-primary outline-none transition-shadow focus:border-brand-400 focus:ring-2 focus:ring-brand-400/30"
              >
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}{role.name === "ORG_ADMIN" ? " (protected)" : ""}
                  </option>
                ))}
              </select>
              {selectedRole?.name === "ORG_ADMIN" ? (
                <div className="mt-4 flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12.5px] leading-5 text-amber-800">
                  <LockKeyhole className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span><strong>Protected role.</strong> Its permissions can't be changed here, preserving the organization's ability to administer itself.</span>
                </div>
              ) : (
                <div className="mt-5 border-t border-border-subtle pt-4">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[26px] font-semibold leading-none text-text-primary">{draftCodes.length}</p>
                      <p className="mt-1.5 text-[12px] text-text-secondary">permissions selected</p>
                    </div>
                    <p className="text-right text-[12px] text-text-secondary">
                      out of <span className="font-semibold text-text-primary">{catalogueQuery.data?.availablePermissions.length ?? 0}</span>
                      <br />available permissions
                    </p>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                    <div
                      className="h-full rounded-full bg-brand-500 transition-[width] duration-300"
                      style={{
                        width: `${catalogueQuery.data?.availablePermissions.length
                          ? Math.min(100, (draftCodes.length / catalogueQuery.data.availablePermissions.length) * 100)
                          : 0}%`,
                      }}
                    />
                  </div>
                  <p className={`mt-3 text-[12px] font-medium ${hasChanges ? "text-amber-700" : "text-success-600"}`}>
                    {hasChanges ? "Unsaved changes — save to apply" : "All changes are saved"}
                  </p>
                </div>
              )}
            </Card>

            <Card className="overflow-hidden p-0">
              <div className="flex flex-col gap-4 border-b border-border-subtle px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-[15px] font-semibold text-text-primary">Permission catalogue</h2>
                    <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] font-semibold text-text-secondary">
                      {catalogueQuery.data?.availablePermissions.length ?? 0}
                    </span>
                  </div>
                  <p className="mt-1 text-[12.5px] text-text-secondary">
                    Changes affect this organization only and are recorded in both audit trails.
                  </p>
                </div>
                <label className="relative block sm:w-60">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary" aria-hidden />
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search permissions"
                    aria-label="Filter permissions"
                    className="h-10 w-full rounded-lg border border-border-strong bg-surface-raised pl-9 pr-3 text-[13px] text-text-primary outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/30"
                  />
                </label>
              </div>

            {groupedPermissions.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <Search className="mx-auto mb-2 size-5 text-text-secondary" aria-hidden />
                <p className="text-[13.5px] font-medium text-text-primary">No permissions found</p>
                <p className="mt-1 text-[12.5px] text-text-secondary">Try another search term.</p>
              </div>
            ) : (
              <div className="max-h-[min(62vh,680px)] divide-y divide-border-subtle overflow-y-auto">
                {groupedPermissions.map(([group, codes]) => (
                  <section key={group} aria-label={`${group} permissions`} className="px-5 py-4 sm:px-6">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="flex size-6 items-center justify-center rounded-md bg-brand-50 text-brand-700">
                          <ShieldCheck className="size-3.5" aria-hidden />
                        </span>
                        <h3 className="text-[12px] font-semibold uppercase tracking-wide text-text-primary">{group}</h3>
                      </div>
                      <span className="text-[11.5px] text-text-secondary">
                        {codes.filter((code) => draftCodes.includes(code)).length} / {codes.length} selected
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {codes.map((code) => {
                        const checked = draftCodes.includes(code);
                        const [area, action] = code.includes(":") ? code.split(/:(.*)/s, 2) : [code, ""];
                        return (
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={checked}
                            aria-label={code}
                            disabled={selectedRole?.name === "ORG_ADMIN" || savePermissions.isPending}
                            onClick={() => togglePermission(code, !checked)}
                            key={code}
                            className={`group flex min-w-0 items-center gap-3 rounded-xl border p-3 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed ${
                              selectedRole?.name === "ORG_ADMIN"
                                ? "border-border-subtle bg-surface-sunken/40 opacity-75"
                                : checked
                                  ? "border-brand-200 bg-brand-50/70 shadow-sm hover:border-brand-300"
                                  : "border-border-subtle bg-surface-raised hover:border-border-strong hover:bg-surface-sunken/50 disabled:opacity-60"
                            }`}
                          >
                            <span
                              aria-hidden
                              className={`flex size-[18px] shrink-0 items-center justify-center rounded border transition-colors ${
                                checked
                                  ? "border-brand-600 bg-brand-600 text-white"
                                  : "border-border-strong bg-surface-raised text-transparent group-hover:border-brand-400"
                              }`}
                            >
                              <Check className="size-3" strokeWidth={3} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-mono text-[12px] font-medium text-text-primary" title={code}>
                                {area}{action && <span className="text-text-secondary">:</span>}{action}
                              </span>
                              {action && (
                                <span className="mt-1 inline-flex rounded bg-surface-sunken px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-text-secondary">
                                  {action}
                                </span>
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
              <div className="flex flex-col gap-3 border-t border-border-subtle bg-surface-sunken/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <p className="text-[12.5px] text-text-secondary">
                  {hasChanges ? "Review your selections, then save to apply them." : "No pending changes."}
                </p>
                <Button
                  icon={<Save className="size-4" aria-hidden />}
                  loading={savePermissions.isPending}
                  disabled={!selectedRole || selectedRole.name === "ORG_ADMIN" || !hasChanges}
                  onClick={() => savePermissions.mutate()}
                >
                  Save changes
                </Button>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
