import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/auth/AuthContext";
import { canTakeVitals } from "@/auth/roles";
import {
  ArrowRightLeft,
  ArrowUpCircle,
  CheckCircle2,
  HeartPulse,
  PhoneCall,
  PhoneMissed,
  Printer,
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
  reactivateToken,
  transferToken,
  updateTokenPriority,
  type QueueEntry,
  type QueueActionReason,
  type TokenStatus,
} from "@/shared/api/queue";
import { getFacilities } from "@/shared/api/facilities";
import { printQueueTicket } from "@/shared/lib/printTicket";
import { ApiError } from "@/shared/api/client";
import { Card } from "@/shared/components/Card";
import { Button } from "@/shared/components/Button";
import { PageHeader } from "@/shared/components/PageHeader";
import { RowActionsMenu, type RowActionItem } from "@/shared/components/RowActionsMenu";
import { StatusPill, type PillTone } from "@/shared/components/StatusPill";
import { Switch } from "@/shared/components/Switch";

const SPEAKER_STORAGE_KEY = "queue.speakerEnabled";
const ALL_STATUSES: TokenStatus[] = ["ISSUED", "CALLED", "MISSED", "COMPLETED", "CANCELLED"];

// Priority-escalation reasons — why someone should be bumped up (boost) or
// let back in (reactivate). Backed by QueueActionReason, the same enum the
// backend validates for both those actions.
const REASON_OPTIONS: Array<{ value: QueueActionReason; label: string }> = [
  { value: "CLINICAL_CONCERN", label: "Clinical concern" },
  { value: "ELDERLY_PATIENT", label: "Elderly patient" },
  { value: "PREGNANCY", label: "Pregnancy" },
  { value: "DISABILITY_OR_MOBILITY", label: "Disability or mobility assistance" },
  { value: "YOUNG_CHILD", label: "Young child" },
  { value: "RETURNED_AFTER_MISSED_CALL", label: "Returned after missed call" },
  { value: "CLINICIAN_REQUEST", label: "Clinician request" },
  { value: "OTHER", label: "Other" },
];

// Cancellation reasons — a different vocabulary from the above (why a
// ticket is being given up entirely, not why someone deserves priority).
// Frontend-only: the backend's cancel endpoint just takes a free-text
// reason string, not this enum, so these values only ever exist here, to
// build that string's label.
type CancelReason =
  | "PATIENT_LEFT"
  | "DUPLICATE_TICKET"
  | "REGISTERED_IN_ERROR"
  | "PATIENT_REQUEST"
  | "REFERRED_ELSEWHERE"
  | "OTHER";

const CANCEL_REASON_OPTIONS: Array<{ value: CancelReason; label: string }> = [
  { value: "PATIENT_LEFT", label: "Patient left before being seen" },
  { value: "DUPLICATE_TICKET", label: "Duplicate ticket" },
  { value: "REGISTERED_IN_ERROR", label: "Registered in error" },
  { value: "PATIENT_REQUEST", label: "Patient request" },
  { value: "REFERRED_ELSEWHERE", label: "Referred elsewhere" },
  { value: "OTHER", label: "Other" },
];

type ReasonAction = "boost" | "reactivate" | "cancel";

function localDateValue(date = new Date()): string {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

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

// One row's worth of RowActionItems, status-gated the same way the old
// inline button row was — each condition below matches exactly what used
// to guard a separate <Button>, just collected into one list for
// RowActionsMenu instead of a wall of buttons down the row (up to 7 for a
// CALLED token with multi-facility transfer enabled).
function buildRowActions(params: {
  entry: QueueEntry;
  status: TokenStatus;
  canTransfer: boolean;
  canTakeVitals: boolean;
  onPrint: () => void;
  onTransfer: () => void;
  onBoost: () => void;
  onVitals: () => void;
  onReplayCall: () => void;
  onComplete: () => void;
  completeLoading: boolean;
  onMissed: () => void;
  missedLoading: boolean;
  onReactivate: () => void;
  onCancel: () => void;
}): RowActionItem[] {
  const { entry, status, canTransfer } = params;
  const items: RowActionItem[] = [
    { key: "print", label: "Print", icon: <Printer className="size-4" aria-hidden />, onClick: params.onPrint },
  ];
  if ((status === "ISSUED" || status === "CALLED" || status === "MISSED") && canTransfer) {
    items.push({
      key: "transfer",
      label: "Transfer",
      icon: <ArrowRightLeft className="size-4" aria-hidden />,
      onClick: params.onTransfer,
    });
  }
  if (status === "ISSUED" && entry.token.priority === "NORMAL") {
    items.push({
      key: "boost",
      label: "Boost priority",
      icon: <ArrowUpCircle className="size-4" aria-hidden />,
      onClick: params.onBoost,
    });
  }
  if (params.canTakeVitals && (status === "ISSUED" || status === "CALLED")) {
    items.push({
      key: "vitals",
      label: "Vitals",
      icon: <HeartPulse className="size-4" aria-hidden />,
      onClick: params.onVitals,
    });
  }
  if (status === "CALLED") {
    items.push({
      key: "replay",
      label: "Replay call",
      icon: <Repeat className="size-4" aria-hidden />,
      onClick: params.onReplayCall,
    });
    items.push({
      key: "complete",
      label: "Complete",
      icon: <CheckCircle2 className="size-4" aria-hidden />,
      loading: params.completeLoading,
      onClick: params.onComplete,
    });
    items.push({
      key: "missed",
      label: "Missed",
      icon: <PhoneMissed className="size-4" aria-hidden />,
      loading: params.missedLoading,
      onClick: params.onMissed,
    });
  }
  if (status === "MISSED" || status === "CANCELLED") {
    items.push({
      key: "reactivate",
      label: "Reactivate",
      icon: <Repeat className="size-4" aria-hidden />,
      onClick: params.onReactivate,
    });
  }
  if (status === "ISSUED" || status === "CALLED" || status === "MISSED") {
    items.push({
      key: "cancel",
      label: "Cancel",
      icon: <X className="size-4" aria-hidden />,
      variant: "danger",
      onClick: params.onCancel,
    });
  }
  return items;
}

// RECQ-US-001/002/004/005/007/015's staff-facing queue console —
// facility-scoped (no Station entity exists yet, RECQ-US-012 is Sprint 4,
// so a facility stands in for "which queue"), same reasoning
// QueueController's own why-note gives for why facilityId is always
// explicit rather than assumed from the caller's own profile. The list
// itself is always today's queue only (server-enforced, QueueService's day
// bounds) — there's no client control to look at another day.
export function QueuePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [facilityId, setFacilityId] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [justCalled, setJustCalled] = useState<QueueEntry | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statuses, setStatuses] = useState<TokenStatus[]>(["ISSUED", "CALLED", "MISSED"]);
  const [priority, setPriority] = useState<"" | "NORMAL" | "PRIORITY">("");
  const [date, setDate] = useState(localDateValue);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [speakerEnabled, setSpeakerEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SPEAKER_STORAGE_KEY) !== "off";
    } catch {
      return true;
    }
  });
  const [reasonAction, setReasonAction] = useState<{ tokenId: string; action: ReasonAction } | null>(null);
  // Separately typed rather than one shared field: boost/reactivate and
  // cancel draw from genuinely different reason vocabularies (see
  // REASON_OPTIONS vs CANCEL_REASON_OPTIONS above) — a single field wide
  // enough to hold either would need casts at every use site instead of
  // just picking the right one of these two here.
  const [priorityReasonCode, setPriorityReasonCode] = useState<QueueActionReason>("CLINICAL_CONCERN");
  const [cancelReasonCode, setCancelReasonCode] = useState<CancelReason>("PATIENT_LEFT");
  const [reasonNote, setReasonNote] = useState("");
  const [transferTokenId, setTransferTokenId] = useState<string | null>(null);
  const [transferFacilityId, setTransferFacilityId] = useState("");
  const [transferNote, setTransferNote] = useState("");

  const facilitiesQuery = useQuery({ queryKey: ["facilities"], queryFn: getFacilities });

  useEffect(() => {
    if (!facilityId && facilitiesQuery.data && facilitiesQuery.data.length > 0) {
      setFacilityId(facilitiesQuery.data[0].id);
    }
  }, [facilityId, facilitiesQuery.data]);

  // RECQ-US-007 — search runs server-side; debounced so typing doesn't
  // fire a request per keystroke.
  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(0);
    }, 300);
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

  const queueQuery = useQuery({
    queryKey: ["queue", facilityId, search, statuses, priority, date, page, pageSize],
    queryFn: () => listQueue(facilityId, {
      search: search || undefined,
      statuses,
      priority: priority || undefined,
      date,
      page,
      pageSize,
    }),
    enabled: !!facilityId,
    refetchInterval: 5000,
  });

  // Guards against a dead end: this page polls every 5s, and other staff
  // resolving tickets can shrink the result set out from under whichever
  // page someone's parked on. Without this, landing on a now-empty page
  // swaps the whole table for the "no tickets" empty state — which has no
  // pagination controls — stranding them with no way back to page 1.
  useEffect(() => {
    const totalPages = queueQuery.data?.totalPages;
    if (totalPages !== undefined && totalPages > 0 && page >= totalPages) {
      setPage(totalPages - 1);
    }
  }, [queueQuery.data, page]);

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
    mutationFn: ({ tokenId, reasonCode, reasonNote }: { tokenId: string; reasonCode: QueueActionReason; reasonNote?: string }) =>
      updateTokenPriority(tokenId, "PRIORITY", { reasonCode, reasonNote }),
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

  const reactivateMutation = useMutation({
    mutationFn: ({ tokenId, reasonCode, reasonNote }: { tokenId: string; reasonCode: QueueActionReason; reasonNote?: string }) =>
      reactivateToken(tokenId, { reasonCode, reasonNote }),
    onMutate: () => setActionError(null),
    onSuccess: invalidateQueue,
    onError: (error) => {
      setActionError(error instanceof ApiError ? error.message : "Couldn't reactivate that token. Try again.");
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
      setReasonAction(null);
      setReasonNote("");
      invalidateQueue();
    },
    onError: (error) => {
      setActionError(error instanceof ApiError ? error.message : "Couldn't cancel that token. Try again.");
    },
  });

  // Cancels the current ticket and issues a new one at destinationFacilityId
  // — the mutation result is the NEW token, at the destination facility, not
  // the one just cancelled, so it only affects the current facility's view
  // by making its cancelled row disappear on the next refetch.
  const transferMutation = useMutation({
    mutationFn: ({
      tokenId,
      destinationFacilityId,
      reason,
    }: {
      tokenId: string;
      destinationFacilityId: string;
      reason?: string;
    }) => transferToken(tokenId, destinationFacilityId, reason),
    onMutate: () => setActionError(null),
    onSuccess: () => {
      setTransferTokenId(null);
      setTransferFacilityId("");
      setTransferNote("");
      invalidateQueue();
    },
    onError: (error) => {
      setActionError(error instanceof ApiError ? error.message : "Couldn't transfer that ticket. Try again.");
    },
  });

  const facilities = facilitiesQuery.data ?? [];
  const queue = queueQuery.data?.items ?? [];
  // Every row action (boost, call handling, complete, missed, reactivate,
  // cancel) only makes sense against today's live queue — call-next,
  // reactivate, etc. are all bounded to "today" server-side regardless of
  // which date is being viewed here. Without this, browsing a past date
  // via the date picker still showed live action buttons on tickets from
  // days ago, which either silently did nothing useful (boosting a token
  // that can never be called again) or worked but shouldn't have
  // (cancelling a stray historical ticket from the wrong screen).
  const isToday = date === localDateValue();

  function openReasonAction(tokenId: string, action: ReasonAction) {
    setTransferTokenId(null);
    setReasonAction({ tokenId, action });
    setPriorityReasonCode(action === "reactivate" ? "RETURNED_AFTER_MISSED_CALL" : "CLINICAL_CONCERN");
    setCancelReasonCode("PATIENT_LEFT");
    setReasonNote("");
  }

  function openTransfer(tokenId: string, currentFacilityId: string) {
    setReasonAction(null);
    setTransferTokenId(tokenId);
    setTransferFacilityId(facilities.find((f) => f.id !== currentFacilityId)?.id ?? "");
    setTransferNote("");
  }

  function submitTransfer() {
    if (!transferTokenId || !transferFacilityId) return;
    transferMutation.mutate({
      tokenId: transferTokenId,
      destinationFacilityId: transferFacilityId,
      reason: transferNote.trim() || undefined,
    });
  }

  function submitReasonAction() {
    if (!reasonAction) return;
    if (reasonAction.action === "cancel") {
      if (cancelReasonCode === "OTHER" && !reasonNote.trim()) return;
      const label = CANCEL_REASON_OPTIONS.find((option) => option.value === cancelReasonCode)?.label ?? cancelReasonCode;
      cancelMutation.mutate({
        tokenId: reasonAction.tokenId,
        reason: reasonNote.trim() ? `${label}: ${reasonNote.trim()}` : label,
      });
      return;
    }
    if (priorityReasonCode === "OTHER" && !reasonNote.trim()) return;
    const variables = {
      tokenId: reasonAction.tokenId,
      reasonCode: priorityReasonCode,
      reasonNote: reasonNote.trim() || undefined,
    };
    if (reasonAction.action === "boost") boostMutation.mutate(variables);
    if (reasonAction.action === "reactivate") reactivateMutation.mutate(variables);
    setReasonAction(null);
  }

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
                onChange={(e) => {
                  setFacilityId(e.target.value);
                  setPage(0);
                }}
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

      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative min-w-64 flex-1">
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
          <label className="flex flex-col gap-1 text-[12px] font-medium text-text-secondary">
            Date (view history)
            <input
              type="date"
              value={date}
              max={localDateValue()}
              onChange={(e) => { setDate(e.target.value); setPage(0); }}
              className="h-11 rounded-lg border border-border-strong bg-surface-raised px-3 text-[14px] text-text-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-medium text-text-secondary">
            Priority
            <select
              value={priority}
              onChange={(e) => { setPriority(e.target.value as typeof priority); setPage(0); }}
              className="h-11 rounded-lg border border-border-strong bg-surface-raised px-3 text-[14px] text-text-primary"
            >
              <option value="">All priorities</option>
              <option value="PRIORITY">Priority</option>
              <option value="NORMAL">Normal</option>
            </select>
          </label>
          <Button variant="secondary" size="md" onClick={() => { setDate(localDateValue()); setPage(0); }}>
            Today
          </Button>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Filter queue by status">
          {ALL_STATUSES.map((status) => {
            const selected = statuses.includes(status);
            return (
              <button
                type="button"
                key={status}
                aria-pressed={selected}
                onClick={() => {
                  setStatuses((current) => selected ? current.filter((item) => item !== status) : [...current, status]);
                  setPage(0);
                }}
                className={`rounded-full border px-3 py-1.5 text-[12.5px] font-medium ${selected ? "border-brand-500 bg-brand-50 text-brand-700" : "border-border-strong bg-surface-raised text-text-secondary"}`}
              >
                {STATUS_LABEL[status]}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => { setStatuses([]); setPage(0); }}
            className="rounded-full border border-border-strong bg-surface-raised px-3 py-1.5 text-[12.5px] font-medium text-text-secondary"
          >
            All statuses
          </button>
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        {!isToday && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-100 bg-brand-50 px-5 py-2.5 text-[13.5px] text-brand-700">
            <span>
              Viewing history for {new Date(`${date}T00:00:00`).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })} — read-only, no queue actions available.
            </span>
            <Button variant="ghost" size="md" onClick={() => { setDate(localDateValue()); setPage(0); }}>
              Back to today
            </Button>
          </div>
        )}
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
              {search ? "No tickets match the current search and filters." : "No tickets match the current filters."}
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
                  const isChoosingReason = reasonAction?.tokenId === entry.token.id;
                  const isCancelChoice = reasonAction?.action === "cancel";
                  const isTransferring = transferTokenId === entry.token.id;
                  const transferTargets = facilities.filter((f) => f.id !== entry.token.facilityId);
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
                        {!isToday ? (
                          <span className="text-[12.5px] text-text-secondary" aria-hidden>
                            —
                          </span>
                        ) : isChoosingReason ? (
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <select
                              value={isCancelChoice ? cancelReasonCode : priorityReasonCode}
                              onChange={(e) =>
                                isCancelChoice
                                  ? setCancelReasonCode(e.target.value as CancelReason)
                                  : setPriorityReasonCode(e.target.value as QueueActionReason)
                              }
                              aria-label="Reason"
                              className="h-9 rounded-lg border border-border-strong bg-surface-raised px-2 text-[13px] text-text-primary"
                            >
                              {(isCancelChoice ? CANCEL_REASON_OPTIONS : REASON_OPTIONS).map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            {(isCancelChoice ? cancelReasonCode : priorityReasonCode) === "OTHER" && (
                              <input
                                type="text"
                                value={reasonNote}
                                onChange={(e) => setReasonNote(e.target.value)}
                                placeholder="Enter reason"
                                aria-label="Other reason"
                                className="h-9 w-44 rounded-lg border border-border-strong bg-surface-raised px-3 text-[13px] text-text-primary"
                              />
                            )}
                            <Button
                              variant="secondary"
                              size="md"
                              disabled={(isCancelChoice ? cancelReasonCode : priorityReasonCode) === "OTHER" && !reasonNote.trim()}
                              loading={boostMutation.isPending || reactivateMutation.isPending || cancelMutation.isPending}
                              onClick={submitReasonAction}
                            >
                              Confirm {reasonAction?.action}
                            </Button>
                            <Button
                              variant="ghost"
                              size="md"
                              onClick={() => {
                                setReasonAction(null);
                                setReasonNote("");
                              }}
                            >
                              Back
                            </Button>
                          </div>
                        ) : isTransferring ? (
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <select
                              value={transferFacilityId}
                              onChange={(e) => setTransferFacilityId(e.target.value)}
                              aria-label="Destination facility"
                              className="h-9 rounded-lg border border-border-strong bg-surface-raised px-2 text-[13px] text-text-primary"
                            >
                              {transferTargets.map((f) => (
                                <option key={f.id} value={f.id}>
                                  {f.name}
                                </option>
                              ))}
                            </select>
                            <input
                              type="text"
                              value={transferNote}
                              onChange={(e) => setTransferNote(e.target.value)}
                              placeholder="Reason (optional)"
                              aria-label="Transfer reason"
                              className="h-9 w-44 rounded-lg border border-border-strong bg-surface-raised px-3 text-[13px] text-text-primary"
                            />
                            <Button
                              variant="secondary"
                              size="md"
                              disabled={!transferFacilityId}
                              loading={transferMutation.isPending}
                              onClick={submitTransfer}
                            >
                              Confirm transfer
                            </Button>
                            <Button
                              variant="ghost"
                              size="md"
                              onClick={() => {
                                setTransferTokenId(null);
                                setTransferNote("");
                              }}
                            >
                              Back
                            </Button>
                          </div>
                        ) : (
                          <RowActionsMenu
                            label={`Actions for token #${entry.token.tokenNumber}`}
                            items={buildRowActions({
                              entry,
                              status,
                              canTransfer: facilities.length > 1,
                              canTakeVitals: canTakeVitals(user?.role),
                              onPrint: () => printQueueTicket(entry.token.id),
                              onTransfer: () => openTransfer(entry.token.id, entry.token.facilityId),
                              onBoost: () => openReasonAction(entry.token.id, "boost"),
                              onVitals: () =>
                                navigate(`/app/patients/${entry.patientId}?visitId=${entry.token.visitId}`),
                              onReplayCall: () => announce(entry.token.tokenNumber),
                              onComplete: () => completeMutation.mutate(entry.token.id),
                              completeLoading:
                                completeMutation.isPending && completeMutation.variables === entry.token.id,
                              onMissed: () => missedMutation.mutate(entry.token.id),
                              missedLoading:
                                missedMutation.isPending && missedMutation.variables === entry.token.id,
                              onReactivate: () => openReasonAction(entry.token.id, "reactivate"),
                              onCancel: () => openReasonAction(entry.token.id, "cancel"),
                            })}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle px-5 py-3">
              <p className="text-[12.5px] text-text-secondary">
                {queueQuery.data?.totalElements ?? 0} tickets · Page {(queueQuery.data?.page ?? 0) + 1} of {Math.max(queueQuery.data?.totalPages ?? 0, 1)}
              </p>
              <div className="flex items-center gap-2">
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
                  aria-label="Tickets per page"
                  className="h-9 rounded-lg border border-border-strong bg-surface-raised px-2 text-[13px] text-text-primary"
                >
                  <option value={25}>25 per page</option>
                  <option value={50}>50 per page</option>
                  <option value={100}>100 per page</option>
                </select>
                <Button variant="secondary" size="md" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  disabled={page + 1 >= (queueQuery.data?.totalPages ?? 0)}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
