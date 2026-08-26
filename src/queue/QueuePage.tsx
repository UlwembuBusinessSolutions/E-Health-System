import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpCircle, PhoneCall, Ticket } from "lucide-react";
import { callNext, issueManualToken, listQueue, type QueueEntry } from "@/shared/api/queue";
import { getFacilities } from "@/shared/api/facilities";
import { ApiError } from "@/shared/api/client";
import type { ServiceStream } from "@/shared/api/visits";
import { SERVICE_STREAM_LABELS, SERVICE_STREAM_OPTIONS } from "@/shared/serviceStreamLabels";
import { Card } from "@/shared/components/Card";
import { Button } from "@/shared/components/Button";
import { PageHeader } from "@/shared/components/PageHeader";
import { StatusPill } from "@/shared/components/StatusPill";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
}

// RECQ-US-001/002/004's staff-facing queue console — facility-scoped (no
// Station entity exists yet, RECQ-US-012 is Sprint 4, so a facility stands
// in for "which queue"), same reasoning QueueController's own why-note
// gives for why facilityId is always explicit rather than assumed from the
// caller's own profile.
//
// The service-stream filter/column is PREG-F04/BR-CSAC-080's own
// contribution — "allocated to the corresponding service stream and
// appear in the relevant queue" needed a way to actually SEE that
// allocation, not just have it silently true in the database. Filtered
// client-side rather than a new backend query param: a single facility's
// active queue is realistically a handful of people, the same scale
// reasoning QueueTokenRepository.findActiveQueue()'s own why-note already
// applies.
export function QueuePage() {
  const queryClient = useQueryClient();
  const [facilityId, setFacilityId] = useState("");
  const [streamFilter, setStreamFilter] = useState<ServiceStream | "">("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [justCalled, setJustCalled] = useState<QueueEntry | null>(null);

  const facilitiesQuery = useQuery({ queryKey: ["facilities"], queryFn: getFacilities });

  useEffect(() => {
    if (!facilityId && facilitiesQuery.data && facilitiesQuery.data.length > 0) {
      setFacilityId(facilitiesQuery.data[0].id);
    }
  }, [facilityId, facilitiesQuery.data]);

  const queueQuery = useQuery({
    queryKey: ["queue", facilityId],
    queryFn: () => listQueue(facilityId),
    enabled: !!facilityId,
    refetchInterval: 5000,
  });

  const callNextMutation = useMutation({
    mutationFn: () => callNext(facilityId),
    onMutate: () => setActionError(null),
    onSuccess: (entry) => {
      setJustCalled(entry);
      queryClient.invalidateQueries({ queryKey: ["queue", facilityId] });
    },
    onError: (error) => {
      setActionError(error instanceof ApiError ? error.message : "Couldn't call the next patient. Try again.");
    },
  });

  const boostMutation = useMutation({
    mutationFn: (visitId: string) => issueManualToken(visitId, "PRIORITY"),
    onMutate: () => setActionError(null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["queue", facilityId] }),
    onError: (error) => {
      setActionError(error instanceof ApiError ? error.message : "Couldn't boost that token. Try again.");
    },
  });

  const facilities = facilitiesQuery.data ?? [];
  const queue = queueQuery.data ?? [];
  const filteredQueue = useMemo(
    () => (streamFilter ? queue.filter((entry) => entry.serviceStream === streamFilter) : queue),
    [queue, streamFilter],
  );

  return (
    <div>
      <PageHeader
        title="Queue"
        description="Reception's live token queue — issued when a visit starts."
        action={
          <div className="flex items-center gap-2">
            {facilities.length > 1 && (
              <div className="relative">
                <select
                  value={facilityId}
                  onChange={(e) => setFacilityId(e.target.value)}
                  className="h-11 appearance-none rounded-lg border border-border-strong bg-surface-raised pl-3.5 pr-10 text-[14px] text-text-primary outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                >
                  {facilities.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="relative">
              <select
                value={streamFilter}
                onChange={(e) => setStreamFilter(e.target.value as ServiceStream | "")}
                className="h-11 appearance-none rounded-lg border border-border-strong bg-surface-raised pl-3.5 pr-10 text-[14px] text-text-primary outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              >
                <option value="">All service streams</option>
                {SERVICE_STREAM_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        }
      />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-stretch">
        <Card className="flex flex-1 items-center justify-between gap-4 p-5">
          <div>
            <p className="text-[12.5px] font-medium uppercase tracking-wide text-text-secondary">Now serving</p>
            {justCalled ? (
              <>
                <p className="mt-1 font-mono text-[22px] font-semibold text-text-primary">
                  #{justCalled.token.tokenNumber}
                </p>
                <p className="text-[13.5px] text-text-secondary">
                  {justCalled.patientName} · {SERVICE_STREAM_LABELS[justCalled.serviceStream]}
                </p>
              </>
            ) : (
              <p className="mt-1 text-[14px] text-text-secondary">No one called yet.</p>
            )}
          </div>
          <Button
            size="lg"
            icon={<PhoneCall className="size-4" aria-hidden />}
            loading={callNextMutation.isPending}
            disabled={!facilityId}
            onClick={() => callNextMutation.mutate()}
          >
            Call next patient
          </Button>
        </Card>
      </div>

      <Card className="overflow-hidden p-0">
        {actionError && (
          <div role="alert" className="border-b border-danger-500/30 bg-danger-50 px-5 py-2.5 text-[13.5px] text-danger-600">
            {actionError}
          </div>
        )}
        {!facilityId ? (
          <p className="px-5 py-10 text-center text-[14px] text-text-secondary">Loading facilities…</p>
        ) : queueQuery.isLoading ? (
          <p className="px-5 py-10 text-center text-[14px] text-text-secondary">Loading queue…</p>
        ) : filteredQueue.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
            <Ticket className="size-6 text-text-secondary" aria-hidden />
            <p className="text-[14px] text-text-secondary">
              {streamFilter ? "No one waiting in this service stream." : "No one is waiting right now."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wide text-text-secondary">
                    Token
                  </th>
                  <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wide text-text-secondary">
                    Patient
                  </th>
                  <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wide text-text-secondary">
                    Service stream
                  </th>
                  <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wide text-text-secondary">
                    Priority
                  </th>
                  <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wide text-text-secondary">
                    Issued
                  </th>
                  <th className="px-5 py-3 text-right text-[12px] font-medium uppercase tracking-wide text-text-secondary">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {filteredQueue.map((entry) => (
                  <tr key={entry.token.id} className="transition-colors duration-150 hover:bg-surface-sunken">
                    <td className="px-5 py-3.5 font-mono text-[15px] font-semibold text-text-primary tabular-nums">
                      #{entry.token.tokenNumber}
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-[13.5px] font-medium text-text-primary">{entry.patientName}</p>
                      <p className="font-mono text-[12px] text-text-secondary">{entry.patientMpi}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex rounded-full bg-brand-50 px-2.5 py-1 text-[12px] font-medium text-brand-700">
                        {SERVICE_STREAM_LABELS[entry.serviceStream]}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusPill tone={entry.token.priority === "PRIORITY" ? "warning" : "neutral"}>
                        {entry.token.priority === "PRIORITY" ? "Priority" : "Normal"}
                      </StatusPill>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[13px] text-text-secondary tabular-nums">
                      {formatTime(entry.token.issuedAt)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {entry.token.priority === "NORMAL" && (
                        <Button
                          variant="secondary"
                          size="md"
                          icon={<ArrowUpCircle className="size-3.5" aria-hidden />}
                          loading={boostMutation.isPending && boostMutation.variables === entry.token.visitId}
                          onClick={() => boostMutation.mutate(entry.token.visitId)}
                        >
                          Boost to priority
                        </Button>
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