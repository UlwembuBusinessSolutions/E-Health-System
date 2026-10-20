import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";
import type { DashboardAppointment, DashboardAppointmentStatus, PharmacyMessage } from "@/shared/api/clinicianDashboard";
import type { InProgressConsultation } from "@/shared/api/consultations";
import { Card } from "@/shared/components/Card";

const LINK_BUTTON =
  "inline-flex min-h-11 shrink-0 items-center rounded-lg border border-border-strong bg-surface-raised px-4 text-[13.5px] font-semibold text-text-primary transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400";

function SideCard({ id, title, description, children }: { id: string; title: string; description: string; children: ReactNode }) {
  return (
    <Card className="p-5" id={id}>
      <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-3">
        <div>
          <h2 id={`${id}-heading`} className="text-[15.5px] font-semibold text-text-primary">{title}</h2>
          <p className="mt-0.5 text-[13px] text-text-secondary">{description}</p>
        </div>
        {children}
      </section>
    </Card>
  );
}

function Quiet({ children }: { children: ReactNode }) {
  return <p className="text-[13.5px] text-text-secondary">{children}</p>;
}

const DAY_MS = 86_400_000;

function startedText(iso: string, now: Date): string {
  const started = new Date(iso);
  const time = `${String(started.getHours()).padStart(2, "0")}:${String(started.getMinutes()).padStart(2, "0")}`;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (started.getTime() >= startOfToday) return `Started today at ${time}`;
  if (started.getTime() >= startOfToday - DAY_MS) return `Started yesterday at ${time}`;
  return `Started ${started.getDate()} ${started.toLocaleString("en-ZA", { month: "short" })} at ${time}`;
}

export function NotesToSignCard({ entries, loading, failed, now }: { entries: InProgressConsultation[]; loading: boolean; failed: boolean; now: Date }) {
  return (
    <SideCard id="notes-to-sign" title="Notes to sign" description="Consultations you started but have not signed.">
      {loading ? (
        <Quiet>Loading…</Quiet>
      ) : failed ? (
        <Quiet>Your unsigned consultations couldn't be loaded. They are still on each patient's record.</Quiet>
      ) : entries.length === 0 ? (
        <Quiet>All your consultations are signed.</Quiet>
      ) : (
        <ul className="flex flex-col">
          {entries.map((entry) => {
            const old = now.getTime() - new Date(entry.startedAt).getTime() > DAY_MS;
            return (
              <li key={entry.consultationId} className="flex items-center justify-between gap-3 border-b border-border-subtle py-2.5 last:border-b-0">
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-semibold text-text-primary">{entry.patientName}</p>
                  <p className="text-[12px] text-text-secondary">
                    {startedText(entry.startedAt, now)} · {entry.facilityName}
                    {old && <span className="font-semibold text-warning-600"> · over a day old</span>}
                  </p>
                </div>
                <Link to={`/app/patients/${entry.patientId}?visitId=${entry.visitId}&tab=consultation`} className={LINK_BUTTON}>
                  Continue
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </SideCard>
  );
}

const STATUS: Record<DashboardAppointmentStatus, { label: string; className: string }> = {
  SEEN: { label: "Seen", className: "bg-surface-sunken text-text-secondary" },
  IN_QUEUE: { label: "In the queue", className: "bg-brand-50 text-brand-700" },
  NOT_ARRIVED: { label: "Not arrived", className: "bg-warning-50 text-warning-600" },
  BOOKED: { label: "Booked", className: "border border-border-subtle text-text-secondary" },
};

export function AppointmentsCard({ appointments, next }: { appointments: DashboardAppointment[]; next: DashboardAppointment | undefined }) {
  return (
    <SideCard id="my-appointments" title="My appointments today" description="Booked with you at this facility.">
      {appointments.length === 0 ? (
        <Quiet>No appointments booked with you today.</Quiet>
      ) : (
        <ol className="flex flex-col">
          {appointments.map((appointment) => {
            const status = STATUS[appointment.status];
            const isNext = appointment.appointmentId === next?.appointmentId;
            const done = appointment.status === "SEEN";
            return (
              <li
                key={appointment.appointmentId}
                className={clsx("flex items-center gap-3 rounded-lg px-2 py-2", isNext && "bg-surface-sunken")}
                aria-current={isNext ? "true" : undefined}
              >
                <span className={clsx("w-12 shrink-0 text-[13.5px] font-semibold tabular-nums", done ? "text-text-secondary" : "text-text-primary")}>
                  {appointment.time}
                </span>
                <Link
                  to={`/app/patients/${appointment.patientId}`}
                  className={clsx("min-w-0 flex-1 truncate text-[13.5px] underline-offset-2 hover:underline", done ? "text-text-secondary" : "text-text-primary")}
                >
                  {appointment.patientName}
                </Link>
                <span className={clsx("shrink-0 rounded-full px-2 py-0.5 text-[12px] font-semibold", status.className)}>{status.label}</span>
              </li>
            );
          })}
        </ol>
      )}
    </SideCard>
  );
}

function sentText(iso: string, now: Date): string {
  const sent = new Date(iso);
  const time = `${String(sent.getHours()).padStart(2, "0")}:${String(sent.getMinutes()).padStart(2, "0")}`;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (sent.getTime() >= startOfToday) return `Today ${time}`;
  if (sent.getTime() >= startOfToday - DAY_MS) return `Yesterday ${time}`;
  return `${sent.getDate()} ${sent.toLocaleString("en-ZA", { month: "short" })} ${time}`;
}

export function PharmacyMessagesCard({ messages, now }: { messages: PharmacyMessage[]; now: Date }) {
  return (
    <SideCard id="pharmacy-messages" title="Messages from the pharmacy" description="About prescriptions you wrote, last 7 days.">
      {messages.length === 0 ? (
        <Quiet>No messages from the pharmacy in the last 7 days.</Quiet>
      ) : (
        <ul className="flex flex-col gap-3">
          {messages.map((message) => (
            <li key={message.messageId} className="flex flex-col gap-1.5 rounded-xl border border-border-subtle px-3.5 py-3">
              <div className="flex flex-wrap justify-between gap-x-2 gap-y-0.5">
                <span className="text-[13px] font-semibold text-text-primary">
                  {message.patientName} · {message.serialNumber}
                </span>
                <span className="text-[12px] text-text-secondary">{sentText(message.sentAt, now)}</span>
              </div>
              <p className="whitespace-pre-line break-words text-[13.5px] leading-relaxed text-text-primary">{message.message}</p>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[12px] text-text-secondary">{message.senderName ?? "Pharmacy"}</span>
                <Link to={`/app/patients/${message.patientId}?tab=medication`} className={LINK_BUTTON}>
                  Open prescription
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SideCard>
  );
}
