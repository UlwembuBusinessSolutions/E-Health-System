import { useQuery } from "@tanstack/react-query";
import { ClipboardList, ShieldAlert } from "lucide-react";
import { Card } from "@/shared/components/Card";
import { PageHeader } from "@/shared/components/PageHeader";
import { listTenantAudit, type TenantAuditEntry } from "@/shared/api/audit";

function actionLabel(action: string): string {
  return action
    .toLowerCase()
    .split("_")
    .map((word, index) => (index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(" ");
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

export function AuditPage() {
  const auditQuery = useQuery({
    queryKey: ["tenant", "audit"],
    queryFn: listTenantAudit,
  });

  const entries = auditQuery.data ?? [];

  return (
    <div>
      <PageHeader
        title="Audit trail"
        description="Your organisation’s audit events only."
      />

      <Card className="overflow-hidden p-0">
        {auditQuery.isLoading ? (
          <p className="px-5 py-10 text-center text-[14px] text-text-secondary">Loading audit events…</p>
        ) : auditQuery.isError ? (
          <div className="flex flex-col items-center gap-2 px-5 py-14 text-center text-text-secondary">
            <ShieldAlert className="size-6" aria-hidden />
            <p className="text-[14px]">Unable to load audit events.</p>
            <p className="text-[13px]">{auditQuery.error instanceof Error ? auditQuery.error.message : "Please try again."}</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
            <ClipboardList className="size-6 text-text-secondary" aria-hidden />
            <p className="text-[14px] text-text-secondary">No audit events recorded for your organisation yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wide text-text-secondary">When</th>
                  <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wide text-text-secondary">Action</th>
                  <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wide text-text-secondary">Entity</th>
                  <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wide text-text-secondary">User</th>
                  <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wide text-text-secondary">Facility</th>
                  <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wide text-text-secondary">IP / device</th>
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

function AuditRow({ entry }: { entry: TenantAuditEntry }) {
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
      <td className="px-5 py-3.5 text-[13px] text-text-primary">
        <p>{entry.entityType ?? "—"}</p>
        <p className="text-[12px] text-text-secondary">{entry.entityId ?? "—"}</p>
      </td>
      <td className="px-5 py-3.5 text-[13px] text-text-primary">
        <p>{entry.userId ?? "System"}</p>
      </td>
      <td className="px-5 py-3.5 text-[13px] text-text-primary">
        {entry.facilityId ?? "—"}
      </td>
      <td className="max-w-[220px] px-5 py-3.5 text-[12px] text-text-secondary">
        {entry.ipAddress && <p className="font-mono">{entry.ipAddress}</p>}
        {entry.deviceSignature && <p className="truncate" title={entry.deviceSignature}>{entry.deviceSignature}</p>}
        {!entry.ipAddress && !entry.deviceSignature && "—"}
      </td>
    </tr>
  );
}
