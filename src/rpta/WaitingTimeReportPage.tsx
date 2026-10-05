import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Clock3, RefreshCw } from "lucide-react";
import { getWaitingTimeReport, type WaitingTimeReportRow } from "@/shared/api/rpta";
import { getFacilities } from "@/shared/api/facilities";
import { Card } from "@/shared/components/Card";
import { Button } from "@/shared/components/Button";
import { PageHeader } from "@/shared/components/PageHeader";

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";

  return new Date(iso).toLocaleString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMinutes(minutes: number | null): string {
  if (minutes == null) return "—";

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;

  return remaining === 0
    ? `${hours} hr`
    : `${hours} hr ${remaining} min`;
}

function StageCell({
  startedAt,
  completedAt,
  durationMinutes,
}: {
  startedAt: string | null;
  completedAt: string | null;
  durationMinutes: number | null;
}) {
  return (
    <div className="min-w-[150px]">
      <div className="font-semibold text-text-primary">
        {formatMinutes(durationMinutes)}
      </div>

      <div className="mt-1 space-y-0.5 text-[11px] text-text-secondary">
        <div>Start: {formatDateTime(startedAt)}</div>
        <div>Complete: {formatDateTime(completedAt)}</div>
      </div>
    </div>
  );
}

function ReportRow({ row }: { row: WaitingTimeReportRow }) {
  return (
    <tr className="border-b border-border-subtle last:border-b-0">
      <td className="whitespace-nowrap px-4 py-4 align-top">
        <div className="font-mono text-[12px] text-text-primary">
          {row.visitId}
        </div>
        <div className="mt-1 font-mono text-[11px] text-text-secondary">
          Patient: {row.patientId}
        </div>
      </td>

      <td className="px-4 py-4 align-top">
        <StageCell
          startedAt={row.registrationStartedAt}
          completedAt={row.registrationCompletedAt}
          durationMinutes={row.registrationDurationMinutes}
        />
      </td>

      <td className="px-4 py-4 align-top">
        <StageCell
          startedAt={row.triageStartedAt}
          completedAt={row.triageCompletedAt}
          durationMinutes={row.triageDurationMinutes}
        />
      </td>

      <td className="px-4 py-4 align-top">
        <StageCell
          startedAt={row.consultationStartedAt}
          completedAt={row.consultationCompletedAt}
          durationMinutes={row.consultationDurationMinutes}
        />
      </td>

      <td className="px-4 py-4 align-top">
        <StageCell
          startedAt={row.pharmacyStartedAt}
          completedAt={row.pharmacyCompletedAt}
          durationMinutes={row.pharmacyDurationMinutes}
        />
      </td>

      <td className="px-4 py-4 align-top">
        <div className="font-semibold text-text-primary">
          {formatMinutes(row.totalWaitingMinutes)}
        </div>
        <div className="mt-1 text-[11px] text-text-secondary">
          Journey: {formatMinutes(row.totalJourneyMinutes)}
        </div>

        {row.exceeds120Minutes && (
          <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700">
            <AlertTriangle className="size-3" aria-hidden />
            Over 120 min
          </div>
        )}
      </td>
    </tr>
  );
}

export function WaitingTimeReportPage() {
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(todayIso());
  const [facilityId, setFacilityId] = useState("");

  const facilitiesQuery = useQuery({
    queryKey: ["tenant", "facilities"],
    queryFn: getFacilities,
  });

  const reportQuery = useQuery({
    queryKey: ["rpta", "waiting-time", { from, to, facilityId }],
    queryFn: () =>
      getWaitingTimeReport(
        from,
        to,
        facilityId || undefined,
      ),
    enabled: Boolean(from && to),
  });

  const rows = reportQuery.data ?? [];

  const completedRows = rows.filter(
    (row) =>
      row.totalWaitingMinutes != null &&
      row.totalJourneyMinutes != null,
  );

  const exceededRows = rows.filter((row) => row.exceeds120Minutes);

  const averageWaitingMinutes =
    completedRows.length > 0
      ? Math.round(
          completedRows.reduce(
            (sum, row) => sum + (row.totalWaitingMinutes ?? 0),
            0,
          ) / completedRows.length,
        )
      : null;

  function updateFrom(value: string) {
    setFrom(value);
  }

  function updateTo(value: string) {
    setTo(value);
  }

  function clearFilters() {
    setFrom(todayIso());
    setTo(todayIso());
    setFacilityId("");
  }

  return (
    <div>
      <PageHeader
        title="Waiting time"
        description="RPTA view of patient journey waiting times across registration, triage, consultation, and pharmacy."
      />

      <div className="mb-5 flex flex-col gap-3 rounded-xl border border-border-subtle bg-surface-raised p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="waiting-time-from"
            className="text-[13px] font-medium text-text-primary"
          >
            From
          </label>
          <input
            id="waiting-time-from"
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => updateFrom(e.target.value)}
            className="h-11 w-full rounded-lg border border-border-strong bg-surface-raised px-3.5 text-[14px] text-text-primary outline-none transition-colors duration-150 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 sm:w-40"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="waiting-time-to"
            className="text-[13px] font-medium text-text-primary"
          >
            To
          </label>
          <input
            id="waiting-time-to"
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => updateTo(e.target.value)}
            className="h-11 w-full rounded-lg border border-border-strong bg-surface-raised px-3.5 text-[14px] text-text-primary outline-none transition-colors duration-150 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 sm:w-40"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="waiting-time-facility"
            className="text-[13px] font-medium text-text-primary"
          >
            Facility
          </label>

          <select
            id="waiting-time-facility"
            value={facilityId}
            onChange={(e) => setFacilityId(e.target.value)}
            className="h-11 min-w-[220px] rounded-lg border border-border-strong bg-surface-raised px-3.5 text-[14px] text-text-primary outline-none transition-colors duration-150 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          >
            <option value="">All facilities</option>

            {(facilitiesQuery.data ?? []).map(
              (facility ) => (
                <option key={facility.id} value={facility.id}>
                  {facility.name}
                </option>
              ),
            )}
          </select>
        </div>

        <Button
          variant="secondary"
          icon={<RefreshCw className="size-4" aria-hidden />}
          loading={reportQuery.isFetching}
          onClick={() => void reportQuery.refetch()}
        >
          Refresh
        </Button>

        <button
          type="button"
          onClick={clearFilters}
          className="h-11 rounded-lg px-3 text-[13.5px] font-medium text-brand-600 transition-colors duration-150 hover:bg-brand-50"
        >
          Reset
        </button>
      </div>

      {!reportQuery.isLoading && !reportQuery.isError && (
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <Card>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[12px] font-medium uppercase tracking-wide text-text-secondary">
                  Journeys
                </p>
                <p className="mt-1 text-2xl font-semibold text-text-primary">
                  {rows.length}
                </p>
              </div>
              <Clock3 className="size-5 text-brand-600" aria-hidden />
            </div>
          </Card>

          <Card>
            <div>
              <p className="text-[12px] font-medium uppercase tracking-wide text-text-secondary">
                Average waiting time
              </p>
              <p className="mt-1 text-2xl font-semibold text-text-primary">
                {formatMinutes(averageWaitingMinutes)}
              </p>
            </div>
          </Card>

          <Card>
            <div>
              <p className="text-[12px] font-medium uppercase tracking-wide text-text-secondary">
                Over 120 minutes
              </p>
              <p className="mt-1 text-2xl font-semibold text-text-primary">
                {exceededRows.length}
              </p>
            </div>
          </Card>
        </div>
      )}

      <Card className="overflow-hidden p-0">
        {reportQuery.isLoading ? (
          <div className="flex flex-col gap-4 px-5 py-6">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded bg-surface-sunken"
                style={{ animationDelay: `${i * 60}ms` }}
              />
            ))}
          </div>
        ) : reportQuery.isError ? (
          <div
            role="alert"
            className="flex flex-col items-center gap-3 px-5 py-10 text-center"
          >
            <p className="text-[13.5px] text-text-secondary">
              The waiting-time report couldn't be loaded. Please try again.
            </p>

            <Button
              variant="secondary"
              loading={reportQuery.isFetching}
              onClick={() => void reportQuery.refetch()}
            >
              Retry
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
            <Clock3
              className="size-5 text-text-secondary"
              aria-hidden
            />
            <p className="text-[13.5px] text-text-secondary">
              No waiting-time journeys were found for this date range.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1250px] border-collapse text-left">
              <thead>
                <tr className="border-b border-border-subtle bg-surface-sunken">
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                    Visit
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                    Registration
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                    Triage
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                    Consultation
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                    Pharmacy
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                    Total
                  </th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row) => (
                  <ReportRow key={row.visitId} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}