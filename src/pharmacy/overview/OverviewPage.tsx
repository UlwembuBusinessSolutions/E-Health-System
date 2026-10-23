import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getPharmacyOverview } from "@/shared/api/pharmacyOverview";
import { PageHeader } from "@/shared/components/PageHeader";
import { Select } from "@/shared/components/Select";
import { ErrorState } from "../components/ErrorState";
import { describeError } from "../lib/problem";
import { pharmacyKeys } from "../lib/queryKeys";
import { useFacilitySelection } from "../lib/useFacilitySelection";
import { ExpiryCard } from "./ExpiryCard";
import { OverviewTiles } from "./OverviewTiles";
import { PrescriptionsCard } from "./PrescriptionsCard";
import { StockCoverCard } from "./StockCoverCard";

// The pharmacy landing tab: what is waiting, what runs out or expires soon,
// and whether dispensing keeps up. Every figure comes from one request so the
// tiles and charts can never disagree with each other.
export function OverviewPage() {
  const { facilities, facilityId, selectFacility, isLoading: facilitiesLoading, error: facilitiesError, refetch: refetchFacilities } =
    useFacilitySelection();
  const overview = useQuery({
    queryKey: pharmacyKeys.overview.detail(facilityId),
    queryFn: () => getPharmacyOverview(facilityId),
    enabled: facilityId !== "",
    staleTime: 30_000,
    refetchInterval: 60_000,
    // Switching facility keeps the old figures on screen (dimmed) instead of flashing a skeleton.
    placeholderData: keepPreviousData,
  });

  const data = overview.data;
  const updatedAt = overview.dataUpdatedAt ? new Date(overview.dataUpdatedAt) : null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Overview"
        description={
          updatedAt
            ? `Stock, expiry and workload at a glance. Updated ${String(updatedAt.getHours()).padStart(2, "0")}:${String(updatedAt.getMinutes()).padStart(2, "0")}.`
            : "Stock, expiry and workload at a glance."
        }
        action={
          facilities.length > 1 && (
            <Select
              label="Facility"
              value={facilityId}
              options={facilities.map((facility) => ({ value: facility.id, label: facility.name }))}
              onChange={(event) => selectFacility(event.target.value)}
            />
          )
        }
      />

      {facilitiesError && <ErrorState message={describeError(facilitiesError)} onRetry={() => void refetchFacilities()} />}
      {overview.isError && !data && (
        <ErrorState
          message={describeError(overview.error, "The overview couldn't be loaded. Please try again.")}
          onRetry={() => void overview.refetch()}
          retrying={overview.isFetching}
        />
      )}
      {(facilitiesLoading || (overview.isLoading && facilityId !== "")) && <OverviewSkeleton />}

      {data && (
        <div className={overview.isPlaceholderData ? "flex flex-col gap-5 opacity-60 transition-opacity" : "flex flex-col gap-5 transition-opacity"} aria-busy={overview.isPlaceholderData}>
          <OverviewTiles overview={data} facilityId={facilityId} now={updatedAt ?? new Date()} />
          <div className="flex flex-wrap items-start gap-5">
            <StockCoverCard rows={data.stockCover} facilityId={facilityId} />
            <ExpiryCard key={facilityId} expiry={data.expiry} facilityId={facilityId} />
          </div>
          <PrescriptionsCard days={data.prescriptionsPerDay} />
        </div>
      )}
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div role="status" aria-label="Loading the overview" className="flex flex-col gap-5">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(13.5rem,100%),1fr))] gap-4">
        {[0, 1, 2, 3].map((tile) => (
          <div key={tile} className="h-[118px] animate-pulse rounded-2xl bg-surface-sunken motion-reduce:animate-none" />
        ))}
      </div>
      <div className="flex flex-wrap gap-5">
        <div className="h-96 flex-[3_1_32rem] animate-pulse rounded-2xl bg-surface-sunken motion-reduce:animate-none" />
        <div className="h-96 flex-[2_1_24rem] animate-pulse rounded-2xl bg-surface-sunken motion-reduce:animate-none" />
      </div>
    </div>
  );
}
