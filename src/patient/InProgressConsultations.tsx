import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight, Stethoscope } from "lucide-react";
import { Card } from "@/shared/components/Card";
import { getInProgressConsultations, type InProgressConsultation } from "@/shared/api/consultations";

function savedAt(iso: string): string {
  return new Date(iso).toLocaleString("en-ZA", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function reopenPath(entry: InProgressConsultation): string {
  return `/app/patients/${entry.patientId}?visitId=${entry.visitId}&tab=consultation`;
}

// The clinician's unsigned consultations, so closing a patient's record never loses the way back to it. Shows
// nothing when there are none, and nothing for someone who cannot see consultations at all.
export function InProgressConsultations() {
  const query = useQuery({
    queryKey: ["in-progress-consultations"],
    queryFn: getInProgressConsultations,
    retry: false,
  });
  const entries = query.data ?? [];
  if (entries.length === 0) return null;

  return (
    <Card className="mb-6 p-5" role="region" aria-labelledby="in-progress-heading">
      <div className="mb-3 flex items-center gap-2">
        <Stethoscope className="size-4 text-text-secondary" aria-hidden />
        <h2 id="in-progress-heading" className="text-[14.5px] font-semibold text-text-primary">
          Consultations in progress ({entries.length})
        </h2>
      </div>
      <ul className="flex flex-col gap-2">
        {entries.map((entry) => (
          <li key={entry.consultationId}>
            <Link
              to={reopenPath(entry)}
              className="group flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface-sunken/40 px-4 py-3 transition-colors hover:border-brand-400 hover:bg-brand-50"
            >
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-semibold text-text-primary">{entry.patientName}</span>
                <span className="block text-[12.5px] text-text-secondary">
                  {entry.patientMpi} · {entry.facilityName} · saved {savedAt(entry.updatedAt)}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5 text-[13px] font-medium text-brand-600">
                Continue
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
