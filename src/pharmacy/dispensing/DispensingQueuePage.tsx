import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pill } from "lucide-react";
import { getFacilities } from "@/shared/api/facilities";
import { PageHeader } from "@/shared/components/PageHeader";
import { Select } from "@/shared/components/Select";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { SkeletonRows } from "../components/SkeletonRows";
import { describeError } from "../lib/problem";
import { useDispensingQueue } from "./hooks/useDispensingQueue";
import { OpenedPrescription } from "./OpenedPrescription";
import { PrescriptionCard } from "./PrescriptionCard";
import { SearchPanel } from "./SearchPanel";
import { StockArrivalsBanner } from "./StockArrivalsBanner";

// Dispensing is gated server-side on a current SAPC registration; this page
// does not pre-check it. A 403 surfaces as a toast on the action that was
// refused, which is harder to miss than a banner at the top of a long queue.
export function DispensingQueuePage() {
  const [chosenFacilityId, setChosenFacilityId] = useState("");
  const [openedId, setOpenedId] = useState<string | null>(null);

  const facilitiesQuery = useQuery({ queryKey: ["facilities"], queryFn: getFacilities });
  const facilities = facilitiesQuery.data ?? [];
  // Default to the first facility without an effect: derived state cannot go stale.
  const facilityId = chosenFacilityId || facilities[0]?.id || "";

  const queue = useDispensingQueue(facilityId);
  // A pinned card replaces its own copy in the queue rather than appearing twice.
  const waiting = (queue.data ?? []).filter((p) => p.id !== openedId);

  function changeFacility(id: string) {
    setChosenFacilityId(id);
    setOpenedId(null);
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Dispensing"
        description="Prescriptions waiting to be dispensed, oldest first."
        action={
          facilities.length > 1 && (
            <Select
              label="Facility"
              value={facilityId}
              options={facilities.map((f) => ({ value: f.id, label: f.name }))}
              onChange={(event) => changeFacility(event.target.value)}
            />
          )
        }
      />

      {facilityId && (
        <>
          <SearchPanel key={facilityId} facilityId={facilityId} openedId={openedId} onOpen={setOpenedId} />
          <StockArrivalsBanner facilityId={facilityId} onReview={setOpenedId} />
          {openedId && <OpenedPrescription prescriptionId={openedId} onClose={() => setOpenedId(null)} />}
        </>
      )}

      <section aria-label="Waiting to be dispensed" className="flex flex-col gap-3">
        {facilitiesQuery.isError && (
          <ErrorState message={describeError(facilitiesQuery.error)} onRetry={() => void facilitiesQuery.refetch()} />
        )}
        {(facilitiesQuery.isLoading || queue.isLoading) && <SkeletonRows rows={4} />}
        {queue.isError && (
          <ErrorState message={describeError(queue.error)} onRetry={() => void queue.refetch()} retrying={queue.isFetching} />
        )}
        {queue.data && waiting.length === 0 && (
          <EmptyState icon={Pill} title="Nothing waiting to be dispensed" description="New prescriptions appear here as doctors send them." />
        )}
        {waiting.map((prescription) => (
          <PrescriptionCard key={prescription.id} prescription={prescription} />
        ))}
      </section>
    </div>
  );
}
