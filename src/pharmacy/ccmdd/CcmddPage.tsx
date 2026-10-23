import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCheck, Clock3, MapPin, PackageCheck, RefreshCw, Send, Truck } from "lucide-react";
import { Button } from "@/shared/components/Button";
import { Input } from "@/shared/components/Input";
import { Select } from "@/shared/components/Select";
import { PageHeader } from "@/shared/components/PageHeader";
import {
  dispatchCcmddParcel, getCcmddConfig, getCcmddParcels, getCcmddPickupPoints, getCcmddTracing,
  recordCcmddTrace, refreshCcmddPickupPoints, resendCcmddNotice, updateCcmddStatus,
  type CcmddParcel, type ParcelStatus, type PickupFilters, type PickupPoint,
} from "@/shared/api/ccmdd";
import { useFacilitySelection } from "../lib/useFacilitySelection";
import { describeError } from "../lib/problem";
import { formatCcmddDate, validTracingDays } from "./ccmddValidation";

type Tab = "parcels" | "directory" | "tracing";
const when = formatCcmddDate;

export function CcmddPage() {
  const [tab, setTab] = useState<Tab>("directory");
  const [serial, setSerial] = useState("");
  const [selectedPoint, setSelectedPoint] = useState<PickupPoint | null>(null);
  const [days, setDays] = useState("7");
  const [filters, setFilters] = useState<PickupFilters>({ q: "", province: "", district: "", area: "" });
  const [searchParcel, setSearchParcel] = useState("");
  const [busy, setBusy] = useState("");
  // A ref closes the gap between a click and React updating the disabled state.
  const mutationInFlight = useRef(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const { facilities, facilityId: requestedFacilityId, selectFacility, isLoading: facilitiesLoading,
    error: facilityError, refetch: refetchFacilities } = useFacilitySelection();
  // Old shared URLs and tenant switches can leave a facility ID the user cannot access.
  // Never send that stale value to the API: use the first authorised facility instead.
  const facilityId = facilities.find((facility) => facility.id === requestedFacilityId)?.id ?? facilities[0]?.id ?? "";
  const queryClient = useQueryClient();
  const pointQuery = useQuery({ queryKey: ["ccmdd", "points", filters], queryFn: () => getCcmddPickupPoints(filters), staleTime: 60_000 });
  // Directory searches must not remove locations from the dispatch selector.
  const dispatchPointQuery = useQuery({ queryKey: ["ccmdd", "points", {}], queryFn: () => getCcmddPickupPoints({}), staleTime: 60_000 });
  const parcelQuery = useQuery({ queryKey: ["ccmdd", "parcels", facilityId], queryFn: () => getCcmddParcels(facilityId), enabled: !!facilityId });
  const tracingQuery = useQuery({ queryKey: ["ccmdd", "tracing", facilityId], queryFn: () => getCcmddTracing(facilityId), enabled: !!facilityId });
  const configQuery = useQuery({ queryKey: ["ccmdd", "config"], queryFn: getCcmddConfig, staleTime: Infinity });
  useEffect(() => { if (configQuery.data?.tracingDays) setDays(String(configQuery.data.tracingDays)); }, [configQuery.data?.tracingDays]);

  function clearMessages() { setError(""); setSuccess(""); }
  async function run(key: string, action: () => Promise<unknown>, message: string) {
    if (mutationInFlight.current) return false;
    mutationInFlight.current = true;
    clearMessages(); setBusy(key);
    try {
      await action();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["ccmdd", "parcels"] }),
        queryClient.invalidateQueries({ queryKey: ["ccmdd", "tracing"] }),
      ]);
      setSuccess(message);
      return true;
    } catch (e) { setError(describeError(e)); return false; }
    finally { mutationInFlight.current = false; setBusy(""); }
  }
  async function submitDispatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!facilityId || !selectedPoint) { setError("Choose a facility and a valid SYNCH pick-up point."); return; }
    if (!serial.trim()) { setError("Enter the dispensed prescription number."); return; }
    if (!validTracingDays(days)) { setError("Tracing days must be a whole number between 1 and 90."); return; }
    const dispatched = await run("dispatch", () => dispatchCcmddParcel({
      facilityId, prescriptionSerial: serial.trim(), pickupPointId: selectedPoint.id, tracingDays: Number(days),
    }), "Parcel dispatched and pick-up point notification processed. Check the notification status below.");
    if (dispatched) setSerial("");
  }
  async function refreshDirectory() {
    let response: Awaited<ReturnType<typeof refreshCcmddPickupPoints>> | undefined;
    const completed = await run("refresh", async () => {
      response = await refreshCcmddPickupPoints(filters);
      await queryClient.invalidateQueries({ queryKey: ["ccmdd", "points"] });
      queryClient.setQueryData(["ccmdd", "points", filters], response);
      const returnedPoints = Array.isArray(response.items) ? response.items : [];
      setSelectedPoint((point) => {
        if (!point) return null;
        const updated = returnedPoints.find((entry) => entry.id === point.id);
        const filtered = Object.values(filters).some((value) => value?.trim());
        return updated ?? (filtered ? point : null);
      });
    }, "SYNCH pick-up points refreshed successfully.");
    if (completed && response?.source !== "SYNCH_LIVE") {
      setSuccess("");
      setError(response?.configured
        ? "SYNCH refresh did not succeed. Previously cached pick-up points are retained, if available. Check the status below."
        : "SYNCH is not configured. An administrator must configure the directory connection before live pick-up points can be loaded.");
    }
  }

  const directory = pointQuery.data;
  // Defensive rendering: malformed/unexpected responses should raise a useful error,
  // not crash the entire Pharmacy route with `.map is not a function`.
  const pointOptions = Array.isArray(directory?.items) ? directory.items : [];
  const dispatchDirectory = dispatchPointQuery.data;
  const allPoints = Array.isArray(dispatchDirectory?.items) ? dispatchDirectory.items : [];
  const dispatchPoints = selectedPoint && !allPoints.some((p) => p.id === selectedPoint.id)
    ? [selectedPoint, ...allPoints] : allPoints;
  const parcels = Array.isArray(parcelQuery.data) ? parcelQuery.data : [];
  const tracing = Array.isArray(tracingQuery.data) ? tracingQuery.data : [];
  const matchingParcels = parcels.filter((p) =>
    [p.trackingReference, p.patientName, p.patientMpi, p.pickupPoint?.name].filter(Boolean).join(" ").toLowerCase()
      .includes(searchParcel.trim().toLowerCase()));
  const rowErrors = [...new Set([
    pointQuery.error, dispatchPointQuery.error, parcelQuery.error, tracingQuery.error, configQuery.error, facilityError,
  ].filter(Boolean).map((err) => describeError(err)))];
  if (directory && !Array.isArray(directory.items)) rowErrors.push("The SYNCH directory returned an invalid response. Please refresh it.");
  if (parcelQuery.data && !Array.isArray(parcelQuery.data)) rowErrors.push("The parcel list returned an invalid response.");
  if (tracingQuery.data && !Array.isArray(tracingQuery.data)) rowErrors.push("The tracing list returned an invalid response.");

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="CCMDD parcels & pick-up points"
      
        action={facilities.length > 1 ? <Select label="Facility" value={facilityId}
          options={facilities.map((f) => ({ value: f.id, label: f.name }))}
          onChange={(e) => selectFacility(e.target.value)} /> : undefined} />

      <div className="grid gap-3 sm:grid-cols-3" aria-label="CCMDD summary">
        <Summary label="Tracked parcels" number={parcels.length} icon={<Truck className="size-5" />} />
        <Summary label="Collected parcels" number={parcels.filter((p) => p.status === "COLLECTED").length} icon={<CheckCheck className="size-5" />} />
        <Summary label="Overdue for tracing" number={tracing.length} icon={<AlertTriangle className="size-5" />} />
      </div>
      {!facilitiesLoading && !facilityError && facilities.length === 0 && <div role="alert" className="rounded-lg border border-amber-500 p-3 text-sm text-amber-800">
        No facility is assigned to this account. Ask your administrator to assign a facility before tracking CCMDD parcels.
      </div>}
      {error && <div role="alert" className="rounded-lg border border-danger-500 bg-surface-raised p-3 text-sm text-danger-500">{error}</div>}
      {success && <div role="status" className="rounded-lg border border-border-subtle bg-surface-raised p-3 text-sm text-text-primary">{success}</div>}
      {rowErrors.length > 0 && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-danger-500 p-3 text-sm text-danger-500">
        <span>{rowErrors.join(" · ")}</span>
        <Button type="button" variant="secondary" size="md" onClick={() => {
          void refetchFacilities(); void pointQuery.refetch(); void dispatchPointQuery.refetch(); void configQuery.refetch();
          if (facilityId) { void parcelQuery.refetch(); void tracingQuery.refetch(); }
        }}>Retry loading</Button>
      </div>}
      <nav aria-label="CCMDD workflow" className="flex flex-wrap gap-2">
        {([ ["parcels", "Parcel status tracking"], ["directory", "SYNCH pick-up points"], ["tracing", "Uncollected tracing list"] ] as const).map(([key, label]) => (
          <button key={key} type="button" aria-current={tab === key ? "page" : undefined}
            onClick={() => { setTab(key); clearMessages(); }}
            className={`rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors ${tab === key ? "border-brand-500 bg-brand-50 text-brand-700" : "border-border-subtle bg-surface-raised text-text-secondary hover:text-text-primary"}`}>
            {label}{key === "tracing" && tracing.length ? ` (${tracing.length})` : ""}
          </button>
        ))}
      </nav>

      {tab === "parcels" && <>
        <section className="rounded-xl border border-border-subtle bg-surface-raised p-5" aria-label="Dispatch new parcel">
          <div className="mb-4 flex items-center gap-2"><Send className="size-5 text-brand-600" /><h2 className="text-lg font-semibold">Dispatch CCMDD parcel</h2></div>
          <p className="mb-4 text-sm text-text-secondary">Select a prescription that is fully dispensed and an active SYNCH pick-up point. The registered point will be notified when an email address is available.</p>
          <form onSubmit={(e) => { void submitDispatch(e); }} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Input label="Dispensed prescription number" value={serial} required placeholder="RX-..."
              onChange={(e) => setSerial(e.target.value)} />
            <Select label="Collection pick-up point" value={selectedPoint?.id ?? ""} required
              options={dispatchPoints.map((p) => ({ value: p.id, label: `${p.name} (${p.area || p.district || p.province || p.synchId})` }))}
              disabled={!dispatchPoints.length || !!busy}
              onChange={(e) => setSelectedPoint(dispatchPoints.find((p) => p.id === e.target.value) ?? null)} />
            <Input label="Tracing after (days)" type="number" min={1} max={90} required value={days} onChange={(e) => setDays(e.target.value)} />
            <div className="flex items-end"><Button type="submit" icon={<Send className="size-4" />} loading={busy === "dispatch"}
              disabled={!!busy || !facilityId || !selectedPoint || !serial.trim() || !validTracingDays(days)}>Dispatch parcel</Button></div>
          </form>
          {dispatchPointQuery.isLoading && <p className="mt-3 text-sm" role="status">Loading collection pick-up points…</p>}
          {!dispatchPointQuery.isLoading && !dispatchPointQuery.isError && !dispatchPoints.length && <p className="mt-3 text-sm text-text-secondary">
            {dispatchDirectory?.configured === false
              ? "SYNCH is not configured. Ask your administrator to configure the directory connection before dispatching parcels."
              : "No active pick-up points are available. Check the SYNCH directory connection and refresh the list."}
            {" "}<button type="button" className="text-brand-700 underline" onClick={() => setTab("directory")}>Open SYNCH directory</button>
          </p>}
          {dispatchDirectory?.stale && dispatchPoints.length > 0 && <p className="mt-3 text-sm text-amber-700">The directory is cached. Verify the selected point before dispatch. <button type="button" className="underline" onClick={() => setTab("directory")}>View sync status</button>.</p>}
        </section>
        <section className="rounded-xl border border-border-subtle bg-surface-raised p-5" aria-label="Parcel status tracking">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Parcel tracking</h2>
            <Button variant="secondary" onClick={() => { void parcelQuery.refetch(); void tracingQuery.refetch(); }} icon={<RefreshCw className="size-4" />}>Refresh</Button></div>
          <div className="mb-4 max-w-sm"><Input label="Search parcels" value={searchParcel} placeholder="Reference, name, MPI or pick-up point" onChange={(e) => setSearchParcel(e.target.value)} /></div>
          {parcelQuery.isLoading && <p role="status">Loading parcels…</p>}
          {!parcelQuery.isLoading && !parcelQuery.isError && !matchingParcels.length && <p className="py-6 text-center text-sm text-text-secondary">No matching CCMDD parcels yet. Dispatch a parcel to begin tracking.</p>}
          <div className="grid gap-3">{matchingParcels.map((p) => <ParcelCard key={p.id} parcel={p} busy={busy} onAction={(status) =>
            void run(p.id, () => updateCcmddStatus(p.id, facilityId, status), `Parcel ${p.trackingReference} updated to ${status.toLowerCase()}.`)}
            onNotify={() => void run(p.id, () => resendCcmddNotice(p.id, facilityId), "Notification request processed. Check its queue status below.")} />)}</div>
        </section>
      </>}

      {tab === "directory" && <section className="rounded-xl border border-border-subtle bg-surface-raised p-5" aria-label="SYNCH national pick-up point list">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-lg font-semibold">National CCMDD pick-up point directory</h2>
            <p className="mt-1 text-sm text-text-secondary">Search the SYNCH national master list by name or code, or filter by province, district and area. Choose an active location to assign it to a parcel.</p></div>
          <Button variant="secondary" loading={busy === "refresh"} icon={<RefreshCw className="size-4" />}
            disabled={!!busy} onClick={() => { void refreshDirectory(); }}>Refresh from SYNCH</Button>
        </div>
        {directory && <div role="status" className={`mb-4 rounded-lg border px-4 py-3 text-sm ${directory.stale ? "border-amber-500 bg-surface-raised text-amber-800" : "border-border-subtle bg-surface-sunken text-text-primary"}`}>
          <strong>{directory.source === "SYNCH_LIVE" ? "SYNCH live refresh" : directory.source === "CACHED" ? "Cached SYNCH master list" : "SYNCH directory unavailable"}</strong>
          {directory.stale && <span> — STALE / NOT VERIFIED</span>}
          <span className="block">Last successful sync: {when(directory.lastSuccessfulSync)} · Cache refresh period: {directory.cacheMinutes} min</span>
          {!directory.configured && <span className="block">The SYNCH connection is not configured. Contact your administrator to enable directory synchronization.</span>}
          {directory.fallback && directory.configured && <span className="block">Live synchronization failed; the last successful list is used if available.</span>}
        </div>}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Input label="Search name or code" placeholder="Pick-up point…" value={filters.q ?? ""} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} />
          <Input label="Province" placeholder="Gauteng" value={filters.province ?? ""} onChange={(e) => setFilters((f) => ({ ...f, province: e.target.value }))} />
          <Input label="District" placeholder="District / municipality" value={filters.district ?? ""} onChange={(e) => setFilters((f) => ({ ...f, district: e.target.value }))} />
          <Input label="Area" placeholder="Suburb or area" value={filters.area ?? ""} onChange={(e) => setFilters((f) => ({ ...f, area: e.target.value }))} />
        </div>
        {pointQuery.isLoading && <p className="mt-4" role="status">Searching SYNCH pick-up points…</p>}
        {directory && <p className="my-4 text-sm text-text-secondary">{pointOptions.length} matching active pick-up point(s) (up to 300 shown).</p>}
        {!pointQuery.isFetching && !pointQuery.isError && directory && Array.isArray(directory.items) && pointOptions.length === 0 && <p role="status" className="my-4 rounded-lg border border-border-subtle p-4 text-sm text-text-secondary">
          {directory.source === "UNAVAILABLE" ? "No cached SYNCH directory is available yet. Locations will appear after the first successful synchronization." : "No active pick-up points match these filters. Try a different area or clear the filters."}
        </p>}
        <div className="grid gap-3 md:grid-cols-2">{pointOptions.map((p) => <div key={p.id} className="rounded-lg border border-border-subtle p-4">
          <h3 className="flex items-center gap-2 font-semibold"><MapPin className="size-4 text-brand-600" />{p.name}</h3>
          <p className="mt-1 text-sm text-text-secondary">SYNCH ID: {p.synchId}</p>
          <p className="text-sm text-text-secondary">{[p.area, p.district, p.province].filter(Boolean).join(", ") || "Area not provided"}</p>
          <p className="text-sm text-text-secondary">{p.address || "No address supplied"}</p>
          <p className="mt-2 text-xs text-text-secondary">{p.contactEmail ? "Notification contact registered" : "No notification email provided"}</p>
          <Button variant="secondary" size="md" className="mt-3" onClick={() => { setSelectedPoint(p); setTab("parcels"); }}>Assign to parcel</Button>
        </div>)}</div>
      </section>}

      {tab === "tracing" && <section className="rounded-xl border border-border-subtle bg-surface-raised p-5" aria-label="Uncollected parcel tracing worklist">
        <div className="mb-3 flex items-center gap-2"><Clock3 className="size-5 text-brand-600" /><h2 className="text-lg font-semibold">Uncollected tracing work list</h2></div>
        <p className="mb-4 text-sm text-text-secondary">Parcels automatically appear when uncollected past their configured tracing date. Recording a contact attempt does not remove them until collected or returned.</p>
        {tracingQuery.isLoading && <p role="status">Checking overdue parcels…</p>}
        {!tracingQuery.isLoading && !tracingQuery.isError && !tracing.length && <p className="rounded-lg border border-border-subtle p-6 text-center text-sm text-text-secondary">No overdue parcels requiring tracing.</p>}
        <div className="grid gap-4">{tracing.map((p) => <div key={p.id} className="rounded-lg border border-border-subtle bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">{p.patientName || "Patient unavailable"} · {p.patientMpi || "MPI unavailable"}</h3>
            <p className="text-sm text-text-secondary">{p.trackingReference} · {p.pickupPoint?.name ?? "Unknown pick-up point"}</p></div>
            <span className="rounded-full border border-amber-500 px-3 py-1 text-xs font-semibold text-amber-800">Overdue since {when(p.traceDueAt)}</span></div>
          <p className="mt-3 text-sm text-text-secondary">Patient contact: {p.patientContact ? <a className="font-medium text-brand-700 underline" href={`tel:${p.patientContact.replace(/[^+\d]/g, "")}`}>{p.patientContact}</a> : "Not provided"} · Dispatched {when(p.dispatchedAt)} · Attempts: {p.traceAttempts} · Last contacted: {when(p.lastTracedAt)}</p>
          {p.traceNote && <p className="mt-2 text-sm text-text-secondary">Last tracing note: {p.traceNote}</p>}
          <label className="mt-3 block text-sm font-medium" htmlFor={`trace-${p.id}`}>Record tracing attempt</label>
          <textarea id={`trace-${p.id}`} rows={2} maxLength={1000} value={notes[p.id] ?? ""}
            onChange={(e) => setNotes((n) => ({ ...n, [p.id]: e.target.value }))}
            placeholder="Contact outcome / next follow-up" className="mt-1 w-full rounded-lg border border-border-strong bg-surface-raised p-3 text-sm text-text-primary" />
          <div className="mt-3 flex flex-wrap gap-2"><Button loading={busy === p.id} disabled={!!busy || !(notes[p.id] ?? "").trim()}
            onClick={() => void run(p.id, async () => { await recordCcmddTrace(p.id, facilityId, notes[p.id]); setNotes((n) => ({ ...n, [p.id]: "" })); }, "Tracing attempt recorded.")}>Save tracing note</Button>
            <Button variant="secondary" disabled={!!busy} onClick={() => void run(p.id, () => updateCcmddStatus(p.id, facilityId, "COLLECTED"), "Parcel marked collected and removed from the tracing worklist.")}>Mark collected</Button>
            <Button variant="secondary" disabled={!!busy} onClick={() => void run(p.id, () => updateCcmddStatus(p.id, facilityId, "RETURNED"), "Parcel returned and removed from the tracing worklist.")}>Mark returned</Button></div>
        </div>)}</div>
      </section>}
    </div>
  );
}

function Summary({ label, number, icon }: { label: string; number: number; icon: ReactNode }) {
  return <div className="flex items-center gap-4 rounded-xl border border-border-subtle bg-surface-raised p-4">
    <div className="rounded-lg bg-surface-sunken p-3 text-brand-600">{icon}</div><div><div className="text-2xl font-bold">{number}</div><div className="text-sm text-text-secondary">{label}</div></div>
  </div>;
}
function ParcelCard({ parcel: p, busy, onAction, onNotify }: {
  parcel: CcmddParcel; busy: string; onAction: (status: ParcelStatus) => void; onNotify: () => void;
}) {
  const open = p.status === "DISPATCHED" || p.status === "READY";
  return <article className="rounded-xl border border-border-subtle bg-surface p-4">
    <div className="flex flex-wrap justify-between gap-3"><div><h3 className="flex items-center gap-2 font-semibold"><PackageCheck className="size-4 text-brand-600" />{p.trackingReference}</h3>
      <p className="mt-1 text-sm text-text-secondary">{p.patientName} · MPI {p.patientMpi} · {p.pickupPoint?.name ?? "Unknown pick-up point"}</p></div>
      <span className={`self-start rounded-full px-3 py-1 text-xs font-semibold ${p.overdue ? "bg-amber-100 text-amber-800" : p.status === "COLLECTED" ? "bg-green-100 text-green-800" : "bg-surface-sunken text-text-primary"}`}>{p.overdue ? "OVERDUE · " : ""}{p.status?.replaceAll("_", " ") ?? "UNKNOWN"}</span></div>
    <div className="mt-3 grid gap-2 text-sm text-text-secondary sm:grid-cols-2 lg:grid-cols-4"><div>Dispatched: {when(p.dispatchedAt)}</div>
      <div>Ready: {when(p.readyAt)}</div><div>Collected: {when(p.collectedAt)}</div><div>Trace by: {when(p.traceDueAt)}</div></div>
    <p className="mt-3 text-xs text-text-secondary">Pick-up point notification: <strong>{p.notificationStatus === "QUEUED" ? "Queued (delivery not confirmed)" : p.notificationStatus === "NOT_CONFIGURED" ? "No point email on record" : "Queue failed"}</strong>
      {p.notifiedAt ? ` · ${when(p.notifiedAt)}` : ""}</p>
    {open && <div className="mt-4 flex flex-wrap gap-2">
      {p.status === "DISPATCHED" && <Button variant="secondary" disabled={!!busy} onClick={() => onAction("READY")}>Mark ready / notify point</Button>}
      <Button variant="secondary" disabled={!!busy} onClick={() => onAction("COLLECTED")}>Mark collected</Button>
      <Button variant="secondary" disabled={!!busy} onClick={() => onAction("RETURNED")}>Mark returned</Button>
      <Button variant="ghost" disabled={!!busy} onClick={onNotify}>Retry notification</Button>
    </div>}
  </article>;
}
