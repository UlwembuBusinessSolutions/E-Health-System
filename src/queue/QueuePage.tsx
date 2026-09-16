// Lihle | 2026-09-09 | Initialize the queue from the active clinic and switch through ClinicProvider so queue selection follows the shared clinic context.
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftRight, ArrowUpCircle, PhoneCall, Ticket } from "lucide-react";
import {
  callNext, issueManualToken, listOpenQueue, cancellationReasons, transitionToken,
  transferToken, type TokenAction, type QueueEntry,
} from "@/shared/api/queue";
import { getFacilities, getStations, type CareService } from "@/shared/api/facilities";
import { useClinic } from "@/app/ClinicProvider";
import { ApiError } from "@/shared/api/client";
import { Card } from "@/shared/components/Card";
import { Button } from "@/shared/components/Button";
import { PageHeader } from "@/shared/components/PageHeader";
import { StatusPill } from "@/shared/components/StatusPill";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
}

const careServices: Array<{ value: CareService; label: string; description: string }> = [
  { value: "MEDICAL", label: "Medical", description: "General clinical care" },
  { value: "SURGICAL", label: "Surgical", description: "Procedures and theatre" },
  { value: "DIAGNOSTIC", label: "Diagnostic", description: "Testing and imaging" },
  { value: "LONG_TERM_CARE", label: "Long-term care", description: "Ongoing support" },
];

// RECQ-US-001/002/004/006's staff-facing queue console — facility-scoped,
// with transfer targets limited to stations belonging to the selected
// clinic or hospital.
export function QueuePage() {
  const queryClient = useQueryClient();
  const { activeClinicId, switchClinic } = useClinic();
  const [facilityId, setFacilityId] = useState(activeClinicId ?? "");
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const reasonsQuery = useQuery({ queryKey: ["queue-reasons"], queryFn: cancellationReasons });
  const [transferEntry, setTransferEntry] = useState<QueueEntry | null>(null);
  const [careService, setCareService] = useState<CareService | "">("");

  const facilitiesQuery = useQuery({ queryKey: ["facilities"], queryFn: getFacilities });

  const stationsQuery = useQuery({
    queryKey: ["stations", facilityId],
    queryFn: () => getStations(facilityId),
    enabled: !!facilityId,
  });

  useEffect(() => {
    if (!facilityId && facilitiesQuery.data && facilitiesQuery.data.length > 0) {
      setFacilityId(facilitiesQuery.data[0].id);
    }
  }, [facilityId, facilitiesQuery.data]);

  const queueQuery = useQuery({
    queryKey: ["queue", facilityId],
    queryFn: () => listOpenQueue(facilityId),
    enabled: !!facilityId,
    refetchInterval: 5000,
  });

  const callNextMutation = useMutation({
    mutationFn: () => callNext(facilityId),
    onMutate: () => { setActionError(null); setNotice(null); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["queue", facilityId] });
    },
    onError: (error) => {
      setActionError(error instanceof ApiError ? error.message : "Couldn't call the next patient. Try again.");
    },
  });

  const boostMutation = useMutation({
    mutationFn: (visitId: string) => issueManualToken(visitId, "PRIORITY"),
    onMutate: () => { setActionError(null); setNotice(null); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["queue", facilityId] }),
    onError: (error) => {
      setActionError(error instanceof ApiError ? error.message : "Couldn't boost that token. Try again.");
    },
  });

  const transition = useMutation({
    mutationFn: ({ id, action }: { id: string; action: TokenAction }) =>
      transitionToken(id, action, action === "CANCEL" ? reasons[id] : undefined),
    onMutate: () => { setActionError(null); setNotice(null); },
    onSuccess: (token, { action }) => {
      const outcome: Record<TokenAction, string> = {
        START_SERVICE: "Service started", COMPLETE: "Completed", STOP: "Stopped",
        RESUME: "Returned to the queue at its original priority", CANCEL: "Cancelled",
      };
      setNotice(`Token #${token.tokenNumber}: ${outcome[action]}.`);
      setReasons(current => { const next = { ...current }; delete next[token.id]; return next; });
      return queryClient.invalidateQueries({ queryKey: ["queue", facilityId] });
    },
    onError: (error) => {
      setActionError(error instanceof ApiError ? error.message : "Could not update token. Try again.");
      void queryClient.invalidateQueries({ queryKey: ["queue", facilityId] });
    },
  });

  const transferMutation = useMutation({
    mutationFn: ({ tokenId, targetId }: { tokenId: string; targetId: string }) =>
      transferToken(tokenId, targetId),
    onMutate: () => setActionError(null),
    onSuccess: () => {
      setTransferEntry(null);
      setCareService("");
      queryClient.invalidateQueries({ queryKey: ["queue"] });
    },
    onError: (error) => {
      setActionError(error instanceof ApiError ? error.message : "Couldn't transfer that token. Try again.");
    },
  });

  const facilities = facilitiesQuery.data ?? [];
  const stations = stationsQuery.data ?? [];
  const resolvedTargetStationId =
    transferEntry && careService
      ? stations.find(
          (station) => station.id !== transferEntry.token.stationId && station.careService === careService,
        )?.id ?? ""
      : "";

  const queue = queueQuery.data ?? [];
  const justCalled = queue.find(entry => entry.token.status === "CALLED" || entry.token.status === "IN_SERVICE");

  const openTransfer = (entry: QueueEntry) => {
    setActionError(null);

    const defaultCareService =
      careServices.find((service) =>
        stations.some(
          (station) => station.careService === service.value && station.id !== entry.token.stationId,
        ),
      )?.value ?? "";

    setCareService(defaultCareService);
    setTransferEntry(entry);
  };

  return (
    <div>
      <PageHeader
        title="Queue"
        description="Reception's live token queue — issued when a visit starts."
        action={
          facilities.length > 1 && (
            <div className="relative">
              <select
                value={facilityId}
                onChange={(e) => void switchClinic(e.target.value)}
                className="h-11 appearance-none rounded-lg border border-border-strong bg-surface-raised pl-3.5 pr-10 text-[14px] text-text-primary outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              >
                {facilities.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          )
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
                <p className="text-[13.5px] text-text-secondary">{justCalled.patientName}</p>
              </>
            ) : (
              <p className="mt-1 text-[14px] text-text-secondary">No one called yet.</p>
            )}
          </div>
          <Button
            size="lg"
            icon={<PhoneCall className="size-4" aria-hidden />}
            loading={callNextMutation.isPending}
            disabled={!facilityId || transition.isPending || !queue.some(entry => entry.token.status === "ISSUED")}
            onClick={() => callNextMutation.mutate()}
          >
            Call next patient
          </Button>
        </Card>
      </div>

      {notice && <p role="status" className="mb-4 rounded-lg border border-border-subtle bg-surface-raised px-4 py-3 text-sm text-text-primary">{notice}</p>}
      {reasonsQuery.isError && <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-danger-500/30 p-4 text-sm">
        <span>Cancellation reasons could not be loaded.</span>
        <Button variant="secondary" onClick={() => void reasonsQuery.refetch()}>Retry reasons</Button>
      </div>}
      {transferEntry && (
        <Card className="mb-6 border-brand-200 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-[15px] font-semibold text-text-primary">Transfer token</h2>
              <p className="mt-1 text-[13.5px] text-text-secondary">
                Move #{transferEntry.token.tokenNumber} for {transferEntry.patientName} to a matching station in this
                facility. The original issue time will be retained, and the target station is resolved automatically
                from the selected care service.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:min-w-72 sm:flex-row sm:items-end">
              <label className="flex-1 text-[12px] font-medium text-text-secondary">
                Care service
                <select
                  value={careService}
                  onChange={(event) => setCareService(event.target.value as CareService | "")}
                  className="mt-1 h-11 w-full rounded-lg border border-border-strong bg-surface-raised px-3 text-[14px] text-text-primary outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                >
                  <option value="">Select a service</option>
                  {careServices.map((service) => (
                    <option key={service.value} value={service.value}>
                      {service.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex gap-2">
                <Button
                  loading={transferMutation.isPending}
                  disabled={!careService || !resolvedTargetStationId || stationsQuery.isLoading}
                  onClick={() => transferMutation.mutate({ tokenId: transferEntry.token.id, targetId: resolvedTargetStationId })}
                >
                  Transfer token
                </Button>
                <Button variant="secondary" onClick={() => setTransferEntry(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

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
        ) : queueQuery.isError ? (
          <p role="alert" className="p-5">Could not load the queue. Please refresh and try again.</p>
        ) : queue.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
            <Ticket className="size-6 text-text-secondary" aria-hidden />
            <p className="text-[14px] text-text-secondary">No one is waiting right now.</p>
          </div>
        ) : (
          <div>
            <table className="block w-full border-collapse text-left lg:table">
              <thead className="hidden lg:table-header-group">
                <tr className="border-b border-border-subtle">
                  <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wide text-text-secondary">
                    Token
                  </th>
                  <th className="px-5 py-3 text-[12px] font-medium uppercase tracking-wide text-text-secondary">
                    Patient
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
              <tbody className="block divide-y divide-border-subtle lg:table-row-group">
                {queue.map((entry) => (
                  <tr key={entry.token.id} className="grid grid-cols-2 gap-y-1 p-4 transition-colors duration-150 hover:bg-surface-sunken lg:table-row lg:p-0">
                    <td className="block px-1 py-2 font-mono text-[15px] font-semibold text-text-primary tabular-nums lg:table-cell lg:px-5 lg:py-3.5">
                      #{entry.token.tokenNumber}
                    </td>
                    <td className="block px-1 py-2 lg:table-cell lg:px-5 lg:py-3.5">
                      <p className="text-[13.5px] font-medium text-text-primary">{entry.patientName}</p>
                      <p className="font-mono text-[12px] text-text-secondary">{entry.patientMpi}</p>
                    </td>
                    <td className="block px-1 py-2 lg:table-cell lg:px-5 lg:py-3.5">
                      <StatusPill tone={entry.token.priority === "PRIORITY" ? "warning" : "neutral"}>
                        {entry.token.priority === "PRIORITY" ? "Priority" : "Normal"}
                      </StatusPill>
                    </td>
                    <td className="block px-1 py-2 text-[13px] text-text-secondary lg:table-cell lg:px-5 lg:py-3.5">
                      <p className="mb-1 font-mono tabular-nums"><span className="lg:hidden">Issued </span>{formatTime(entry.token.issuedAt)}</p>
                      <StatusPill tone={entry.token.status === "STOPPED" ? "warning" : entry.token.status === "IN_SERVICE" ? "success" : "neutral"}>
                        {entry.token.status.replaceAll("_", " ")}
                      </StatusPill>
                    </td>
                    <td className="col-span-2 block min-w-0 border-t border-border-subtle px-1 py-3 lg:table-cell lg:border-0 lg:px-5 lg:py-3.5 lg:text-right">
                      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                        {entry.token.status === "ISSUED" && (
                          <Button
                            variant="secondary"
                            size="md"
                            icon={<ArrowLeftRight className="size-3.5" aria-hidden />}
                            onClick={() => openTransfer(entry)}
                          >
                            Transfer
                          </Button>
                        )}
                        {entry.token.status === "CALLED" && (
                          <Button disabled={transition.isPending} onClick={() => transition.mutate({ id: entry.token.id, action: "START_SERVICE" })}>Start service</Button>
                        )}
                        {["CALLED", "IN_SERVICE"].includes(entry.token.status) && (
                          <Button disabled={transition.isPending} onClick={() => transition.mutate({ id: entry.token.id, action: "COMPLETE" })}>Complete</Button>
                        )}
                        <Button disabled={transition.isPending} onClick={() => transition.mutate({
                          id: entry.token.id, action: entry.token.status === "STOPPED" ? "RESUME" : "STOP",
                        })}>{entry.token.status === "STOPPED" ? "Resume" : "Stop"}</Button>
                        <div className="mt-2 flex w-full flex-wrap items-end gap-2 lg:justify-end">
                        <label className="flex min-w-0 flex-1 flex-col gap-1 text-left text-xs text-text-secondary lg:flex-none">
                          Cancellation reason (required)
                        <select aria-label={`Cancellation reason for token #${entry.token.tokenNumber}`}
                          disabled={transition.isPending || reasonsQuery.isLoading || reasonsQuery.isError}
                          className="h-11 w-full min-w-0 rounded-lg border border-border-strong bg-surface-raised px-3 text-sm text-text-primary lg:w-56" value={reasons[entry.token.id] ?? ""}
                          onChange={event => setReasons(current => ({ ...current, [entry.token.id]: event.target.value }))}>
                          <option value="">Select cancellation reason</option>
                          {(reasonsQuery.data ?? []).map(reason => <option key={reason} value={reason}>{reason.replaceAll("_", " ")}</option>)}
                        </select>
                        </label>
                        <Button variant="secondary" disabled={transition.isPending || !reasons[entry.token.id]}
                          onClick={() => transition.mutate({ id: entry.token.id, action: "CANCEL" })}>Cancel token</Button>
                        </div>
                      </div>

                      {entry.token.priority === "NORMAL" && entry.token.status === "ISSUED" && (
                        <Button
                          variant="secondary"
                          className="mt-2"
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
