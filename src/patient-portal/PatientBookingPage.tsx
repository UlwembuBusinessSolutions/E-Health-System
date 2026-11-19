import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, ChevronRight, Clock3, MapPin, Stethoscope, UserRound } from "lucide-react";
import { ApiError } from "@/shared/api/client";
import {
  bookPatientAppointment,
  getPatientBookingFacilities,
  getPatientBookingProviders,
  getPatientBookingServices,
  getPatientBookingSlots,
  type PatientBookingFacility,
  type PatientBookingProvider,
  type PatientBookingService,
} from "@/shared/api/patientBooking";
import { usePatientAuth } from "./PatientAuthContext";
import "./patient-booking.css";

const stepNames = ["Service", "Facility", "Provider", "Date & time", "Review"];

function localDateAfter(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function prettyDate(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function toMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "We couldn't complete your booking. Please try again.";
}

export function PatientBookingPage() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { account } = usePatientAuth();
  const requestId = useRef(crypto.randomUUID());
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [service, setService] = useState<PatientBookingService | null>(null);
  const [facility, setFacility] = useState<PatientBookingFacility | null>(null);
  const [provider, setProvider] = useState<PatientBookingProvider | null>(null);
  const [date, setDate] = useState(localDateAfter(1));
  const [time, setTime] = useState("");
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{ date: string; time: string; facility: string; service: string; provider: string | null } | null>(null);

  const services = useQuery({ queryKey: ["patient-booking", "services"], queryFn: getPatientBookingServices });
  const facilities = useQuery({ queryKey: ["patient-booking", "facilities"], queryFn: getPatientBookingFacilities });
  const providers = useQuery({
    queryKey: ["patient-booking", "providers", facility?.id],
    queryFn: () => getPatientBookingProviders(facility!.id),
    enabled: Boolean(started && step === 2 && facility),
  });
  const slots = useQuery({
    queryKey: ["patient-booking", "slots", facility?.id, date, provider?.id ?? null],
    queryFn: () => getPatientBookingSlots(facility!.id, date, provider?.id ?? null),
    enabled: Boolean(started && step === 3 && facility && date),
  });

  const earliestSlot = useQuery({
    queryKey: ["patient-booking", "earliest-slot", facilities.data?.[0]?.id],
    queryFn: async () => {
      const firstFacility = facilities.data?.[0];
      if (!firstFacility) return null;
      const firstDaySlots = await getPatientBookingSlots(firstFacility.id, localDateAfter(1), null);
      return firstDaySlots[0] ? { date: localDateAfter(1), time: firstDaySlots[0] } : null;
    },
    enabled: Boolean(facilities.data?.length),
  });

  const mutation = useMutation({
    mutationFn: bookPatientAppointment,
    onSuccess: () => {
      requestId.current = crypto.randomUUID();
      setConfirmed({
        date,
        time,
        facility: facility?.name ?? "Clinic",
        service: service?.name ?? "Appointment",
        provider: provider?.name ?? null,
      });
      setBookingError(null);
    },
    onError: (error) => setBookingError(toMessage(error)),
  });

  const selectedService = service;
  const tomorrow = localDateAfter(1);

  const beginBooking = () => {
    setStarted(true);
    setStep(0);
    setBookingError(null);
    requestId.current = crypto.randomUUID();
    window.setTimeout(() => document.getElementById("patient-booking-wizard")?.scrollIntoView({ behavior: "smooth" }), 20);
  };

  const next = () => {
    if (step === 0 && !service) return;
    if (step === 1 && !facility) return;
    if (step === 3 && (!date || !time)) return;
    setBookingError(null);
    setStep((current) => Math.min(4, current + 1));
  };

  const submitBooking = () => {
    if (!service || !facility || !date || !time) return;
    setBookingError(null);
    mutation.mutate({
      requestId: requestId.current,
      facilityId: facility.id,
      serviceCode: service.code,
      providerId: provider?.id ?? null,
      date,
      time,
    });
  };

  if (!tenantSlug) return null;
  const portalUrl = `/org/${tenantSlug}/patient/portal`;

  return (
    <main className="patient-booking">
      {!started && !confirmed && (
        <section className="pb-home-hero">
          <div className="pb-home-copy">
            <p className="pb-home-eyebrow">ULWEMBU PATIENT BOOKING</p>
            <h1>Healthcare,<br /><em>without the</em><br />Waiting room.</h1>
            <p className="pb-home-intro">Find the right care, choose when you want it, and manage your appointments from one calm, simple place.</p>
            <div className="pb-home-actions">
              <button type="button" className="pb-book-button" onClick={beginBooking}>Book an appointment <ArrowRight aria-hidden /></button>
              <button type="button" className="pb-explore-button" onClick={beginBooking}>Explore services</button>
            </div>
            <p className="pb-account-note">Signed in as {account?.firstName}. Your booking is linked to your patient record.</p>
          </div>
          <div className="pb-home-photo" role="img" aria-label="A healthcare professional caring for a patient">
            <div className="pb-next-card">
              <span>NEXT AVAILABLE</span>
              {earliestSlot.data ? <strong>{new Date(`${earliestSlot.data.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "long" })} · {earliestSlot.data.time.slice(0, 5)}</strong> : <strong>{facilities.isPending ? "Checking availability…" : "Choose a time that works for you"}</strong>}
              <b>General consultation</b>
            </div>
          </div>
        </section>
      )}

      {started && !confirmed && (
        <section className="pb-wizard" id="patient-booking-wizard">
          <div className="pb-wizard-hero">
            <div className="pb-wizard-heading">
              <button type="button" className="pb-breadcrumb" onClick={() => { setStarted(false); setBookingError(null); }}>
                Home <span>/</span> Book appointment
              </button>
              <p className="pb-step-count">STEP {String(step + 1).padStart(2, "0")} OF 05</p>
              <h2>{step === 0 ? "What kind of care are you looking for?" : step === 1 ? "Where would you like to be seen?" : step === 2 ? "Who would you like to see?" : step === 3 ? "Choose a date and time." : "Review your appointment."}</h2>
              <p>{step === 0 ? "Start with the reason for your visit. You can change your choices before confirming the appointment." : step === 1 ? "Choose a clinic that is convenient for you." : step === 2 ? "Choose a provider, or let the clinic assign one for you." : step === 3 ? "Available appointment times are shown in the clinic’s local time." : "Check your details before you confirm."}</p>
            </div>
          </div>

          <div className="pb-progress-wrap">
            <ol className="pb-progress" aria-label="Appointment booking progress">
              {stepNames.map((name, index) => (
                <li key={name} className={index === step ? "is-current" : index < step ? "is-complete" : ""}>
                  <span>{index < step ? <Check size={16} aria-hidden /> : index + 1}</span>
                  <b>{name}</b>
                </li>
              ))}
            </ol>
          </div>

          <div className="pb-wizard-layout">
            <div className="pb-wizard-main">
          <div className="pb-step-content">
            {bookingError && <div className="pb-error" role="alert">{bookingError}</div>}
            {step === 0 && (
              <div className="pb-option-grid">
                {services.isPending ? <p className="pb-state">Loading appointment services…</p> : services.isError ? <RetryState message="We couldn't load services." retry={() => void services.refetch()} /> : services.data?.map((item) => (
                  <button type="button" key={item.code} className={`pb-option-card ${service?.code === item.code ? "is-selected" : ""}`} onClick={() => setService(item)}>
                    <span className="pb-option-icon"><Stethoscope size={22} aria-hidden /></span><span className="pb-option-title">{item.name}</span><span className="pb-option-description">{item.description}</span><span className="pb-radio" aria-hidden />
                  </button>
                ))}
              </div>
            )}
            {step === 1 && (
              <div className="pb-option-grid">
                {facilities.isPending ? <p className="pb-state">Loading clinics…</p> : facilities.isError ? <RetryState message="We couldn't load clinics." retry={() => void facilities.refetch()} /> : facilities.data?.length ? facilities.data.map((item) => (
                  <button type="button" key={item.id} className={`pb-option-card ${facility?.id === item.id ? "is-selected" : ""}`} onClick={() => { setFacility(item); setProvider(null); }}>
                    <span className="pb-option-icon"><MapPin size={22} aria-hidden /></span><span className="pb-option-title">{item.name}</span><span className="pb-option-description">{item.address || "Clinic location"}{item.operatingHours ? ` · ${item.operatingHours}` : ""}</span><span className="pb-radio" aria-hidden />
                  </button>
                )) : <p className="pb-state">This clinic has no active booking locations yet. Please contact the clinic.</p>}
              </div>
            )}
            {step === 2 && (
              <div className="pb-option-grid">
                {providers.isPending ? <p className="pb-state">Loading available providers…</p> : providers.isError ? <RetryState message="We couldn't load providers." retry={() => void providers.refetch()} /> : <>
                  <button type="button" className={`pb-option-card ${provider === null ? "is-selected" : ""}`} onClick={() => setProvider(null)}>
                    <span className="pb-option-icon"><UserRound size={22} aria-hidden /></span><span className="pb-option-title">No preference</span><span className="pb-option-description">The clinic will assign an available provider.</span><span className="pb-radio" aria-hidden />
                  </button>
                  {providers.data?.map((item) => <button type="button" key={item.id} className={`pb-option-card ${provider?.id === item.id ? "is-selected" : ""}`} onClick={() => setProvider(item)}>
                    <span className="pb-option-icon"><UserRound size={22} aria-hidden /></span><span className="pb-option-title">{item.name}</span><span className="pb-option-description">{item.designation || "Care provider"}</span><span className="pb-radio" aria-hidden />
                  </button>)}
                </>}
              </div>
            )}
            {step === 3 && (
              <div className="pb-date-time">
                <label className="pb-date-field">Appointment date<input type="date" min={tomorrow} value={date} onChange={(event) => { setDate(event.target.value); setTime(""); }} /></label>
                <div className="pb-slot-panel"><div className="pb-slot-heading"><Clock3 size={19} aria-hidden /><h3>Available times</h3><span>{prettyDate(date)}</span></div>
                  {slots.isPending ? <p className="pb-state">Checking availability…</p> : slots.isError ? <RetryState message="We couldn't check times for this date." retry={() => void slots.refetch()} /> : slots.data?.length ? <div className="pb-slot-grid">{slots.data.map((value) => <button type="button" className={`pb-slot ${time === value ? "is-selected" : ""}`} key={value} onClick={() => setTime(value)}>{value.slice(0, 5)}</button>)}</div> : <p className="pb-state">No times are available on this date. Choose another date.</p>}
                </div>
              </div>
            )}
            {step === 4 && selectedService && facility && (
              <div className="pb-review">
                <div className="pb-review-card"><div><span>CARE</span><strong>{selectedService.name}</strong><button type="button" onClick={() => setStep(0)}>Change</button></div><div><span>CLINIC</span><strong>{facility.name}</strong><small>{facility.address || ""}</small><button type="button" onClick={() => setStep(1)}>Change</button></div><div><span>PROVIDER</span><strong>{provider?.name ?? "No preference — clinic to assign"}</strong><button type="button" onClick={() => setStep(2)}>Change</button></div><div><span>DATE & TIME</span><strong>{prettyDate(date)} · {time.slice(0, 5)}</strong><button type="button" onClick={() => setStep(3)}>Change</button></div></div>
                <p className="pb-review-note">Booking for <strong>{account?.firstName} {account?.lastName}</strong>. A confirmation will be sent to your verified email.</p>
              </div>
            )}
          </div>

          <div className="pb-step-actions">
            <button type="button" className="pb-back-button" onClick={() => step === 0 ? setStarted(false) : setStep((current) => current - 1)}><ArrowLeft size={17} aria-hidden /> Back</button>
            {step < 4 ? <button type="button" className="pb-continue-button" onClick={next} disabled={step === 0 ? !service : step === 1 ? !facility : step === 2 ? providers.isPending || providers.isError : !time}>Continue <ArrowRight size={18} aria-hidden /></button> : <button type="button" className="pb-continue-button" onClick={submitBooking} disabled={mutation.isPending}>{mutation.isPending ? "Confirming…" : "Confirm appointment"} {!mutation.isPending && <ArrowRight size={18} aria-hidden />}</button>}
          </div>
            </div>

            <aside className="pb-appointment-summary" aria-live="polite" aria-label="Your appointment summary">
              <h3>Your appointment</h3>
              <SummaryRow label="Service" value={service?.name ?? "Not selected"} />
              <SummaryRow label="Facility" value={facility?.name ?? "Not selected"} />
              <SummaryRow label="Provider" value={provider?.name ?? (step > 2 ? "No preference" : "Not selected")} />
              <SummaryRow label="Date" value={time ? prettyDate(date) : "Not selected"} />
              <SummaryRow label="Time" value={time ? time.slice(0, 5) : "Not selected"} />
              <SummaryRow label="Payment" value="Not selected" />
            </aside>
          </div>
        </section>
      )}

      {confirmed && (
        <section className="pb-confirmation" role="status">
          <span className="pb-confirm-icon"><Check size={34} aria-hidden /></span>
          <p className="pb-home-eyebrow">BOOKING CONFIRMED</p>
          <h1>Your appointment is booked.</h1>
          <p className="pb-confirm-intro">We’ve sent a confirmation to your verified email address.</p>
          <div className="pb-confirm-card"><span>{confirmed.service}</span><strong>{confirmed.facility}</strong><p>{prettyDate(confirmed.date)} · {confirmed.time.slice(0, 5)}</p>{confirmed.provider && <p>With {confirmed.provider}</p>}</div>
          <div className="pb-home-actions"><button type="button" className="pb-book-button" onClick={() => navigate(portalUrl)}>Go to my patient portal <ArrowRight aria-hidden /></button><Link className="pb-explore-button" to={`/org/${tenantSlug}`}>Clinic home</Link></div>
        </section>
      )}

      {started && !confirmed && <div className="pb-wizard-footer"><Link to={portalUrl}><ChevronRight size={15} aria-hidden /> Return to your patient portal</Link></div>}
    </main>
  );
}

function RetryState({ message, retry }: { message: string; retry: () => void }) {
  return <div className="pb-state" role="alert"><p>{message}</p><button type="button" onClick={retry}>Try again</button></div>;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <div className="pb-summary-row"><span>{label}</span><strong>{value}</strong></div>;
}
