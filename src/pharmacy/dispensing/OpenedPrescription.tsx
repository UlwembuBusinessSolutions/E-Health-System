import { X } from "lucide-react";
import { Button } from "@/shared/components/Button";
import { ErrorState } from "../components/ErrorState";
import { SkeletonRows } from "../components/SkeletonRows";
import { describeError } from "../lib/problem";
import { useOpenedPrescription } from "./hooks/usePrescriptionSearch";
import { PrescriptionCard } from "./PrescriptionCard";

interface OpenedPrescriptionProps {
  prescriptionId: string;
  onClose: () => void;
}

// A prescription picked from search or the arrivals banner, pinned above the
// queue. It may have already left the queue (dispensed, or all out of stock),
// so it is fetched on its own rather than found in the queue list.
export function OpenedPrescription({ prescriptionId, onClose }: OpenedPrescriptionProps) {
  const opened = useOpenedPrescription(prescriptionId);

  return (
    <section aria-label="Opened from search" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[12.5px] font-semibold uppercase tracking-wide text-brand-600">Opened from search</h2>
        <Button variant="ghost" icon={<X className="size-4" aria-hidden />} onClick={onClose}>
          Close
        </Button>
      </div>
      {opened.isLoading && <SkeletonRows rows={3} />}
      {opened.isError && (
        <ErrorState message={describeError(opened.error)} onRetry={() => void opened.refetch()} retrying={opened.isFetching} />
      )}
      {opened.data && <PrescriptionCard prescription={opened.data} />}
    </section>
  );
}
