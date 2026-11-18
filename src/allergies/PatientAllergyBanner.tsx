import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import clsx from "clsx";
import { getPatientAllergies } from "@/shared/api/allergies";
import { StatusPill } from "@/shared/components/StatusPill";
import { allergyQueryKey } from "./RegisteredAllergies";
import { activeAllergies, ALLERGEN_TYPE_LABEL, SEVERITY_LABEL, severityTone } from "./allergyLabels";

// Always-visible allergy status for the patient, shown above every tab of the patient record (overview,
// visits, vitals, consultation, medication) so it is in front of the clinician during a first-visit
// assessment, a consultation and prescribing. Read-only — editing happens on the Allergies page.
export function PatientAllergyBanner({ patientId }: { patientId: string }) {
  const query = useQuery({ queryKey: allergyQueryKey(patientId), queryFn: () => getPatientAllergies(patientId) });
  const manageLink = (
    <Link to={`/app/patients/${patientId}/allergies`} className="shrink-0 text-[13px] font-semibold text-brand-600 hover:underline">
      Manage allergies
    </Link>
  );

  if (query.isLoading) return <div className="mb-4 h-14 animate-pulse rounded-lg bg-surface-sunken" aria-hidden />;
  if (query.isError || !query.data) {
    return (
      <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/40 bg-amber-50 px-3.5 py-2.5">
        <p className="text-[13.5px] text-text-primary">The allergy record could not be loaded. Check allergies with the patient before treating.</p>
        {manageLink}
      </div>
    );
  }

  const record = query.data;
  const active = activeAllergies(record);

  if (record.status === "KNOWN" && active.length > 0) {
    return (
      <div role="alert" className="mb-4 rounded-lg border border-danger-500/40 bg-danger-50 px-3.5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-danger-600" aria-hidden />
            <h2 className="text-[14px] font-semibold text-danger-600">
              Known allergies ({active.length})
            </h2>
          </div>
          {manageLink}
        </div>
        <ul className="mt-2 flex flex-col gap-1.5">
          {active.map((allergy) => (
            <li key={allergy.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] text-text-primary">
              <strong>{allergy.allergyName}</strong>
              <StatusPill tone={severityTone(allergy.severity)}>{SEVERITY_LABEL[allergy.severity]}</StatusPill>
              <span className="text-text-secondary">
                {ALLERGEN_TYPE_LABEL[allergy.allergenType]}
                {allergy.allergyCode ? ` · ${allergy.allergyCode}` : ""} · {allergy.reaction}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const noKnown = record.status === "NONE_KNOWN";
  return (
    <div
      role="status"
      className={clsx(
        "mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3.5 py-2.5",
        noKnown ? "border-success-500/30 bg-success-50" : "border-amber-500/40 bg-amber-50",
      )}
    >
      <div className="flex items-center gap-2">
        {noKnown ? (
          <ShieldCheck className="size-4 text-success-600" aria-hidden />
        ) : (
          <ShieldQuestion className="size-4 text-amber-600" aria-hidden />
        )}
        <p className="text-[13.5px] text-text-primary">
          {noKnown
            ? "No known allergies (confirmed with the patient)."
            : "Allergy status unknown — this patient has not been asked yet. Ask and record it before prescribing."}
        </p>
      </div>
      {manageLink}
    </div>
  );
}