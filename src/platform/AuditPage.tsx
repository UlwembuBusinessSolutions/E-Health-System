import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ChevronDown, ClipboardList } from "lucide-react";
import { listOrganizations, listPlatformAudit, type PlatformAuditEntry } from "@/shared/api/platform";
import { Card } from "@/shared/components/Card";
import { PageHeader } from "@/shared/components/PageHeader";

// Fixed, not derived from the data returned — a quiet stretch with zero
// MODULE_TOGGLED rows shouldn't make that filter option disappear. Matches
// every recordPlatformAudit()/PlatformAuditLog(...) call site in
// OrganizationProvisioningService and PlatformOperatorService field-for-field.
const AUDIT_ACTIONS = [
  "ORGANIZATION_PROVISIONED",
  "ORGANIZATION_DETAILS_UPDATED",
  "ORGANIZATION_SUSPENDED",
  "ORGANIZATION_REACTIVATED",
  "ORGANIZATION_LOGO_UPLOADED",
  "ORGANIZATION_ADMIN_ADDED",
  "ORGANIZATION_ADMIN_REMOVED",
  "MODULE_TOGGLED",
  "PLATFORM_OPERATOR_CREATED",
  "PLATFORM_OPERATOR_LOGIN",
] as const;

function actionLabel(action: string): string {
  const words = action.toLowerCase().split("_");
  return words.map((word, i) => (i === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word)).join(" ");
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// AUDT-US-005 — the compliance-facing view of platform_audit_log:
// every provisioning, suspend/reactivate, module toggle, detail edit, and
// operator creation, across every organization, in one filterable feed. An
// organization's own tenant-schema trail (its staff logging in, updating
// records) is a separate, narrower view — OrganizationDetailPage's own
// Audit card, reached from that organization's page rather than here.
export function AuditPage() {
  const [action, setAction] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const organizationsQuery = useQuery({
    queryKey: ["platform", "organizations", "all"],
    queryFn: () => listOrganizations({ sort: "newest" }),
  });

  const auditQuery = useQuery({
    queryKey: ["platform", "audit", { action, organizationId, from, to }],
    queryFn: () =>
      listPlatformAudit({
        action: action || undefined,
        organizationId: organizationId || undefined,
        from: from || undefined,
        to: to || undefined,
      }),
  });

  const hasActiveFilters = action !== "" || organizationId !== "" || from !== "" || to !== "";
  const entries = auditQuery.data ?? [];

  return (
    <div>
      <PageHeader title="Audit trail" description="Every platform-level action, across every organization." />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <FilterSelect
          id="audit-action"
          label="Action"
          value={action}
          onChange={setAction}
          options={[{ value: "", label: "All actions" }, ...AUDIT_ACTIONS.map((a) => ({ value: a, label: actionLabel(a) }))]}
        />
        <FilterSelect
          id="audit-org"
          label="Organization"
          value={organizationId}
          onChange={setOrganizationId}
          options={[
            { value: "", label: "All organizations" },
            ...(organizationsQuery.data ?? []).map((org) => ({ value: org.id, label: org.displayName })),
          ]}
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="audit-from" className="text-[13px] font-medium text-text-primary">
            From
          </label>
          <input
            id="audit-from"
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => setFrom(e.target.value)}
            className="h-11 w-full rounded-lg border border-border-strong bg-surface-raised px-3.5 text-[14px] text-text-primary outline-none transition-colors duration-150 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 sm:w-40"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="audit-to" className="text-[13px] font-medium text-text-primary">
            To
          </label>
          <input
            id="audit-to"
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => setTo(e.target.value)}
            className="h-11 w-full rounded-lg border border-border-strong bg-surface-raised px-3.5 text-[14px] text-text-primary outline-none transition-colors duration-150 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 sm:w-40"
          />
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => {
              setAction("");
              setOrganizationId("");
              setFrom("");
              setTo("");
            }}
            className="h-11 shrink-0 rounded-lg px-3 text-[13.5px] font-medium text-text-secondary transition-colors duration-150 hover:bg-surface-sunken hover:text-text-primary"
          >
            Clear filters
          </button>
        )}
      </div>

      <Card className="overflow-hidden p-0">
        {auditQuery.isLoading ? (
          <p className="px-5 py-10 text-center text-[14px] text-text-secondary">Loading audit trail…</p>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
            <ClipboardList className="size-6 text-text-secondary" aria-hidden />
            <p className="text-[14px] text-text-secondary">
              {hasActiveFilters ? "No activity matches your filters." : "No platform activity recorded yet."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wide text-text-secondary">
                    When
                  </th>
                  <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wide text-text-secondary">
                    Action
                  </th>
                  <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wide text-text-secondary">
                    Organization
                  </th>
                  <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wide text-text-secondary">
                    Operator
                  </th>
                  <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wide text-text-secondary">
                    Detail
                  </th>
                  <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wide text-text-secondary">
                    IP / device
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {entries.map((entry) => (
                  <AuditRow key={entry.id} entry={entry} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function AuditRow({ entry }: { entry: PlatformAuditEntry }) {
  return (
    <tr className="transition-colors duration-150 hover:bg-surface-sunken">
      <td className="whitespace-nowrap px-5 py-3.5 font-mono text-[13px] text-text-secondary tabular-nums">
        {formatDateTime(entry.createdAt)}
      </td>
      <td className="px-5 py-3.5">
        <span className="inline-flex rounded bg-brand-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-brand-700">
          {actionLabel(entry.action)}
        </span>
      </td>
      <td className="px-5 py-3.5 text-[13.5px] text-text-primary">
        {entry.organizationId && entry.organizationName ? (
          <Link to={`/platform/organizations/${entry.organizationId}`} className="hover:text-brand-600 hover:underline">
            {entry.organizationName}
          </Link>
        ) : (
          <span className="text-text-secondary">—</span>
        )}
      </td>
      <td className="px-5 py-3.5">
        <p className="text-[13.5px] text-text-primary">{entry.operatorName}</p>
        <p className="text-[12px] text-text-secondary">{entry.operatorEmail}</p>
      </td>
      <td className="max-w-xs px-5 py-3.5 text-[13px] text-text-secondary">{entry.detail ?? "—"}</td>
      <td className="max-w-[220px] px-5 py-3.5 text-[12px] text-text-secondary">
        {entry.ipAddress && <p className="font-mono">{entry.ipAddress}</p>}
        {entry.deviceSignature && (
          <p className="truncate" title={entry.deviceSignature}>
            {entry.deviceSignature}
          </p>
        )}
        {!entry.ipAddress && !entry.deviceSignature && "—"}
      </td>
    </tr>
  );
}

interface FilterSelectProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}

function FilterSelect({ id, label, value, onChange, options }: FilterSelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-text-primary">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-full appearance-none rounded-lg border border-border-strong bg-surface-raised pl-3.5 pr-10 text-[14px] text-text-primary outline-none transition-colors duration-150 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 sm:w-52"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-text-secondary"
          aria-hidden
        />
      </div>
    </div>
  );
}
