import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MonitorCheck, Users } from "lucide-react";
import { getFacilities } from "@/shared/api/facilities";
import { listQueueDisplay, type QueueToken } from "@/shared/api/queue";

function latestCalled(tokens: QueueToken[]): QueueToken | null {
  return (
    tokens
      .filter((token) => token.status === "CALLED" && token.calledAt)
      .sort((a, b) => new Date(b.calledAt ?? 0).getTime() - new Date(a.calledAt ?? 0).getTime())[0] ?? null
  );
}

export function QueueDisplayPage() {
  const [facilityId, setFacilityId] = useState("");
  const facilitiesQuery = useQuery({ queryKey: ["facilities"], queryFn: getFacilities });

  useEffect(() => {
    if (!facilityId && facilitiesQuery.data?.length) {
      setFacilityId(facilitiesQuery.data[0].id);
    }
  }, [facilityId, facilitiesQuery.data]);

  const displayQuery = useQuery({
    queryKey: ["queue-display", facilityId],
    queryFn: () => listQueueDisplay(facilityId),
    enabled: !!facilityId,
    refetchInterval: 5000,
  });

  const tokens = displayQuery.data ?? [];
  const called = useMemo(() => latestCalled(tokens), [tokens]);
  const waiting = tokens.filter((token) => token.status === "ISSUED");
  const facilityName = facilitiesQuery.data?.find((facility) => facility.id === facilityId)?.name;

  return (
    <main className="min-h-screen bg-surface px-5 py-8 text-text-primary sm:px-10 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 flex flex-col gap-5 border-b border-border-subtle pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.2em] text-brand-600">
              <MonitorCheck className="size-4" aria-hidden />
              Live queue
            </p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Now serving</h1>
            <p className="mt-2 text-[14px] text-text-secondary">
              {facilityName ?? "Queue status"} · Updates automatically every 5 seconds
            </p>
          </div>
          {facilitiesQuery.data && facilitiesQuery.data.length > 1 && (
            <label className="flex items-center gap-3 text-[13px] text-text-secondary">
              Queue
              <select
                value={facilityId}
                onChange={(event) => setFacilityId(event.target.value)}
                className="h-10 rounded-lg border border-border-strong bg-surface-raised px-3 text-text-primary outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              >
                {facilitiesQuery.data.map((facility) => (
                  <option key={facility.id} value={facility.id}>
                    {facility.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </header>

        {displayQuery.isLoading ? (
          <p className="py-16 text-center text-text-secondary">Loading queue display…</p>
        ) : displayQuery.isError ? (
          <p role="alert" className="py-16 text-center text-danger-600">
            Queue display is currently unavailable. Please try again.
          </p>
        ) : (
          <>
            <section className="mb-10 rounded-2xl border border-brand-200 bg-brand-50 px-6 py-8 text-center sm:px-10 sm:py-12">
              <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-brand-700">In service</p>
              {called ? (
                <p className="mt-3 font-mono text-7xl font-semibold tracking-tight text-brand-800 sm:text-9xl">
                  #{called.tokenNumber}
                </p>
              ) : (
                <p className="mt-6 text-lg text-text-secondary">No token is currently in service.</p>
              )}
            </section>

            <section aria-labelledby="waiting-heading">
              <div className="mb-4 flex items-center justify-between">
                <h2 id="waiting-heading" className="flex items-center gap-2 text-lg font-semibold">
                  <Users className="size-5 text-brand-600" aria-hidden />
                  Waiting
                </h2>
                <span className="text-[13px] text-text-secondary">{waiting.length} waiting</span>
              </div>
              {waiting.length ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {waiting.map((token) => (
                    <div
                      key={token.id}
                      className="rounded-xl border border-border-subtle bg-surface-raised px-4 py-5 text-center shadow-card"
                    >
                      <span className="font-mono text-3xl font-semibold tabular-nums">#{token.tokenNumber}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-border-strong px-5 py-10 text-center text-text-secondary">
                  No patients are waiting.
                </p>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
