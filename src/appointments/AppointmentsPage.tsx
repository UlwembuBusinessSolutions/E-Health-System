import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, Mail, Plus, RefreshCw, Search, StickyNote, Stethoscope, UserRound, X } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { bookAppointment, cancelAppointment, getAppointments, getAppointmentStaff, rescheduleAppointment, type Appointment, type AppointmentDiary, type AppointmentStaff } from "@/shared/api/appointments";
import { getFacilities } from "@/shared/api/facilities";
import { searchPatients, type Patient } from "@/shared/api/patients";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { Input } from "@/shared/components/Input";
import { PageHeader } from "@/shared/components/PageHeader";
import { Select } from "@/shared/components/Select";
import { StatusPill } from "@/shared/components/StatusPill";
import { useToast } from "@/shared/components/toast/ToastProvider";

const NOTES_MAX_LENGTH = 1000;
const nativeSelectClasses =
  "h-11 w-full rounded-lg border border-border-strong bg-surface-raised px-3.5 text-[15px] text-text-primary outline-none transition-colors duration-150 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:opacity-60";
const textareaClasses =
  "w-full rounded-lg border border-border-strong bg-surface-raised px-3.5 py-2.5 text-[14px] text-text-primary placeholder:text-text-secondary/70 outline-none transition-colors duration-150 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:opacity-60";

const UNASSIGNED_LABEL = "Unassigned — choose later";
const BOOKING_PINNED_OPTIONS: PinnedOption[] = [{ id: "", label: UNASSIGNED_LABEL }];
const FILTER_PINNED_OPTIONS: PinnedOption[] = [
  { id: "", label: "All staff" },
  { id: "UNASSIGNED", label: "Unassigned only" },
];
interface PinnedOption {
  id: string;
  label: string;
}
function staffOptionLabel(person: AppointmentStaff): string {
  return person.designation ? `${person.name} · ${person.designation}` : person.name;
}

// Restricted server-side to clinical roles (Doctor, Professional Nurse,
// Clinician, Occupational Health Practitioner — AppointmentStaffRepository.
// findAvailable()'s own why-note); this combobox just filters whatever comes
// back. A type-to-filter combobox rather than a plain <select>: a facility
// with many clinicians made scrolling a native dropdown slow to use.
// `pinnedOptions` covers the two different "no real staff selected" states
// this same control needs across call sites — the booking/reschedule forms'
// "Unassigned — choose later" (a real appointment state to save) versus the
// diary toolbar's "All staff" / "Unassigned only" (view filters, not saved
// anywhere) — both still need a real, always-reachable value="" (or a
// sentinel) option here, which is why this was never the shared Select
// component to begin with: its own placeholder option is always disabled,
// leaving no room for a second real empty-ish value in the list.
function StaffCombobox({
  facilityId,
  value,
  onChange,
  currentName,
  id,
  label,
  pinnedOptions,
  showHint = true,
}: {
  facilityId: string;
  value: string;
  onChange: (id: string) => void;
  currentName?: string | null;
  id: string;
  label: ReactNode;
  pinnedOptions: PinnedOption[];
  showHint?: boolean;
}) {
  // `enabled` guard added when this combobox started mounting in contexts
  // (the diary toolbar's filter) that can render before facilityId resolves
  // — BookingForm never did, since it only ever mounts once a facility is
  // already selected, so this gap was latent until the reuse surfaced it
  // (a real request to .../facilities//appointment-staff, CORS-blocked).
  const staff = useQuery({
    queryKey: ["appointment-staff", facilityId],
    queryFn: () => getAppointmentStaff(facilityId),
    enabled: !!facilityId,
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  function labelOf(o: AppointmentStaff) {
    return o.designation === "unavailable" ? `${o.name} (unavailable)` : staffOptionLabel(o);
  }

  // A previously-assigned staff member who's no longer in findAvailable()'s
  // result (disabled, moved facility) still needs to render as the current
  // selection — same "unavailable" fallback the old StaffPicker had.
  const options = useMemo(() => {
    const real = staff.data ?? [];
    const isPinned = pinnedOptions.some((p) => p.id === value);
    const stale: AppointmentStaff[] =
      value && !isPinned && !real.some((s) => s.id === value)
        ? [{ id: value, name: currentName || "Previously assigned staff", designation: "unavailable" }]
        : [];
    return [...stale, ...real];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff.data, value, currentName, pinnedOptions]);

  const pinnedMatch = pinnedOptions.find((p) => p.id === value);
  const selectedLabel = pinnedMatch
    ? pinnedMatch.label
    : options.find((o) => o.id === value)
      ? labelOf(options.find((o) => o.id === value)!)
      : "";

  // Keeps the visible text in sync with the committed selection whenever
  // it's not actively being typed into — mirrors a native <select>'s own
  // "always shows the current value" behavior.
  useEffect(() => {
    if (!open) setQuery(selectedLabel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLabel, open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pinnedMatches = pinnedOptions.filter((p) => !q || p.label.toLowerCase().includes(q));
    const staffMatches = options.filter((o) => labelOf(o).toLowerCase().includes(q));
    return [...pinnedMatches.map((p) => ({ id: p.id, name: p.label, designation: null }) as AppointmentStaff), ...staffMatches];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, query, pinnedOptions]);

  function commit(optionId: string) {
    onChange(optionId);
    setOpen(false);
  }

  function openOptions() {
    setOpen(true);
    setQuery("");
    setActiveIndex(0);
  }

  useEffect(() => {
    if (open) document.getElementById(`${id}-option-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex, id]);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div className="min-w-0 flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-text-primary">
        {label}
      </label>
      <div ref={containerRef} className="relative">
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-listbox`}
          aria-autocomplete="list"
          aria-describedby={showHint ? `${id}-hint` : undefined}
          aria-activedescendant={open && filtered[activeIndex] ? `${id}-option-${activeIndex}` : undefined}
          autoComplete="off"
          disabled={staff.isPending || staff.isError}
          value={query}
          placeholder="Search name or clinical role…"
          onFocus={openOptions}
          onClick={() => { if (!open) openOptions(); }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActiveIndex(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              if (!open) openOptions();
              else setActiveIndex((i) => Math.min(i + 1, Math.max(0, filtered.length - 1)));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (!open) openOptions();
              else if (filtered[activeIndex]) commit(filtered[activeIndex].id);
            } else if (e.key === "Escape") {
              setOpen(false);
              setQuery(selectedLabel);
            }
          }}
          onBlur={() => setOpen(false)}
          className={`${nativeSelectClasses} pr-10`}
        />
        <ChevronDown className={`pointer-events-none absolute right-3.5 top-3.5 size-4 text-text-secondary transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
        {open && (
          <ul id={`${id}-listbox`} role="listbox" aria-label="Available staff" className="absolute z-20 mt-1.5 max-h-64 w-full overflow-auto rounded-xl border border-border-subtle bg-surface-raised py-1.5 shadow-card">
            {filtered.length === 0 ? (
              <li className="px-3.5 py-2 text-[13.5px] text-text-secondary">No matching staff.</li>
            ) : (
              filtered.map((o, i) => (
                <li
                  key={o.id || "empty"}
                  id={`${id}-option-${i}`}
                  role="option"
                  aria-selected={o.id === value}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => commit(o.id)}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={`flex cursor-pointer items-center gap-2.5 px-3.5 py-2.5 text-[13.5px] ${i === activeIndex ? "bg-brand-50 text-brand-700" : "text-text-primary"}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{o.name}</span>
                    {o.designation && <span className="block text-[12px] text-text-secondary">{o.designation === "unavailable" ? "Previously assigned · unavailable" : o.designation}</span>}
                  </span>
                  {o.id === value && <Check className="size-4 shrink-0 text-brand-600" aria-hidden />}
                </li>
              ))
            )}
          </ul>
        )}
      </div>
      {staff.isPending ? (
        <p role="status" className="text-[13px] text-text-secondary">
          Loading staff…
        </p>
      ) : staff.isError ? (
        <p role="alert" className="text-[13px] text-danger-500">
          Staff couldn&rsquo;t be loaded.{" "}
          <button type="button" className="font-medium underline" onClick={() => void staff.refetch()}>
            Retry
          </button>
        </p>
      ) : showHint ? (
        <p id={`${id}-hint`} className="text-[12px] text-text-secondary">
          {staff.data.length ? "Choose a doctor, nurse or clinician at this facility." : "No clinical staff are assigned to this facility yet."}
        </p>
      ) : null}
    </div>
  );
}

function NotesField({ value, onChange, id }: { value: string; onChange: (value: string) => void; id: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-[13px] font-medium text-text-primary">Appointment notes <span className="font-normal text-text-secondary">(optional)</span></label>
        <span className="text-[11px] tabular-nums text-text-secondary">{value.length}/{NOTES_MAX_LENGTH}</span>
      </div>
      <textarea
        id={id}
        rows={3}
        aria-describedby={`${id}-hint`}
        maxLength={NOTES_MAX_LENGTH}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Reason for visit, preparation or anything the care team should know…"
        className={textareaClasses}
      />
      <p id={`${id}-hint`} className="text-[12px] text-text-secondary">For the care team. Notes are not included in the confirmation email.</p>
    </div>
  );
}

function BookingForm({ facilityId, diary, close, onBooked }: { facilityId: string; diary: AppointmentDiary; close: () => void; onBooked: (date: string) => void }) {
  const formRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [patient, setPatient] = useState<Patient | null>(null);
  const [date, setDate] = useState(diary.date);
  const [time, setTime] = useState("");
  const [assignedStaffId, setAssignedStaffId] = useState("");
  const [notes, setNotes] = useState("");
  const capacity = useQuery({ queryKey: ["appointments", facilityId, date, 0], queryFn: () => getAppointments(facilityId, date, 0), enabled: !!date, refetchInterval: 15000 });
  const canBook = !!patient && !!date && !!time && capacity.isSuccess && capacity.data.remaining !== 0;
  // Keep the same ID for retries of the same payload, including a lost response.
  const [request, setRequest] = useState<{ payload: string; id: string } | null>(null);
  const patients = useQuery({ queryKey: ["appointment-patient-search", term], queryFn: () => searchPatients(term), enabled: term.length >= 2 });
  const mutation = useMutation({
    mutationFn: () => {
      const trimmedNotes = notes.trim() || null;
      const payload = JSON.stringify({ patientId: patient!.id, date, time, assignedStaffId: assignedStaffId || null, notes: trimmedNotes });
      const id = request?.payload === payload ? request.id : crypto.randomUUID();
      setRequest({ payload, id });
      return bookAppointment(facilityId, { requestId: id, patientId: patient!.id, date, time, assignedStaffId: assignedStaffId || null, notes: trimmedNotes });
    },
    onSuccess: (appointment) => {
      showToast("Appointment booked.", "success");
      onBooked(appointment.date);
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["appointments"] }),
  });

  useEffect(() => {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    formRef.current?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
  }, []);

  return (
    <div ref={formRef} className="scroll-mt-20">
    <Card className="border-brand-200">
      <div className="flex items-start justify-between gap-4 rounded-t-2xl border-b border-border-subtle bg-brand-50/50 px-4 py-4 sm:px-6">
        <div className="flex gap-3">
          <span className="hidden size-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700 sm:flex"><CalendarDays className="size-5" aria-hidden /></span>
          <div>
          <h2 className="text-[17px] font-semibold text-text-primary">Book an appointment</h2>
          <p className="mt-0.5 text-[13px] text-text-secondary">Choose a patient and arrange their next visit.</p>
          </div>
        </div>
        <button
          type="button"
          aria-label="Close booking form"
          onClick={close}
          disabled={mutation.isPending}
          className="rounded-md p-1 text-text-secondary transition-colors duration-150 hover:bg-surface-sunken hover:text-text-primary disabled:cursor-not-allowed"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>

      {!patient && <form onSubmit={(e) => { e.preventDefault(); setTerm(search.trim()); }} className="flex items-end gap-2 px-4 pt-5 sm:gap-3 sm:px-6">
        <div className="min-w-0 flex-1">
          <Input
            label="Find a registered patient"
            placeholder="Patient name, MPI or ID number"
            minLength={2}
            required
            disabled={mutation.isPending}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setTerm(""); }}
          />
        </div>
        <Button variant="secondary" icon={<Search className="size-4" aria-hidden />} disabled={search.trim().length < 2 || mutation.isPending} loading={patients.isFetching}>
          Search
        </Button>
      </form>}

      {!patient && term.length >= 2 && (
        <div role="status" aria-live="polite" className="mx-4 mt-3 max-h-60 overflow-auto rounded-lg border border-border-subtle sm:mx-6">
          {patients.isError ? (
            <p role="alert" className="p-3 text-[13.5px] text-danger-500">
              {patients.error.message}
            </p>
          ) : patients.isPending ? (
            <p className="p-3 text-[13.5px] text-text-secondary">Searching patients…</p>
          ) : patients.data.length === 0 ? (
            <p className="p-3 text-[13.5px] text-text-secondary">
              No matching patients. <Link to="/app/patients/new" className="font-medium text-brand-600 hover:underline">Register a patient</Link> before booking.
            </p>
          ) : (
            patients.data.map((p) => (
              <button
                type="button"
                key={p.id}
                disabled={mutation.isPending}
                onClick={() => setPatient(p)}
                className="flex w-full items-center justify-between gap-3 border-b border-border-subtle px-3.5 py-2.5 text-left text-[13.5px] transition-colors duration-150 last:border-b-0 hover:bg-brand-50"
              >
                <span>
                  <strong className="font-semibold text-text-primary">{p.firstName} {p.lastName}</strong>{" "}
                  <span className="text-text-secondary">{p.mpiNumber}</span>
                </span>
                <span className="text-[12px] font-semibold text-brand-600">Select</span>
              </button>
            ))
          )}
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); if (canBook) mutation.mutate(); }} className="flex flex-col gap-5 px-4 pb-5 pt-5 sm:px-6 sm:pb-6">
        <fieldset disabled={mutation.isPending} className="flex flex-col gap-4">
          {patient && (
            <div className="flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-raised text-brand-600"><UserRound className="size-5" aria-hidden /></span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-text-secondary">SELECTED PATIENT</p>
                <strong className="block break-words text-[14px] font-semibold text-text-primary">{patient.firstName} {patient.lastName}</strong>
                <p className="text-[12px] text-text-secondary">{patient.mpiNumber}</p>
              </div>
              <button type="button" onClick={() => setPatient(null)} className="rounded-md px-2 py-1 text-[13px] font-medium text-brand-700 hover:bg-brand-100">Change</button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Input label="Appointment date" type="date" required value={date} onChange={(e) => { setDate(e.target.value); mutation.reset(); }} />
            <Input label="Appointment time" type="time" required value={time} onChange={(e) => setTime(e.target.value)} />
            <div className="sm:col-span-2">
            <StaffCombobox
              id="booking-staff"
              label={
                <>
                  Appointment with <span className="font-normal text-text-secondary">(optional)</span>
                </>
              }
              pinnedOptions={BOOKING_PINNED_OPTIONS}
              facilityId={facilityId}
              value={assignedStaffId}
              onChange={setAssignedStaffId}
            />
            </div>
          </div>

          <NotesField id="booking-notes" value={notes} onChange={setNotes} />
          {patient && (
            <div className="flex items-start gap-2.5 rounded-xl border border-border-subtle px-3.5 py-3 text-[13px]">
              <Mail className="mt-0.5 size-4 shrink-0 text-text-secondary" aria-hidden />
              <div className="min-w-0">
                <p className="font-medium text-text-primary">Email confirmation</p>
                <p className="mt-0.5 break-words text-text-secondary">
                  {patient.email ? <>Booking details use the patient&rsquo;s saved email: <span className="font-medium text-text-primary">{patient.email}</span>.</> : <>No email saved for this patient. Share the date and time with them directly, or add an email in their <Link to={`/app/patients/${patient.id}`} className="font-medium text-brand-600 hover:underline">patient profile</Link>.</>}
                </p>
              </div>
            </div>
          )}
        </fieldset>

        {mutation.isError && (
          <p role="alert" className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-[13.5px] text-danger-600">
            {mutation.error.message}
          </p>
        )}

        <div role="status" className="rounded-lg bg-surface-sunken px-3.5 py-2.5 text-[13.5px] text-text-secondary">
          {!date ? (
            "Choose an appointment date."
          ) : capacity.isError ? (
            <>
              Availability couldn&rsquo;t be loaded.{" "}
              <button type="button" className="font-medium underline" onClick={() => void capacity.refetch()}>
                Retry
              </button>
            </>
          ) : capacity.isPending ? (
            "Checking availability…"
          ) : capacity.data.remaining === 0 ? (
            "This date is full. Choose another appointment date above."
          ) : (
            `${capacity.data.booked} booked · ${capacity.data.remaining === null ? "No daily limit" : `${capacity.data.remaining} places remaining`} on ${date}`
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-border-subtle pt-4 sm:flex-row sm:items-center sm:justify-end">
          <p className="mr-auto flex items-center gap-1.5 text-[12px] text-text-secondary"><Clock3 className="size-3.5" aria-hidden />{diary.timezone.replaceAll("_", " ")}</p>
          <div className="flex justify-end gap-3">
          <Button variant="secondary" type="button" onClick={close} disabled={mutation.isPending}>
            Close
          </Button>
          <Button type="submit" disabled={!canBook} loading={mutation.isPending}>
            Confirm booking
          </Button>
          </div>
        </div>
      </form>
    </Card>
    </div>
  );
}

function AppointmentAction({ appointment, facilityId, action, close }: { appointment: Appointment; facilityId: string; action: "reschedule" | "cancel"; close: () => void }) {
  const [date, setDate] = useState(appointment.date);
  const [time, setTime] = useState(appointment.time.slice(0, 5));
  const [reason, setReason] = useState("");
  const [assignedStaffId, setAssignedStaffId] = useState(appointment.assignedStaffId ?? "");
  const [notes, setNotes] = useState(appointment.notes ?? "");
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const capacity = useQuery({ queryKey: ["appointments", facilityId, date, 0], queryFn: () => getAppointments(facilityId, date, 0), enabled: action === "reschedule" && !!date });
  const full = date !== appointment.date && capacity.data?.remaining === 0;
  const mutation = useMutation({
    mutationFn: () =>
      action === "cancel"
        ? cancelAppointment(facilityId, appointment, reason.trim())
        : rescheduleAppointment(facilityId, appointment, date, time, assignedStaffId || null, notes.trim() || null),
    onSuccess: () => {
      showToast(action === "cancel" ? "Appointment cancelled." : "Appointment rescheduled.", "success");
      close();
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["appointments"] }),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="mt-3 flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface-sunken p-4">
      <fieldset disabled={mutation.isPending} className="flex flex-col gap-3">
        {action === "cancel" ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`cancel-reason-${appointment.id}`} className="text-[13px] font-medium text-text-primary">
              Cancellation reason
            </label>
            <textarea id={`cancel-reason-${appointment.id}`} value={reason} onChange={(e) => setReason(e.target.value)} required maxLength={500} rows={2} className={textareaClasses} />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input label="New date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              <Input label="New time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
            </div>
            <StaffCombobox
              id={`reschedule-staff-${appointment.id}`}
              label={
                <>
                  Appointment with <span className="font-normal text-text-secondary">(optional)</span>
                </>
              }
              pinnedOptions={BOOKING_PINNED_OPTIONS}
              facilityId={facilityId}
              value={assignedStaffId}
              onChange={setAssignedStaffId}
              currentName={appointment.assignedStaffName}
            />
            <NotesField id={`reschedule-notes-${appointment.id}`} value={notes} onChange={setNotes} />
            <p className="text-[13px] text-text-secondary">
              {full ? "This date is full. Choose another date." : capacity.isError ? "Could not check availability. Try again." : capacity.data ? `${capacity.data.booked} booked · ${capacity.data.remaining === null ? "No daily limit" : `${capacity.data.remaining} places remaining`}` : "Checking availability…"}
            </p>
          </>
        )}
      </fieldset>
      {mutation.isError && (
        <p role="alert" className="text-[13px] text-danger-500">
          {mutation.error.message}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button size="md" variant="secondary" type="button" disabled={mutation.isPending} onClick={close}>
          Keep appointment
        </Button>
        <Button size="md" type="submit" loading={mutation.isPending} disabled={action === "cancel" ? !reason.trim() : full || !date || !time || capacity.isPending || capacity.isError}>
          {action === "cancel" ? "Confirm cancellation" : "Save new time"}
        </Button>
      </div>
    </form>
  );
}

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "CANCELLED", label: "Cancelled" },
];

// Mirrors Sidebar.tsx's own CLINICAL_ROLES exactly — the same set that also
// gates the "Take Vitals" nav link. These roles hold APPT:VIEW but not
// APPT:MANAGE (V12__role_permissions.sql), so they can already open this
// page and see the whole facility's diary; defaulting the "Assigned to"
// filter to themselves is a display convenience only, not an access
// restriction — nothing stops them changing it back to "All staff".
const CLINICAL_ROLES = new Set(["Professional Nurse", "Doctor", "Clinician", "Occupational Health Practitioner"]);

function readableDate(date: string) {
  return new Intl.DateTimeFormat("en-ZA", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${date}T12:00:00`));
}

function adjacentDate(date: string, delta: number) {
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + delta);
  return next.toISOString().slice(0, 10);
}

export function AppointmentsPage() {
  const { user } = useAuth();
  const [selectedFacility, setSelectedFacility] = useState("");
  const [date, setDate] = useState("");
  const [page, setPage] = useState(0);
  const [booking, setBooking] = useState(false);
  const [editing, setEditing] = useState<{ appointment: Appointment; action: "reschedule" | "cancel" } | null>(null);
  // "" = all staff, "UNASSIGNED" = the sentinel StaffCombobox's filter
  // variant sends for "no clinician assigned", anything else = a real
  // staff id — translated into assignedStaffId/unassignedOnly below,
  // matching AppointmentService.diary()'s own two-separate-params shape.
  // Clinical roles default to their own appointments (below); everyone else
  // (reception, admins) defaults to seeing the whole facility.
  const [staffFilter, setStaffFilter] = useState(() => (user && CLINICAL_ROLES.has(user.role) ? user.id : ""));
  const [statusFilter, setStatusFilter] = useState("");
  const facilities = useQuery({ queryKey: ["facilities"], queryFn: getFacilities });
  const facilityId = selectedFacility || facilities.data?.[0]?.id || "";
  const filters = {
    assignedStaffId: staffFilter && staffFilter !== "UNASSIGNED" ? staffFilter : undefined,
    unassignedOnly: staffFilter === "UNASSIGNED",
    status: statusFilter || undefined,
  };
  const query = useQuery({
    queryKey: ["appointments", facilityId, date, page, staffFilter, statusFilter],
    queryFn: () => getAppointments(facilityId, date, page, filters),
    enabled: !!facilityId,
    refetchInterval: 15000,
  });
  const diary = query.data;
  function resetView() { setPage(0); setBooking(false); setEditing(null); }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Appointments"
        description="View the daily diary and manage patient bookings."
        action={
          diary?.canManage && (
            <Button icon={<Plus className="size-4" aria-hidden />} disabled={query.isError || booking} onClick={() => { setBooking(true); setEditing(null); }}>
              Book appointment
            </Button>
          )
        }
      />

      <Card className="p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-[1.1fr_1fr_1.35fr_0.85fr]">
        <div className="min-w-0">
          <Select
            label="Facility"
            placeholder="Select a facility"
            value={facilityId}
            onChange={(e) => { setSelectedFacility(e.target.value); setDate(""); resetView(); }}
            disabled={!facilities.data?.length}
            options={facilities.data?.map((f) => ({ value: f.id, label: f.name })) ?? []}
          />
        </div>
        <Input label="Diary date" type="date" value={date || diary?.date || ""} onChange={(e) => { setDate(e.target.value); resetView(); }} />
        <div className="min-w-0">
          <StaffCombobox
            id="filter-staff"
            label="Assigned to"
            showHint={false}
            pinnedOptions={FILTER_PINNED_OPTIONS}
            facilityId={facilityId}
            value={staffFilter}
            onChange={(v) => { setStaffFilter(v); resetView(); }}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          {/* A plain <select>, not the shared Select component — "All
              statuses" has to be a real, re-selectable value="" option here
              (the filter must be clearable back to it), and Select's own
              placeholder option is always disabled — same reasoning as
              StaffCombobox's own why-note. */}
          <label htmlFor="filter-status" className="text-[13px] font-medium text-text-primary">
            Status
          </label>
          <select
            id="filter-status"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); resetView(); }}
            className={nativeSelectClasses}
          >
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border-subtle pt-3.5">
        <Button size="md" variant="secondary" aria-label="Previous day" disabled={!diary} onClick={() => { if (diary) { setDate(adjacentDate(date || diary.date, -1)); resetView(); } }}><ChevronLeft className="size-4" aria-hidden /></Button>
        <Button size="md" variant="secondary" onClick={() => { setDate(""); resetView(); }}>
          Today
        </Button>
        <Button size="md" variant="secondary" aria-label="Next day" disabled={!diary} onClick={() => { if (diary) { setDate(adjacentDate(date || diary.date, 1)); resetView(); } }}><ChevronRight className="size-4" aria-hidden /></Button>
        <Button size="md" variant="secondary" className="ml-auto" icon={<RefreshCw className="size-3.5" aria-hidden />} loading={query.isFetching || facilities.isFetching} onClick={() => { void facilities.refetch(); if (facilityId) void query.refetch(); }}>
          Refresh
        </Button>
        {diary && <span className="hidden items-center gap-1.5 text-[12px] text-text-secondary lg:flex"><Clock3 className="size-3.5" aria-hidden />{diary.timezone.replaceAll("_", " ")}</span>}
        </div>
      </Card>

      {facilities.isError ? (
        <Card className="p-8 text-center" role="alert">
          <p className="text-[14px] text-text-secondary">{facilities.error.message}</p>
          <Button className="mt-3" onClick={() => void facilities.refetch()}>
            Retry facilities
          </Button>
        </Card>
      ) : facilities.isSuccess && !facilities.data.length ? (
        <Card className="p-8 text-center">
          <h2 className="text-[16px] font-semibold text-text-primary">No facilities available</h2>
          <p className="mt-1 text-[14px] text-text-secondary">Ask your administrator to add a facility before booking appointments.</p>
        </Card>
      ) : query.isError ? (
        <Card className="p-8 text-center" role="alert">
          <h2 className="text-[16px] font-semibold text-text-primary">Appointments couldn&rsquo;t be loaded</h2>
          <p className="mt-1 text-[14px] text-text-secondary">{query.error.message}</p>
          <Button className="mt-3" onClick={() => void query.refetch()}>
            Retry
          </Button>
        </Card>
      ) : !diary ? (
        <Card className="p-8 text-center" role="status">
          <p className="text-[14px] text-text-secondary">Loading appointments…</p>
        </Card>
      ) : (
        <>
          {/* Capacity management (how many booked, the daily cap, places
              left, the limit-reached banner) is a reception/admin concern —
              exactly the same population diary.canManage already gates the
              Book button for. A view-only clinician (Doctor, Nurse,
              Clinician, Queue Marshall, etc.) can't act on any of these
              numbers, and once the "Assigned to" filter defaults to their
              own name, the facility-wide booked/remaining counts (which
              deliberately never change with the filter — see
              AppointmentService.diary()'s own why-note) would otherwise
              read as a confusing mismatch against their own, much shorter,
              filtered list below. */}
          {diary.canManage && (
            <>
              <div className="grid grid-cols-3 gap-2 sm:gap-4">
                <Card className="p-3 sm:p-5">
                  <p className="text-[11px] font-medium text-text-secondary sm:text-[13px]">Booked</p>
                  <strong className="mt-1 block text-[24px] tabular-nums text-text-primary sm:text-[28px]">{diary.booked}</strong>
                  <p className="mt-0.5 hidden text-[12px] text-text-secondary sm:block">Confirmed visits at this facility</p>
                </Card>
                <Card className="p-3 sm:p-5">
                  <p className="text-[11px] font-medium text-text-secondary sm:text-[13px]">Daily limit</p>
                  <strong className="mt-1 block text-[24px] tabular-nums text-text-primary sm:text-[28px]">{diary.dailyLimit ?? "—"}</strong>
                  <p className="mt-0.5 hidden text-[12px] text-text-secondary sm:block">{diary.dailyLimit === null ? "No daily limit configured" : "Maximum bookings for the day"}</p>
                </Card>
                <Card className="border-brand-200 bg-brand-50/40 p-3 sm:p-5">
                  <p className="text-[11px] font-medium text-text-secondary sm:text-[13px]">Available</p>
                  <strong className={`mt-1 block text-[24px] tabular-nums sm:text-[28px] ${diary.remaining === 0 ? "text-amber-600" : "text-brand-600"}`}>{diary.remaining ?? "∞"}</strong>
                  <p className="mt-0.5 hidden text-[12px] text-text-secondary sm:block">{diary.remaining === null ? "Unlimited places" : "Places left to book"}</p>
                </Card>
              </div>

              {diary.remaining === 0 && (
                <div role="status" className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-50 px-4 py-3">
                  <CalendarDays className="size-5 shrink-0 text-amber-600" aria-hidden />
                  <div>
                    <strong className="text-[14px] text-amber-600">
                      Daily appointment limit reached ({diary.booked} of {diary.dailyLimit})
                    </strong>
                    <p className="text-[13px] text-amber-600/90">Choose another date to book. Existing appointments are kept.</p>
                  </div>
                </div>
              )}
            </>
          )}

          {booking && diary.canManage && (
            <BookingForm key={`${facilityId}:${diary.date}`} facilityId={facilityId} diary={diary} close={() => setBooking(false)} onBooked={(bookedDate) => { setDate(bookedDate); setPage(0); setBooking(false); }} />
          )}

          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle px-4 py-4 sm:px-6">
              <div>
              <h2 className="text-[17px] font-semibold text-text-primary">
                Daily diary <span className="ml-1 rounded-full bg-surface-sunken px-2 py-0.5 text-[12px] font-medium text-text-secondary">{diary.totalItems}</span>
              </h2>
              <p className="mt-1 text-[13px] text-text-secondary">{readableDate(diary.date)}</p>
              </div>
              {(staffFilter || statusFilter) && <button type="button" className="rounded-lg px-2 py-1 text-[12px] font-medium text-brand-600 hover:bg-brand-50" onClick={() => { setStaffFilter(""); setStatusFilter(""); resetView(); }}>Clear filters</button>}
            </div>

            {diary.items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
                <CalendarDays className="size-8 text-text-secondary" aria-hidden />
                <h3 className="text-[15px] font-semibold text-text-primary">No appointments for this date</h3>
                <p className="text-[13.5px] text-text-secondary">{staffFilter || statusFilter ? "Try another date or clear the staff and status filters." : diary.canManage ? "Book a registered patient using the button above." : "Appointments will appear here when reception books them."}</p>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-border-subtle">
                {diary.items.map((appointment) => {
                  const cancelled = appointment.status === "CANCELLED";
                  return (
                    <div key={appointment.id} data-testid="appointment-row" className="px-4 py-4 sm:px-6">
                      <div className="flex flex-wrap items-start gap-4">
                        <time dateTime={appointment.startsAt} className={`w-14 shrink-0 rounded-lg py-2.5 text-center font-mono text-[13px] font-semibold ${cancelled ? "bg-surface-sunken text-text-secondary" : "bg-brand-50 text-brand-700"}`}>
                          {appointment.time.slice(0, 5)}
                        </time>
                        <div className="min-w-0 flex-1">
                          {cancelled ? (
                            <span className="text-[14px] font-semibold text-text-secondary">{appointment.patientName}</span>
                          ) : (
                            <Link to={`/app/patients/${appointment.patientId}`} className="text-[14px] font-semibold text-brand-600 hover:underline">
                              {appointment.patientName}
                            </Link>
                          )}
                          <p className="text-[12.5px] text-text-secondary">
                            {appointment.mpiNumber}
                            {appointment.createdByName && ` · Booked by ${appointment.createdByName}`}
                          </p>
                          <p className={`mt-1 flex items-center gap-1.5 text-[12.5px] ${appointment.assignedStaffName ? "text-text-secondary" : "text-amber-600"}`}>
                            <Stethoscope className="size-3.5 shrink-0" aria-hidden />
                            {appointment.assignedStaffName ? `With ${appointment.assignedStaffName}` : "Staff to be assigned"}
                          </p>
                          {appointment.notes && (
                            <div className="mt-1.5 flex max-w-xl items-start gap-1.5 rounded-lg bg-surface-sunken px-2.5 py-1.5 text-[12.5px] text-text-primary">
                              <StickyNote className="mt-0.5 size-3.5 shrink-0 text-text-secondary" aria-hidden />
                              <span className="min-w-0 whitespace-pre-line break-words">{appointment.notes}</span>
                            </div>
                          )}
                          {appointment.cancelReason && <p className="mt-1.5 text-[12.5px] text-danger-600">Reason: {appointment.cancelReason}</p>}
                        </div>
                        <StatusPill tone={cancelled ? "danger" : "success"}>{cancelled ? "Cancelled" : "Confirmed"}</StatusPill>
                        {diary.canManage && !cancelled && (
                          <div className="flex w-full gap-2 sm:w-auto">
                            <Button size="md" variant="secondary" onClick={() => { setBooking(false); setEditing({ appointment, action: "reschedule" }); }}>
                              Reschedule
                            </Button>
                            <Button size="md" variant="secondary" className="!text-danger-600" onClick={() => { setBooking(false); setEditing({ appointment, action: "cancel" }); }}>
                              Cancel
                            </Button>
                          </div>
                        )}
                      </div>
                      {editing?.appointment.id === appointment.id && (
                        <AppointmentAction key={`${appointment.id}:${editing.action}`} appointment={editing.appointment} facilityId={facilityId} action={editing.action} close={() => setEditing(null)} />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {diary.totalItems > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle px-4 py-3.5 sm:px-6">
                <span className="text-[13px] text-text-secondary">
                  Showing {page * 50 + 1}–{page * 50 + diary.items.length} of {diary.totalItems}
                </span>
                <div className="flex gap-2">
                  <Button variant="secondary" size="md" disabled={page === 0} icon={<ChevronLeft className="size-3.5" aria-hidden />} onClick={() => { setPage((p) => p - 1); setEditing(null); }}>
                    Previous
                  </Button>
                  <Button variant="secondary" size="md" disabled={!diary.hasMore} icon={<ChevronRight className="size-3.5" aria-hidden />} onClick={() => { setPage((p) => p + 1); setEditing(null); }}>
                    Next
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
