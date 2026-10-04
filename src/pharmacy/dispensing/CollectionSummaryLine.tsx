import { useId, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import type { CollectionDetails, CollectionSummary } from "@/shared/api/pharmacy";
import { Button } from "@/shared/components/Button";
import { ErrorState } from "../components/ErrorState";
import { formatDateTime } from "../lib/format";
import { describeError } from "../lib/problem";
import { useCollectionDetails } from "./hooks/useCollectionDetails";
import { AUTHORISATION_LABELS, ID_TYPE_LABELS } from "./collectorOptions";

function summaryText(collection: CollectionSummary): string {
  const collector = collection.collectedByPatient
    ? "Collected by the patient"
    : `Collected by ${collection.collectorName ?? "a third party"}` +
      (collection.relationship ? ` (${collection.relationship})` : "") +
      (collection.maskedIdNumber ? ` · ID ${collection.maskedIdNumber}` : "");
  return `${collector} · handed over by ${collection.handedOverByName} · ${formatDateTime(collection.handedOverAt)}`;
}

function DetailRow({ term, children }: { term: string; children: string | null }) {
  if (!children) return null;
  return (
    <div className="flex flex-col sm:flex-row sm:gap-3">
      <dt className="w-40 shrink-0 text-text-secondary">{term}</dt>
      <dd className="text-text-primary">{children}</dd>
    </div>
  );
}

function FullDetails({ details }: { details: CollectionDetails }) {
  return (
    <dl className="mt-2 flex flex-col gap-1.5 text-[13px]">
      <DetailRow term="ID type">{details.collectorIdType && ID_TYPE_LABELS[details.collectorIdType]}</DetailRow>
      <DetailRow term="ID number">{details.collectorIdNumber}</DetailRow>
      <DetailRow term="Contact number">{details.phone}</DetailRow>
      <DetailRow term="Authorisation">{details.authorisationType && AUTHORISATION_LABELS[details.authorisationType]}</DetailRow>
      <DetailRow term="ID checked at counter">{details.idVerified ? "Yes" : "No"}</DetailRow>
      <DetailRow term="Notes">{details.notes}</DetailRow>
      <div className="flex gap-4">
        {details.proofUrl && (
          <a className="font-medium text-text-accent underline" href={details.proofUrl} target="_blank" rel="noreferrer">
            Open proof of authorisation
          </a>
        )}
        {details.signatureUrl && (
          <a className="font-medium text-text-accent underline" href={details.signatureUrl} target="_blank" rel="noreferrer">
            Open signature
          </a>
        )}
      </div>
    </dl>
  );
}

// The one-line hand-over record, plus (for third parties) an expander with the
// full personal details. Those are fetched only on open because the server
// audits every read.
export function CollectionSummaryLine({ prescriptionId, collection }: { prescriptionId: string; collection: CollectionSummary }) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const details = useCollectionDetails(prescriptionId, expanded);

  return (
    <div className="rounded-lg bg-success-50 px-3.5 py-2.5">
      <p className="flex items-start gap-2 text-[13px] text-success-600">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
        {summaryText(collection)}
      </p>
      {!collection.collectedByPatient && (
        <>
          <Button
            variant="ghost"
            className="-ml-3"
            aria-expanded={expanded}
            aria-controls={panelId}
            onClick={() => setExpanded((open) => !open)}
          >
            {expanded ? "Hide details" : "View full details"}
          </Button>
          <div id={panelId}>
            {expanded && (
              <>
                <p className="text-[12.5px] text-text-secondary">
                  Full details are visible to pharmacists and org admins. This view is logged.
                </p>
                {details.isLoading && <p className="mt-2 text-[13px] text-text-secondary">Loading details…</p>}
                {details.isError && (
                  <ErrorState message={describeError(details.error)} onRetry={() => void details.refetch()} />
                )}
                {details.data && <FullDetails details={details.data} />}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
