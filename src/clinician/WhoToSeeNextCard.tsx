import { Link } from "react-router-dom";
import clsx from "clsx";
import { Users } from "lucide-react";
import type { ClinicianDashboard, WaitingPatient } from "@/shared/api/clinicianDashboard";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { TriageColourBadge } from "@/shared/components/TriageColourBadge";
import { plural } from "@/shared/lib/chartFormat";
import { EmptyState } from "@/pharmacy/components/EmptyState";
import { TRIAGE, patientFacts, streamLabel, targetSpan, targetText, triageKey, triageMix, waitText } from "./clinicianModel";

interface Props {
  waiting: ClinicianDashboard["waiting"];
  canCall: boolean;
  callingTokenId: string | undefined;
  onCall: (patient: WaitingPatient) => void;
}

export function WhoToSeeNextCard({ waiting, canCall, callingTokenId, onCall }: Props) {
  const { patients, total } = waiting;
  const mix = triageMix(waiting.byColour);

  return (
    <Card className="flex min-w-0 flex-[3_1_32rem] flex-col gap-4 p-5" id="who-to-see-next">
      <section aria-labelledby="who-heading" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-[1_1_240px]">
            <h2 id="who-heading" className="text-[15.5px] font-semibold text-text-primary">Who to see next</h2>
            <p className="mt-0.5 text-[13px] text-text-secondary">Sorted by triage colour, then longest wait.</p>
          </div>
          <Link
            to="/app/queue"
            className="inline-flex min-h-11 items-center rounded-lg border border-border-strong bg-surface-raised px-4 text-[13.5px] font-semibold text-text-primary transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            Open the queue
          </Link>
        </div>

        {total === 0 ? (
          <EmptyState icon={Users} title="Nobody is waiting" description="Patients appear here as soon as they get a ticket today." />
        ) : (
          <>
            <div>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <h3 className="text-[13px] font-semibold text-text-primary">Waiting room by triage colour</h3>
                <span className="text-[12px] text-text-secondary">{plural(total, "patient")} waiting</span>
              </div>
              <div
                role="img"
                aria-label={`Waiting room: ${mix.map((m) => `${m.count} ${TRIAGE[m.key].label.toLowerCase()}`).join(", ")}`}
                className="flex h-3.5 gap-[2px] overflow-hidden rounded"
              >
                {mix.filter((m) => m.count > 0).map((m) => (
                  <div key={m.key} className={TRIAGE[m.key].barClassName} style={{ flex: `${m.count} 1 0` }} />
                ))}
              </div>
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-text-secondary" aria-hidden>
                {mix.map((m) => (
                  <li key={m.key} className="inline-flex items-center gap-1.5">
                    <span className={`size-3 rounded-[3px] ${TRIAGE[m.key].barClassName}`} />
                    {TRIAGE[m.key].label} <strong className="text-text-primary">{m.count}</strong>
                  </li>
                ))}
              </ul>
            </div>

            <ol className="border-t border-border-subtle">
              {patients.map((patient, index) => (
                <PatientRow
                  key={patient.tokenId}
                  patient={patient}
                  first={index === 0}
                  canCall={canCall}
                  calling={callingTokenId === patient.tokenId}
                  busy={callingTokenId !== undefined}
                  onCall={() => onCall(patient)}
                />
              ))}
            </ol>
            {total > patients.length && (
              <p className="text-[12.5px] text-text-secondary">
                Showing the first {patients.length} of {total}. <Link to="/app/queue" className="font-semibold text-text-accent underline-offset-2 hover:underline">See everyone in the queue</Link>
              </p>
            )}
          </>
        )}
      </section>
    </Card>
  );
}

interface RowProps {
  patient: WaitingPatient;
  first: boolean;
  canCall: boolean;
  calling: boolean;
  busy: boolean;
  onCall: () => void;
}

function PatientRow({ patient, first, canCall, calling, busy, onCall }: RowProps) {
  const facts = patientFacts(patient);
  return (
    <li
      className={clsx(
        "flex flex-wrap items-center gap-x-3.5 gap-y-2 border-b border-border-subtle px-1 py-3",
        patient.overTarget && "bg-critical-50",
      )}
    >
      <span className="w-[6.5rem] shrink-0">
        {patient.triageColour ? (
          <TriageColourBadge colour={patient.triageColour} />
        ) : (
          <span className="inline-flex items-center rounded-full border border-border-strong bg-surface-sunken px-2.5 py-1 text-[12px] font-semibold text-text-secondary">
            {TRIAGE[triageKey(null)].label}
          </span>
        )}
      </span>
      <div className="min-w-0 flex-[1_1_12rem]">
        <p className="text-[14px] font-semibold text-text-primary">
          <Link to={`/app/patients/${patient.patientId}?visitId=${patient.visitId}`} className="underline-offset-2 hover:underline">
            {patient.patientName}
          </Link>
          {facts && <span className="font-normal text-text-secondary"> · {facts}</span>}
        </p>
        <p className="mt-0.5 text-[12px] text-text-secondary">
          Ticket {patient.ticketNumber}
          {patient.serviceStream && ` · ${streamLabel(patient.serviceStream)}`}
          {patient.priority && <span className="font-semibold text-text-accent"> · Priority</span>}
        </p>
      </div>
      <div className="min-w-[7rem] text-right">
        <p className="text-[13.5px] font-semibold tabular-nums text-text-primary">{waitText(patient.waitMinutes)}</p>
        {patient.targetMinutes === null ? (
          <p className="text-[12px] font-semibold text-warning-600">Needs triage</p>
        ) : patient.overTarget ? (
          <p className="text-[12px] font-semibold text-critical-600">
            {patient.targetMinutes === 0 ? "Needs to be seen now" : `Over ${targetSpan(patient.targetMinutes)} target`}
          </p>
        ) : (
          <p className="text-[12px] text-text-secondary">Target {targetText(patient.targetMinutes)}</p>
        )}
      </div>
      {canCall && (
        <Button
          variant={first ? "primary" : "secondary"}
          loading={calling}
          disabled={busy && !calling}
          onClick={onCall}
          aria-label={`Call ${patient.patientName}`}
        >
          Call
        </Button>
      )}
    </li>
  );
}
