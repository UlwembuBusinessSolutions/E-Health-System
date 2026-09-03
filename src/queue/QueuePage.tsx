import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpCircle,
  CheckCircle2,
  PhoneCall,
  PhoneMissed,
  Repeat,
  Search,
  Ticket,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  callNext,
  cancelToken,
  completeToken,
  listQueue,
  markMissed,
  recallToken,
  updateTokenPriority,
  type QueueEntry,
  type TokenStatus,
} from "@/shared/api/queue";
import { getFacilities } from "@/shared/api/facilities";
import { ApiError } from "@/shared/api/client";
import { Card } from "@/shared/components/Card";
import { Button } from "@/shared/components/Button";
import { PageHeader } from "@/shared/components/PageHeader";
import { StatusPill, type PillTone } from "@/shared/components/StatusPill";
import { Switch } from "@/shared/components/Switch";

const SPEAKER_STORAGE_KEY = "queue.speakerEnabled";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
}

const STATUS_LABEL: Record<TokenStatus, string> = {
  ISSUED: "Waiting",
  CALLED: "Called",
  MISSED: "Missed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const STATUS_TONE: Record<TokenStatus, PillTone> = {
  ISSUED: "neutral",
  CALLED: "success",
  MISSED: "danger",
  COMPLETED: "success",
  CANCELLED: "neutral",
};

// A short two-tone chime, synthesised rather than shipped as an audio file
// — there's nothing to fetch, cache, or fail to load. Best-effort only: if
// the Web Audio API isn't available, the spoken announcement below still
// carries the information on its own.
function playChime() {
  try {
    const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    let t = ctx.currentTime;
    for (const freq of [880, 1108.73]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.28);
      t += 0.22;
    }
  } catch {
    // No Web Audio support — the chime is a nicety, not a requirement.
  }
}

// RECQ-US-015 (queue-appointments-plan.md §3.2) — the cheapest version of
// the speaker call-out: browser SpeechSynthesis through whatever speakers
// are attached to the machine running this page, in practice a kiosk PC
// wired to the waiting-room PA. No Station entity exists yet
// (RECQ-US-012), so the announcement names reception rather than a
// specific counter.
function announce(tokenNumber: number) {
  playChime();
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(`Token ${tokenNumber}. Please proceed to reception.`);
  utterance.rate = 0.95;
  window.speechSynthesis.speak(utterance);
}

// RECQ-US-001/002/004/005/007/015's staff-facing queue console —
// facility-scoped (no Station entity exists yet, RECQ-US-012 is Sprint 4,
// so a facility stands in for "which queue"), same reasoning
// QueueController's own why-note gives for why facilityId is always
// explicit rather than assumed from the caller's own profile. The list
// itself is always today's queue only (server-enforced, QueueService's day
// bounds) — there's no client control to look at another day.
export function QueuePage() {
  const queryClient = useQueryClient();
  const [facilityId, setFacilityId] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [justCalled, setJustCalled] = useState<QueueEntry | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [speakerEnabled, setSpeakerEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SPEAKER_STORAGE_KEY) !== "off";
    } catch {
      return true;
    }
  });
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const cancelInputRef = useRef<HTMLInputElement>(null);

  const facilitiesQuery = useQuery({ queryKey: ["facilities"], queryFn: getFacilities });

  useEffect(() => {
    if (!facilityId && facilitiesQuery.data && facilitiesQuery.data.length > 0) {
      setFacilityId(facilitiesQuery.data[0].id);
    }
  }, [facilityId, facilitiesQuery.data]);

  // RECQ-US-007 — search runs server-side; debounced so typing doesn't
  // fire a request per keystroke.
  useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    try {
      localStorage.setItem(SPEAKER_STORAGE_KEY, speakerEnabled ? "on" : "off");
    } catch {
      // Best-effort persistence — the toggle still works for this session
      // even if storage is unavailable (private browsing, etc.).
    }
  }, [speakerEnabled]);

  useEffect(() => {
    if (cancellingId) cancelInputRef.current?.focus();
  }, [cancellingId]);

  const queueQuery = useQuery({
    queryKey: ["queue", facilityId, search],
    queryFn: () => listQueue(facilityId, search || undefined),
    enabled: !!facilityId,
    refetchInterval: 5000,
  });

  function invalidateQueue() {
    queryClient.invalidateQueries({ queryKey: ["queue", facilityId] });
  }

  const callNextMutation = useMutation({
    mutationFn: () => callNext(facilityId),
    onMutate: () => setActionError(null),
    onSuccess: (entry) => {
      setJustCalled(entry);
      if (speakerEnabled) announce(entry.token.tokenNumber);
      invalidateQueue();
    },
    onError: (error) => {
      setActionError(error instanceof ApiError ? error.message : "Couldn't call the next patient. Try again.");
    },
  });

  const boostMutation = useMutation({
    mutationFn: (tokenId: string) => updateTokenPriority(tokenId, "PRIORITY"),
    onMutate: () => setActionError(null),
    onSuccess: invalidateQueue,
    onError: (error) => {
      setActionError(error instanceof ApiError ? error.message : "Couldn't boost that token. Try again.");
    },
  });

  const missedMutation = useMutation({
    mutationFn: (tokenId: string) => markMissed(tokenId),
    onMutate: () => setActionError(null),
    onSuccess: invalidateQueue,
    onError: (error) => {
      setActionError(error instanceof ApiError ? error.message : "Couldn't mark that token missed. Try again.");
    },
  });

  const recallMutation = useMutation({
    mutationFn: (tokenId: string) => recallToken(tokenId),
    onMutate: () => setActionError(null),
    onSuccess: invalidateQueue,
    onError: (error) => {
      setActionError(error instanceof ApiError ? error.message : "Couldn't recall that patient. Try again.");
    },
  });

  const completeMutation = useMutation({
    mutationFn: (tokenId: string) => completeToken(tokenId),
    onMutate: () => setActionError(null),
    onSuccess: invalidateQueue,
    onError: (error) => {
      setActionError(error instanceof ApiError ? error.message : "Couldn't complete that token. Try again.");
    },
  });

  const cancelMutation = useMutation({
    mutationFn: ({ tokenId, reason }: { tokenId: string; reason: string }) => cancelToken(tokenId, reason),
    onMutate: () => setActionError(null),
    onSuccess: () => {
      setCancellingId(null);
      setCancelReason("");
      invalidateQueue();
    },
    onError: (error) => {
      setActionError(error instanceof ApiError ? error.message : "Couldn't cancel that token. Try again.");
    },
  });

  const facilities = facilitiesQuery.data ?? [];
  const queue = queueQuery.data ?? [];

  return (
    <div>
      <PageHeader
        title="Queue"
        description="Today's token queue — issued when a visit starts, cleared as each patient is completed or cancelled."
        action={
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-[13px] text-text-secondary">
              {speakerEnabled ? (
                <Volume2 className="size-4" aria-hidden />
              ) : (
                <VolumeX className="size-4" aria-hidden />
              )}
              Speaker
              <Switch checked={speakerEnabled} onChange={setSpeakerEnabled} label="Speaker announcements" />
            </label>
            {facilities.length > 1 && (
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
            )}
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
                <p className="text-[13.5px] text-text-secondary">{justCalled.patientName}</p>
              </>
            ) : (
              <p className="mt-1 text-[14px] text-text-secondary">No one called yet.</p>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            {justCalled && (
              <Button
                variant="secondary"
                size="lg"
                icon={<Repeat className="size-4" aria-hidden />}
                onClick={() => announce(justCalled.token.tokenNumber)}
                title="Replay the speaker announcement"
              >
                Replay
              </Button>
            )}
            <Button
              size="lg"
              icon={<PhoneCall className="size-4" aria-hidden />}
              loading={callNextMutation.isPending}
              disabled={!facilityId}
              onClick={() => callNextMutation.mutate()}
            >
              Call next patient
            </Button>
          </div>
        </Card>
      </div>

      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute inset-y-0 left-3 my-auto size-4 text-text-secondary" aria-hidden />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by token, name, or MPI"
            aria-label="Search the queue by token number, patient name, or MPI"
            className="h-11 w-full rounded-lg border border-border-strong bg-surface-raised pl-10 pr-3.5 text-[14px] text-text-primary placeholder:text-text-secondary/70 outline-none transition-colors duration-150 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
        </div>
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
        ) : queue.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
            <Ticket className="size-6 text-text-secondary" aria-hidden />
            <p className="text-[14px] text-text-secondary">
              {search ? "No one in today's queue matches that search." : "No one is waiting right now."}
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
                    Status
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
                {queue.map((entry) => {
                  const status = entry.token.status;
                  const isCancelling = cancellingId === entry.token.id;
                  return (
                    <tr key={entry.token.id} className="transition-colors duration-150 hover:bg-surface-sunken">
                      <td className="px-5 py-3.5 font-mono text-[15px] font-semibold text-text-primary tabular-nums">
                        #{entry.token.tokenNumber}
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-[13.5px] font-medium text-text-primary">{entry.patientName}</p>
                        <p className="font-mono text-[12px] text-text-secondary">{entry.patientMpi}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusPill tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</StatusPill>
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
                        {isCancelling ? (
                          <div className="flex items-center justify-end gap-2">
                            <input
                              ref={cancelInputRef}
                              type="text"
                              value={cancelReason}
                              onChange={(e) => setCancelReason(e.target.value)}
                              placeholder="Reason for cancelling"
                              aria-label={`Reason for cancelling token ${entry.token.tokenNumber}`}
                              className="h-9 w-48 rounded-lg border border-border-strong bg-surface-raised px-3 text-[13px] text-text-primary placeholder:text-text-secondary/70 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                            />
                            <Button
                              variant="secondary"
                              size="md"
                              disabled={!cancelReason.trim()}
                              loading={cancelMutation.isPending && cancelMutation.variables?.tokenId === entry.token.id}
                              onClick={() => cancelMutation.mutate({ tokenId: entry.token.id, reason: cancelReason.trim() })}
                            >
                              Confirm
                            </Button>
                            <Button
                              variant="ghost"
                              size="md"
                              onClick={() => {
                                setCancellingId(null);
                                setCancelReason("");
                              }}
                            >
                              Back
                            </Button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            {status === "ISSUED" && entry.token.priority === "NORMAL" && (
                              <Button
                                variant="secondary"
                                size="md"
                                icon={<ArrowUpCircle className="size-3.5" aria-hidden />}
                                loading={boostMutation.isPending && boostMutation.variables === entry.token.id}
                                onClick={() => boostMutation.mutate(entry.token.id)}
                              >
                                Boost
                              </Button>
                            )}
                            {status === "CALLED" && (
                              <>
                                <Button
                                  variant="secondary"
                                  size="md"
                                  icon={<CheckCircle2 className="size-3.5" aria-hidden />}
                                  loading={completeMutation.isPending && completeMutation.variables === entry.token.id}
                                  onClick={() => completeMutation.mutate(entry.token.id)}
                                >
                                  Complete
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="md"
                                  icon={<PhoneMissed className="size-3.5" aria-hidden />}
                                  loading={missedMutation.isPending && missedMutation.variables === entry.token.id}
                                  onClick={() => missedMutation.mutate(entry.token.id)}
                                >
                                  Missed
                                </Button>
                              </>
                            )}
                            {status === "MISSED" && (
                              <Button
                                variant="secondary"
                                size="md"
                                icon={<Repeat className="size-3.5" aria-hidden />}
                                loading={recallMutation.isPending && recallMutation.variables === entry.token.id}
                                onClick={() => recallMutation.mutate(entry.token.id)}
                              >
                                Recall
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="md"
                              icon={<X className="size-3.5" aria-hidden />}
                              onClick={() => {
                                setCancellingId(entry.token.id);
                                setCancelReason("");
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
