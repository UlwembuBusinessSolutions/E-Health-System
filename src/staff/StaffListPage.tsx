import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Check, Copy, KeyRound, Plus, Search } from "lucide-react";
import { listStaff, resetStaffPassword, setStaffEnabled } from "@/shared/api/staff";
import { getFacilities } from "@/shared/api/facilities";
import { ApiError } from "@/shared/api/client";
import { Card } from "@/shared/components/Card";
import { Button } from "@/shared/components/Button";
import { Input } from "@/shared/components/Input";
import { PageHeader } from "@/shared/components/PageHeader";
import { StatusPill } from "@/shared/components/StatusPill";

function formatDateTime(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}

function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="flex size-6 shrink-0 items-center justify-center rounded-md text-text-secondary transition-colors duration-150 hover:bg-surface-raised hover:text-text-primary"
      aria-label="Copy password"
      title="Copy"
    >
      {copied ? <Check className="size-3.5 text-success-500" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
    </button>
  );
}

// The roster StaffController.list() exists for — everyone with an account
// in this organization, one level down from AddStaffScreen's own "create
// one" form. ORG_ADMIN-only, matching the backend endpoint's own gating
// (RequireRole wraps this route in router.tsx same as it already does
// /app/staff/new). Facility names are joined client-side against
// getFacilities() rather than resolved server-side — StaffController's own
// roster response only carries facilityId, and the facility list is
// already a call the app makes elsewhere (AddStaffScreen's own dropdown),
// small enough that a second round trip here is cheaper than adding a
// cross-module name-resolution path on the backend for one column.
export function StaffListPage() {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [confirmResetId, setConfirmResetId] = useState<string | null>(null);
  const [revealedPassword, setRevealedPassword] = useState<{ id: string; password: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const staffQuery = useQuery({ queryKey: ["staff", "list"], queryFn: listStaff });
  const facilitiesQuery = useQuery({ queryKey: ["facilities"], queryFn: getFacilities });

  const facilityNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const facility of facilitiesQuery.data ?? []) map.set(facility.id, facility.name);
    return map;
  }, [facilitiesQuery.data]);

  const staff = staffQuery.data ?? [];
  const filtered = useMemo(() => {
    const q = searchInput.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter(
      (s) =>
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.employeeNumber.toLowerCase().includes(q),
    );
  }, [staff, searchInput]);

  const resetPassword = useMutation({
    mutationFn: (id: string) => resetStaffPassword(id),
    onMutate: () => setActionError(null),
    onSuccess: (result, id) => {
      setConfirmResetId(null);
      setRevealedPassword({ id, password: result.temporaryPassword });
    },
    onError: (error) => {
      setConfirmResetId(null);
      setActionError(error instanceof ApiError ? error.message : "Couldn't reset that password. Try again.");
    },
  });

  const toggleEnabled = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => setStaffEnabled(id, enabled),
    onMutate: () => setActionError(null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staff", "list"] }),
    onError: (error) => {
      setActionError(error instanceof ApiError ? error.message : "Couldn't update that account. Try again.");
    },
  });

  return (
    <div>
      <PageHeader
        title="Staff"
        description="Everyone with an account in your organization."
        action={
          <Link
            to="/app/staff/new"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 text-[14px] font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-brand-600"
          >
            <Plus className="size-4" aria-hidden />
            Add staff member
          </Link>
        }
      />

      <div className="mb-4">
        <Input
          label="Search"
          placeholder="Search by name, email, or employee number…"
          icon={<Search className="size-4" aria-hidden />}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </div>

      <Card className="overflow-hidden p-0">
        {actionError && (
          <div role="alert" className="border-b border-danger-500/30 bg-danger-50 px-5 py-2.5 text-[13.5px] text-danger-600">
            {actionError}
          </div>
        )}
        {staffQuery.isLoading ? (
          <p className="px-5 py-10 text-center text-[14px] text-text-secondary">Loading staff…</p>
        ) : filtered.length === 0 ? (
          <p className="px-5 py-10 text-center text-[14px] text-text-secondary">
            {staff.length === 0 ? "No staff yet — add the first one." : "No staff match your search."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wide text-text-secondary">
                    Staff member
                  </th>
                  <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wide text-text-secondary">
                    Role
                  </th>
                  <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wide text-text-secondary">
                    Facility
                  </th>
                  <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wide text-text-secondary">
                    Status
                  </th>
                  <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wide text-text-secondary">
                    Last sign-in
                  </th>
                  <th className="px-5 py-3 text-right text-[12px] font-medium uppercase tracking-wide text-text-secondary">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {filtered.map((s) => (
                  <tr key={s.id} className="transition-colors duration-150 hover:bg-surface-sunken">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-brand-500/25 bg-brand-50 text-[12px] font-semibold text-brand-600">
                          {initials(s.firstName, s.lastName)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-semibold text-text-primary">
                            {s.firstName} {s.lastName}
                          </p>
                          <p className="truncate text-[12.5px] text-text-secondary">{s.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-[13.5px] text-text-primary">
                      {s.roles.length > 0 ? s.roles.join(", ") : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-[13.5px] text-text-primary">
                      {s.facilityId ? (facilityNames.get(s.facilityId) ?? "—") : "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusPill tone={s.status === "ACTIVE" ? "success" : s.status === "LOCKED" ? "warning" : "neutral"}>
                        {s.status === "ACTIVE" ? "Active" : s.status === "LOCKED" ? "Locked" : "Disabled"}
                      </StatusPill>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[13px] text-text-secondary tabular-nums">
                      {formatDateTime(s.lastLoginAt)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {revealedPassword?.id === s.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <span className="rounded-md bg-surface-sunken px-2 py-1 font-mono text-[12.5px] text-text-primary">
                            {revealedPassword.password}
                          </span>
                          <CopyButton text={revealedPassword.password} />
                          <Button size="md" variant="secondary" onClick={() => setRevealedPassword(null)}>
                            Done
                          </Button>
                        </div>
                      ) : confirmResetId === s.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-[12.5px] text-text-secondary">Generate a new password?</span>
                          <Button size="md" variant="secondary" onClick={() => setConfirmResetId(null)}>
                            Cancel
                          </Button>
                          <Button size="md" loading={resetPassword.isPending} onClick={() => resetPassword.mutate(s.id)}>
                            Confirm
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="secondary"
                            size="md"
                            icon={<KeyRound className="size-3.5" aria-hidden />}
                            onClick={() => setConfirmResetId(s.id)}
                          >
                            Reset password
                          </Button>
                          <Button
                            variant="secondary"
                            size="md"
                            loading={toggleEnabled.isPending && toggleEnabled.variables?.id === s.id}
                            onClick={() => toggleEnabled.mutate({ id: s.id, enabled: s.status === "DISABLED" })}
                          >
                            {s.status === "DISABLED" ? "Enable" : "Disable"}
                          </Button>
                        </div>
                      )}
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
