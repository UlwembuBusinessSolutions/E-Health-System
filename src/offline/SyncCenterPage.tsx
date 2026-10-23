import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Lock, RefreshCw } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { getTenantToken } from "@/shared/api/auth";
import { ApiError } from "@/shared/api/client";
import { listSyncIssues, resolveSyncIssue, type SyncIssue, type SyncResolution } from "@/shared/api/offlineSync";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { Input } from "@/shared/components/Input";
import { PageHeader } from "@/shared/components/PageHeader";
import { StatusPill, type PillTone } from "@/shared/components/StatusPill";
import { useToast } from "@/shared/components/toast/ToastProvider";
import { useOffline } from "./OfflineContext";
import type { OutboxStatus } from "./outbox";

const STATUS_LABEL: Record<OutboxStatus, string> = { PENDING: "Pending sync", CONFLICT: "Conflict", REJECTED: "Needs correction" };
const STATUS_TONE: Record<OutboxStatus, PillTone> = { PENDING: "warning", CONFLICT: "danger", REJECTED: "danger" };

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-ZA", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function SyncCenterPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const o = useOffline();
  const isAdmin = user?.role === "ORG_ADMIN";

  const issuesQuery = useQuery({
    queryKey: ["sync", "issues"],
    queryFn: listSyncIssues,
    enabled: o.isOnline && !!getTenantToken(),
  });

  const resolve = useMutation({
    mutationFn: ({ id, resolution, reason }: { id: string; resolution: SyncResolution; reason: string }) =>
      resolveSyncIssue(id, resolution, reason),
    onSuccess: () => {
      showToast("Conflict resolved.", "success");
      void queryClient.invalidateQueries({ queryKey: ["sync", "issues"] });
      void o.syncNow({ manual: true }); // lets the device clear its own copy
    },
    onError: (e) => showToast(e instanceof ApiError ? e.message : "Couldn't resolve that conflict.", "error"),
  });

  return (
    <div>
      <PageHeader
        title="Sync"
        description="Registrations saved on this device, and anything the server needs a person to decide."
        action={
          <Button icon={<RefreshCw className="size-4" aria-hidden />} loading={o.isSyncing} disabled={!o.isOnline} onClick={() => void o.syncNow({ manual: true })}>
            Sync now
          </Button>
        }
      />

      <Card className="mb-6 overflow-hidden p-0">
        <div className="border-b border-border-subtle px-5 py-4">
          <h2 className="text-[14.5px] font-semibold text-text-primary">On this device</h2>
          <p className="text-[12.5px] text-text-secondary">Encrypted on this device until synced.</p>
        </div>
        {!o.unlocked && o.entries.length > 0 && (
          <div className="flex items-center justify-between gap-3 border-b border-border-subtle bg-surface-sunken px-5 py-3 text-[13px] text-text-secondary">
            <span className="flex items-center gap-2"><Lock className="size-4" aria-hidden />Unlock to see details.</span>
            <Button size="md" variant="secondary" onClick={() => void o.requestUnlock()}>Unlock</Button>
          </div>
        )}
        {o.entries.length === 0 ? (
          <p className="px-5 py-8 text-center text-[13.5px] text-text-secondary">Nothing waiting on this device.</p>
        ) : (
          <div className="divide-y divide-border-subtle">
            {o.entries.map((e) => (
              <div key={e.clientRecordId} className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[13.5px] font-medium text-text-primary">
                      {e.data ? `${e.data.firstName} ${e.data.lastName}` : "Registration (locked)"}
                    </p>
                    <StatusPill tone={STATUS_TONE[e.status]}>{STATUS_LABEL[e.status]}</StatusPill>
                  </div>
                  <p className="text-[12.5px] text-text-secondary">
                    Captured {formatDateTime(e.capturedAt)}{e.attempts > 0 ? ` · ${e.attempts} attempt${e.attempts === 1 ? "" : "s"}` : ""}
                  </p>
                  {e.lastMessage && <p className="text-[12.5px] text-danger-600">{e.lastMessage}</p>}
                </div>
                {e.status === "REJECTED" && e.data && (
                  <div className="flex shrink-0 gap-2">
                    <Button size="md" variant="secondary" onClick={() => navigate("/app/patients/new", { state: { resend: { clientRecordId: e.clientRecordId, values: e.data } } })}>
                      Correct & resend
                    </Button>
                    <Button size="md" variant="secondary" onClick={() => { if (window.confirm("Discard this registration from the device? This can't be undone.")) void o.discard(e.clientRecordId); }}>
                      Discard
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {o.recentlySynced.length > 0 && (
        <Card className="mb-6 p-5">
          <h2 className="mb-2 text-[14.5px] font-semibold text-text-primary">Synced this session</h2>
          <ul className="flex flex-col gap-1.5">
            {o.recentlySynced.map((s, i) => (
              <li key={i} className="flex items-center gap-2 text-[13px] text-text-primary">
                <CheckCircle2 className="size-4 text-success-500" aria-hidden />
                {s.name}<span className="font-mono text-text-secondary">{s.mpiNumber}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        <div className="border-b border-border-subtle px-5 py-4">
          <h2 className="text-[14.5px] font-semibold text-text-primary">Needs a decision</h2>
          <p className="text-[12.5px] text-text-secondary">Records the server parked instead of overwriting anything.</p>
        </div>
        {!o.isOnline ? (
          <p className="px-5 py-8 text-center text-[13.5px] text-text-secondary">Go online to see conflicts.</p>
        ) : issuesQuery.isLoading ? (
          <p className="px-5 py-8 text-center text-[13.5px] text-text-secondary">Loading…</p>
        ) : issuesQuery.isError ? (
          <p role="alert" className="px-5 py-8 text-center text-[13.5px] text-danger-600">Couldn't load conflicts. Sign in again if your session expired.</p>
        ) : (issuesQuery.data ?? []).length === 0 ? (
          <p className="px-5 py-8 text-center text-[13.5px] text-text-secondary">No open conflicts.</p>
        ) : (
          <div className="divide-y divide-border-subtle">
            {issuesQuery.data!.map((issue) => (
              <IssueRow key={issue.id} issue={issue} isAdmin={isAdmin} busy={resolve.isPending}
                onResolve={(resolution, reason) => resolve.mutate({ id: issue.id, resolution, reason })} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function IssueRow({ issue, isAdmin, busy, onResolve }: { issue: SyncIssue; isAdmin: boolean; busy: boolean; onResolve: (r: SyncResolution, reason: string) => void }) {
  const [reason, setReason] = useState("");
  const d = issue.offlineData;
  const p = issue.existingPatient;
  return (
    <div className="px-5 py-4">
      <div className="mb-2 flex items-center gap-2">
        <StatusPill tone="danger">{issue.status === "CONFLICT" ? "Conflict" : "Rejected"}</StatusPill>
        <span className="text-[12.5px] text-text-secondary">Captured {formatDateTime(issue.capturedAt)}</span>
      </div>
      {issue.message && <p className="mb-3 text-[13px] text-text-primary">{issue.message}</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border-subtle bg-surface-sunken/40 p-3 text-[13px]">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-text-secondary">Captured offline</p>
          <p className="font-medium text-text-primary">{d.firstName} {d.lastName}</p>
          <p className="text-text-secondary">{d.address}</p>
          <p className="text-text-secondary">{d.contactNumber}{d.email ? ` · ${d.email}` : ""}</p>
        </div>
        {p && (
          <div className="rounded-lg border border-border-subtle bg-surface-sunken/40 p-3 text-[13px]">
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-text-secondary">Already on record</p>
            <p className="font-medium text-text-primary">{p.firstName} {p.lastName} <span className="font-mono text-text-secondary">{p.mpiNumber}</span></p>
            <p className="text-text-secondary">{p.address}</p>
            <p className="text-text-secondary">{p.contactNumber}{p.email ? ` · ${p.email}` : ""}</p>
          </div>
        )}
      </div>
      {issue.status === "CONFLICT" && (isAdmin ? (
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1"><Input label="Reason (recorded in the audit trail)" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Same person, existing record is correct" /></div>
          <Button variant="secondary" disabled={!reason.trim() || busy} onClick={() => onResolve("USE_EXISTING", reason.trim())}>Keep existing</Button>
          <Button disabled={!reason.trim() || busy} onClick={() => onResolve("APPLY_OFFLINE", reason.trim())}>Update with offline details</Button>
        </div>
      ) : (
        <p className="mt-3 text-[12.5px] text-text-secondary">An administrator needs to resolve this.</p>
      ))}
    </div>
  );
}