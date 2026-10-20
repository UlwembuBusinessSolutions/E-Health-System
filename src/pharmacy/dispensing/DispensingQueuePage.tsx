import { useState } from "react";
import { Pill } from "lucide-react";
import { PageHeader } from "@/shared/components/PageHeader";
import { Button } from "@/shared/components/Button";
import { Input } from "@/shared/components/Input";
import { PaginationFooter } from "../components/PaginationFooter";
import { filterQueue, paginateQueue } from "./queueView";
import { Select } from "@/shared/components/Select";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { SkeletonRows } from "../components/SkeletonRows";
import { describeError } from "../lib/problem";
import { useFacilitySelection } from "../lib/useFacilitySelection";
import { useDispensingQueue } from "./hooks/useDispensingQueue";
import { OpenedPrescription } from "./OpenedPrescription";
import { PrescriptionCard } from "./PrescriptionCard";
import { SearchPanel } from "./SearchPanel";
import { StockArrivalsBanner } from "./StockArrivalsBanner";

// Dispensing is gated server-side on a current SAPC registration; this page
// does not pre-check it. A 403 surfaces as a toast on the action that was
// refused, which is harder to miss than a banner at the top of a long queue.
export function DispensingQueuePage() {
  const [openedId, setOpenedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [stock, setStock] = useState("ALL");
  const [order, setOrder] = useState("OLDEST");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const { facilities, facilityId, selectFacility, isLoading: facilitiesLoading, error: facilitiesError, refetch: refetchFacilities } =
    useFacilitySelection();

  const queue = useDispensingQueue(facilityId);
  // A pinned card replaces its own copy in the queue rather than appearing twice.
  const waiting = (queue.data ?? []).filter((p) => p.id !== openedId);

  const filtered = filterQueue(waiting, { query, status, stock, order });
  const paginated = paginateQueue(filtered, page, pageSize);

  function changeFacility(id: string) {
    setPage(0);
    selectFacility(id);
    setOpenedId(null);
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Dispensing"
        description="Find and dispense prescriptions waiting at your facility."
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

      {facilityId && (
        <section aria-label="Queue filters" className="rounded-xl border border-border-subtle bg-surface-raised p-4">
          <h2 className="mb-3 text-[15px] font-semibold text-text-primary">Waiting queue</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Input label="Filter waiting prescriptions" placeholder="RX number, patient name, MPI or prescriber"
              value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} />
            <Select label="Dispensing status" value={status} options={[
              { value: "ALL", label: "All waiting" }, { value: "PENDING", label: "Not started" },
              { value: "PARTIAL", label: "Partially dispensed" },
            ]} onChange={(e) => { setStatus(e.target.value); setPage(0); }} />
            <Select label="Stock availability" value={stock} options={[
              { value: "ALL", label: "All stock statuses" }, { value: "READY", label: "Fully in stock" },
              { value: "SHORT", label: "Insufficient stock" }, { value: "UNMAPPED", label: "Needs product mapping" },
            ]} onChange={(e) => { setStock(e.target.value); setPage(0); }} />
            <Select label="Sort by" value={order} options={[
              { value: "OLDEST", label: "Oldest first" }, { value: "NEWEST", label: "Newest first" },
            ]} onChange={(e) => { setOrder(e.target.value); setPage(0); }} />
            <Select label="Prescriptions per page" value={String(pageSize)} options={
              [5, 10, 25, 50].map((size) => ({ value: String(size), label: String(size) }))
            } onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }} />
            <div className="flex items-end">
              <Button variant="secondary" onClick={() => {
                setQuery(""); setStatus("ALL"); setStock("ALL"); setOrder("OLDEST"); setPage(0);
              }}>Clear filters</Button>
            </div>
          </div>
          <p className="mt-3 text-[13px] text-text-secondary" aria-live="polite">
            {filtered.length} of {waiting.length} waiting prescriptions match.
          </p>
        </section>
      )}

      <section aria-label="Waiting to be dispensed" className="flex flex-col gap-3">
        {facilitiesError && <ErrorState message={describeError(facilitiesError)} onRetry={() => void refetchFacilities()} />}
        {(facilitiesLoading || queue.isLoading) && <SkeletonRows rows={4} />}
        {queue.isError && (
          <ErrorState message={describeError(queue.error)} onRetry={() => void queue.refetch()} retrying={queue.isFetching} />
        )}
        {queue.data && waiting.length === 0 && (
          <EmptyState icon={Pill} title="Nothing waiting to be dispensed" description="New prescriptions appear here as doctors send them." />
        )}
        {queue.data && waiting.length > 0 && filtered.length === 0 && (
          <EmptyState icon={Pill} title="No matching prescriptions" description="Try another search or clear the queue filters." />
        )}
        {paginated.items.map((prescription) => (
          <PrescriptionCard key={prescription.id} prescription={prescription} />
        ))}
        {queue.data && !queue.isError && (
          <PaginationFooter page={paginated.page} size={pageSize} totalItems={filtered.length}
            hasMore={paginated.hasMore} onPageChange={setPage} />
        )}
      </section>
    </div>
  );
}
