import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CalendarClock, CalendarPlus, LogOut, Moon } from "lucide-react";
import { usePatientAuth } from "./PatientAuthContext";
import { getOwnPatientRecords, patientLogout } from "@/shared/api/patientAuth";
import { cancelMyPatientAppointment, getMyPatientAppointments, getPatientBookingAvailability, rescheduleMyPatientAppointment, type PatientAppointment } from "@/shared/api/patientBooking";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import "./patient-appointments.css";

function serviceName(code: string) {
  return ({ GENERAL_CONSULTATION: "General consultation", FOLLOW_UP: "Follow-up visit", CHRONIC_CARE: "Chronic care", MATERNAL_CHILD: "Maternal and child health", OCCUPATIONAL_HEALTH: "Occupational health" } as Record<string, string>)[code] ?? code.replaceAll("_", " ");
}

function readableDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

export function PatientPortalPage() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { account, logout } = usePatientAuth();
  const [editing, setEditing] = useState<PatientAppointment | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [error, setError] = useState("");
  const records = useQuery({ queryKey: ["patient-portal", account?.id, "own-records"], queryFn: getOwnPatientRecords, enabled: Boolean(account?.id) });
  const appointments = useQuery({ queryKey: ["patient-portal", account?.id, "appointments"], queryFn: getMyPatientAppointments, enabled: Boolean(account?.id) });
  const slots = useQuery({
    queryKey: ["patient-portal", "reschedule-slots", editing?.id, date],
    queryFn: () => getPatientBookingAvailability(editing!.facilityId, date, editing!.assignedStaffId, editing!.id),
    enabled: Boolean(editing && date),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["patient-portal", account?.id, "appointments"] });
  const cancel = useMutation({
    mutationFn: cancelMyPatientAppointment,
    onSuccess: (_, appointmentId) => {
      queryClient.setQueryData<PatientAppointment[]>(["patient-portal", account?.id, "appointments"], (current) =>
        current?.filter((appointment) => appointment.id !== appointmentId),
      );
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
      void queryClient.invalidateQueries({ queryKey: ["patient-booking", "slots"] });
      void queryClient.invalidateQueries({ queryKey: ["patient-portal", "reschedule-slots"] });
      return refresh();
    },
    onError: () => setError("We couldn't cancel this appointment. Please try again."),
  });
  const reschedule = useMutation({ mutationFn: ({ id, day, time }: { id: string; day: string; time: string }) => rescheduleMyPatientAppointment(id, day, time), onSuccess: () => { setEditing(null); setDate(""); setError(""); void queryClient.invalidateQueries({ queryKey: ["appointments"] }); void queryClient.invalidateQueries({ queryKey: ["patient-booking", "slots"] }); void queryClient.invalidateQueries({ queryKey: ["patient-portal", "reschedule-slots"] }); void refresh(); }, onError: () => setError("That time is unavailable. Please choose another date.") });

  const handleSignOut = () => {
    void patientLogout().catch(() => {});
    logout();
    navigate(`/org/${tenantSlug}/patient/login`, { replace: true });
  };
  const openReschedule = (appointment: PatientAppointment) => { setEditing(appointment); setDate(appointment.date); setTime(appointment.time.slice(0, 5)); setError(""); };

  return (
    <div className="patient-appointments">
      <header className="pa-nav"><div className="pa-nav-inner">
        <Link to={`/org/${tenantSlug}`} className="pa-logo"><img src="/ulwembu-logo.png" alt="Ulwembu Healthcare Management System" /></Link>
        <nav aria-label="Main navigation"><Link to={`/org/${tenantSlug}`}>Home</Link><a href={`/org/${tenantSlug}#services`}>Services</a><a href={`/org/${tenantSlug}#facilities`}>Facilities</a><a href={`/org/${tenantSlug}#providers`}>Providers</a><Link to={`/org/${tenantSlug}/patient/book`}>Book appointment</Link><a className="is-active" href="#appointments">My appointments</a></nav>
        <div className="pa-nav-actions"><button className="pa-dark" aria-label="Toggle dark appearance"><Moon size={14} /> Dark</button><span className="pa-user" aria-label={`Signed in as ${account?.firstName}`}>{`${account?.firstName?.[0] ?? ""}${account?.lastName?.[0] ?? ""}`.toUpperCase()}</span><button className="pa-signout" onClick={handleSignOut}><LogOut size={15} /> Sign out</button></div>
      </div></header>
      <section className="pa-hero"><div className="pa-container pa-hero-inner"><p className="pa-crumb"><Link to={`/org/${tenantSlug}`}>Home</Link> / My appointments</p><p className="pa-eyebrow">YOUR CARE JOURNEY</p><h1>Appointments, all in one<br className="pa-desktop-break" /> place.</h1><p className="pa-intro">Review upcoming visits and keep your healthcare plans up to date.</p></div></section>
      <main id="appointments" className="pa-main"><div className="pa-container">
        <section className="pa-upcoming"><div><h2>Upcoming</h2><p>Manage your next appointment.</p></div><Link to={`/org/${tenantSlug}/patient/book`} className="pa-book"><CalendarPlus size={17} /> Book appointment</Link></section>
        {records.isError && <p className="pa-error" role="alert">We couldn't load your patient record. Please sign in again or contact your clinic.</p>}
        {appointments.isPending ? <Card className="pa-empty" role="status">Loading appointments…</Card> : appointments.isError ? <Card className="pa-empty" role="alert">We couldn't load your appointments. Refresh to try again.</Card> : appointments.data.length === 0 ? <Card className="pa-empty"><CalendarClock size={25} /><h3>No upcoming appointments</h3><p>Book a visit to see it here.</p></Card> : <div className="pa-list">{appointments.data.map((appointment) => <article className="pa-card" key={appointment.id}>
          <div className="pa-date"><span>{readableDate(appointment.date).split(",")[0].toUpperCase()}, {new Date(`${appointment.date}T12:00:00`).toLocaleDateString(undefined, { month: "short" }).toUpperCase()}</span><strong>{new Date(`${appointment.date}T12:00:00`).getDate()}</strong></div>
          <div className="pa-details"><h3>{serviceName(appointment.serviceCode)}</h3><p>{appointment.facilityName} · {appointment.assignedStaffName ?? "Healthcare professional"} · {appointment.time.slice(0, 5)}</p><div className="pa-badges"><span>{appointment.status === "CANCELLED" ? "Cancelled" : "Confirmed"}</span><span>Pay at facility</span></div></div>
          {appointment.status === "CONFIRMED" && <div className="pa-actions"><button onClick={() => openReschedule(appointment)}>Reschedule</button><button disabled={cancel.isPending} onClick={() => { if (window.confirm("Cancel this appointment?")) { setError(""); cancel.mutate(appointment.id); } }}>{cancel.isPending ? "Cancelling…" : "Cancel"}</button></div>}
        </article>)}</div>}
        {error && <p className="pa-error" role="alert">{error}</p>}
        {editing && <div className="pa-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(null); }}><section className="pa-dialog" role="dialog" aria-modal="true" aria-labelledby="reschedule-title"><button className="pa-dialog-close" onClick={() => setEditing(null)} aria-label="Close">×</button><p className="pa-eyebrow">UPDATE YOUR VISIT</p><h2 id="reschedule-title">Reschedule appointment</h2><label>Date<input type="date" min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)} value={date} onChange={(event) => { setDate(event.target.value); setTime(""); }} /></label><div className="pa-slot-picker"><span>Available times</span>{slots.isSuccess && <div className="pb-capacity" role="status"><span><strong>{slots.data.booked}</strong> booked</span><span><strong>{slots.data.dailyLimit ?? "—"}</strong> daily limit</span><span><strong>{slots.data.remaining ?? "∞"}</strong> available</span></div>}{slots.isPending ? <p>Checking available times…</p> : slots.isError ? <p role="alert">Couldn't load available times. Choose another date.</p> : slots.data?.items.length ? <div>{slots.data.items.map((slot) => <button type="button" className={time === slot.slice(0, 5) ? "is-selected" : ""} key={slot} onClick={() => setTime(slot.slice(0, 5))}>{slot.slice(0, 5)}</button>)}</div> : <p>{slots.data?.remaining === 0 ? `Daily appointment limit reached (${slots.data.booked} of ${slots.data.dailyLimit}).` : "No times are available on this date."}</p>}</div><div className="pa-dialog-actions"><button onClick={() => setEditing(null)}>Keep appointment</button><button className="pa-confirm" disabled={!date || !time || reschedule.isPending} onClick={() => reschedule.mutate({ id: editing.id, day: date, time })}>{reschedule.isPending ? "Saving…" : "Save new time"}</button></div></section></div>}
        <section className="pa-account"><div><h2>Your patient record</h2><p>MPI: {records.data?.mpiNumber ?? "—"}</p></div><Button variant="secondary" icon={<LogOut className="size-4" />} onClick={handleSignOut}>Sign out</Button></section>
        <section className="pa-history"><h2>Visit history</h2>{records.isPending ? <p>Loading your patient record…</p> : records.data?.visits.length ? <ol>{records.data.visits.map((visit) => <li key={visit.id}><strong>{visit.visitType.replaceAll("_", " ")} · {visit.serviceStream.replaceAll("_", " ")}</strong><span>{visit.facilityName ?? "Clinic"} · {new Date(visit.visitDateTime).toLocaleString()}</span></li>)}</ol> : <p>No visits are linked to your record yet.</p>}</section>
      </div></main>
    </div>
  );
}
