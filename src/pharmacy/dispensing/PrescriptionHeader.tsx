import type { Prescription } from "@/shared/api/pharmacy";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
}

// Who the script is for and who wrote it: the facts a pharmacist checks
// before handing anything over.
export function PrescriptionHeader({ prescription: p }: { prescription: Prescription }) {
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
        <h3 className="text-[15.5px] font-semibold text-text-primary">{p.patientName}</h3>
        <span className="font-mono text-[12.5px] text-text-secondary">{p.patientMpi}</span>
      </div>
      <p className="mt-0.5 font-mono text-[12.5px] text-text-secondary">
        {p.serialNumber} · issued {formatTime(p.createdAt)}
      </p>
      <p className="mt-0.5 text-[12.5px] text-text-secondary">
        Prescribed by {p.prescriberName ?? "Unknown"}
        {p.prescriberRegistrationNumber && (
          <span className="font-mono"> · Reg. {p.prescriberRegistrationNumber}</span>
        )}
      </p>
    </div>
  );
}
