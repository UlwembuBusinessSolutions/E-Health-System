import { useId, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { openCollectionProof, type CollectionDetails } from "@/shared/api/pharmacy";
import { Button } from "@/shared/components/Button";
import { useToast } from "@/shared/components/toast/ToastProvider";
import { ErrorState } from "../components/ErrorState";
import { formatDateTime } from "../lib/format";
import { describeError } from "../lib/problem";
import { useCollectionDetails } from "./hooks/useCollectionDetails";
import { AUTHORISATION_LABELS, ID_TYPE_LABELS, relationshipLabel } from "./collectorOptions";

function summaryText(collection: CollectionDetails): string {
  const collector = collection.collectedByPatient
    ? "Collected by the patient"
    : `Collected by ${collection.collectorName ?? "a third party"}` +
      (collection.relationship ? ` (${relationshipLabel(collection.relationship)})` : "");
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

function ProofLink({ proofUrl }: { proofUrl: string }) {
  const { showToast } = useToast();
  const open = useMutation({
    mutationFn: () => openCollectionProof(proofUrl),
    onError: (error) => showToast(describeError(error, "Couldn't open the proof document."), "error"),
  });
  return (
    <Button variant="ghost" className="-ml-3" loading={open.isPending} onClick={() => open.mutate()}>
      Open proof of authorisation
    </Button>
  );
}

function ThirdPartyDetails({ details }: { details: CollectionDetails }) {
  return (
    <>
      <dl className="mt-2 flex flex-col gap-1.5 text-[13px]">
        <DetailRow term="ID type">{details.collectorIdType && ID_TYPE_LABELS[details.collectorIdType]}</DetailRow>
        <DetailRow term="ID number">{details.collectorIdNumber}</DetailRow>
        <DetailRow term="Contact number">{details.phone}</DetailRow>
        <DetailRow term="Authorisation">{details.authorisationType && AUTHORISATION_LABELS[details.authorisationType]}</DetailRow>
        <DetailRow term="ID checked at counter">{details.idVerified ? "Yes" : "No"}</DetailRow>
        <DetailRow term="Notes">{details.notes}</DetailRow>
      </dl>
      {details.proofUrl && <ProofLink proofUrl={details.proofUrl} />}
      {details.signatureDataUrl && (
        <img src={details.signatureDataUrl} alt="Collector's signature" className="mt-2 h-20 rounded border border-border-subtle bg-white" />
      )}
    </>
  );
}

// The server's queue and search rows say nothing about the hand-over, so the
// record is read on demand: the person opens it, and only then is it fetched.
// That also matters for privacy, because the server audits every read of a
// third party's personal details.
export function CollectionSummaryLine({ prescriptionId }: { prescriptionId: string }) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const details = useCollectionDetails(prescriptionId, expanded);

  return (
    <div className="rounded-lg bg-success-50 px-3.5 py-2.5">
      <Button
        variant="ghost"
        className="-ml-3"
        aria-expanded={expanded}
        aria-controls={panelId}
        icon={<CheckCircle2 className="size-4" aria-hidden />}
        onClick={() => setExpanded((open) => !open)}
      >
        {expanded ? "Hide hand-over record" : "View hand-over record"}
      </Button>
      <div id={panelId}>
        {expanded && (
          <>
            {details.isLoading && <p className="text-[13px] text-text-secondary">Loading…</p>}
            {details.isError && <ErrorState message={describeError(details.error)} onRetry={() => void details.refetch()} />}
            {details.data && (
              <>
                <p className="text-[13px] text-success-600">{summaryText(details.data)}</p>
                {!details.data.collectedByPatient && (
                  <>
                    <p className="mt-1 text-[12.5px] text-text-secondary">
                      Full details are visible to pharmacists and org admins. This view is logged.
                    </p>
                    <ThirdPartyDetails details={details.data} />
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
