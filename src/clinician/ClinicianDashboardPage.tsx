import type { ReactNode } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Clock, PenLine, PhoneCall, Users, type LucideIcon } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { ApiError } from "@/shared/api/client";
import { getClinicianDashboard } from "@/shared/api/clinicianDashboard";
import { getInProgressConsultations } from "@/shared/api/consultations";
import { Button } from "@/shared/components/Button";
import { PageHeader } from "@/shared/components/PageHeader";
import { Select } from "@/shared/components/Select";
import { ErrorState } from "@/pharmacy/components/ErrorState";
import { describeError } from "@/pharmacy/lib/problem";
import { useFacilitySelection } from "@/pharmacy/lib/useFacilitySelection";
import { countAll, displayName, greeting, nextAppointment, pastTargetSummary, waitText } from "./clinicianModel";
import { AppointmentsCard, NotesToSignCard, PharmacyMessagesCard } from "./SideCards";
import { SeenPerDayCard } from "./SeenPerDayCard";
import { useCallPatient } from "./useCallPatient";
import { WhoToSeeNextCard } from "./WhoToSeeNextCard";

const DASHBOARD_KEY = ["clinician", "dashboard"] as const;

// The Dashboard for clinical roles: who to see next, what is left to sign,
// today's appointments and pharmacy messages, all for one facility. A role
// the server won't show the queue to gets `fallback` (the organisation
// dashboard) instead of an error page.
export function ClinicianDashboardPage({ fallback }: { fallback: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { facilities, facilityId, selectFacility, isLoading: facilitiesLoading, error: facilitiesError, refetch: refetchFacilities } =
    useFacilitySelection();

  const dashboard = useQuery({
    queryKey: [...DASHBOARD_KEY, facilityId],
    queryFn: () => getClinicianDashboard(facilityId),
    enabled: facilityId !== "",
    staleTime: 15_000,
    // The waiting room changes minute to minute.
    refetchInterval: 30_000,
    placeholderData: keepPreviousData,
    retry: (failures, error) => !(error instanceof ApiError && error.status < 500) && failures < 2,
  });
  const notes = useQuery({
    queryKey: ["in-progress-consultations"],
    queryFn: getInProgressConsultations,
    retry: false,
    staleTime: 15_000,
  });

  const data = dashboard.data;
  const patients = data?.waiting.patients ?? [];
  const { call, callingTokenId, dialog } = useCallPatient(patients, () => {
    void queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY });
  });

  if (dashboard.error instanceof ApiError && dashboard.error.status === 403) return <>{fallback}</>;

  const now = data ? new Date(data.generatedAt) : new Date();
  const name = user ? displayName(user) : "";
  const pastTargetCount = data ? countAll(data.waiting.overTargetByColour) : 0;
  const noteEntries = notes.data ?? [];
  const oldestNote = noteEntries.reduce<string | null>((oldest, n) => (oldest === null || n.startedAt < oldest ? n.startedAt : oldest), null);
  const next = data?.appointments ? nextAppointment(data.appointments, now) : undefined;
  const first = patients[0];
  const updated = data ? `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}` : null;
  const facilityName = facilities.find((f) => f.id === facilityId)?.name;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={name ? `${greeting(new Date())}, ${name}` : greeting(new Date())}
        description={[facilityName, updated && `Updated ${updated}`].filter(Boolean).join(" · ") || " "}
        action={
          <div className="flex flex-wrap items-end gap-3">
            {facilities.length > 1 && (
              <Select
                label="Facility"
                value={facilityId}
                options={facilities.map((f) => ({ value: f.id, label: f.name }))}
                onChange={(event) => selectFacility(event.target.value)}
              />
            )}
            {data?.canCall && first && (
              <Button
                icon={<PhoneCall className="size-4" aria-hidden />}
                loading={callingTokenId === first.tokenId}
                disabled={callingTokenId !== undefined}
                onClick={() => call(first)}
                aria-label={`Call next: ${first.patientName}`}
              >
                <span className="max-w-[13rem] truncate sm:max-w-[18rem]">Call next: {first.patientName}</span>
              </Button>
            )}
          </div>
        }
      />

      {facilitiesError && <ErrorState message={describeError(facilitiesError)} onRetry={() => void refetchFacilities()} />}
      {dashboard.isError && !data && (
        <ErrorState
          message={describeError(dashboard.error, "The dashboard couldn't be loaded. Please try again.")}
          onRetry={() => void dashboard.refetch()}
          retrying={dashboard.isFetching}
        />
      )}
      {(facilitiesLoading || (dashboard.isLoading && facilityId !== "")) && <DashboardSkeleton />}

      {data && (
        <div className={dashboard.isPlaceholderData ? "flex flex-col gap-5 opacity-60" : "flex flex-col gap-5"} aria-busy={dashboard.isPlaceholderData}>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(13.5rem,100%),1fr))] gap-4">
            <Tile
              href="#who-to-see-next"
              icon={Users}
              iconClassName="text-brand-500"
              label="Waiting to be seen"
              value={data.waiting.total}
              unit={data.waiting.total === 1 ? "patient" : "patients"}
              detail={data.waiting.total === 0 ? "Nobody waiting" : `Longest wait ${waitText(data.waiting.longestWaitMinutes)}`}
            />
            <Tile
              href="#who-to-see-next"
              icon={Clock}
              iconClassName="text-critical-500"
              label="Over their triage target"
              value={pastTargetCount}
              unit={pastTargetCount === 1 ? "patient" : "patients"}
              detail={
                pastTargetCount === 0 ? (
                  "Everyone is within target"
                ) : (
                  <span className="font-semibold text-critical-600">{pastTargetSummary(data.waiting.overTargetByColour)}: see them first</span>
                )
              }
            />
            <Tile
              href="#notes-to-sign"
              icon={PenLine}
              iconClassName="text-warning-500"
              label="Notes to sign"
              value={notes.isError ? null : noteEntries.length}
              unit={noteEntries.length === 1 ? "consultation" : "consultations"}
              detail={notes.isError ? "Couldn't load" : oldestNote ? `Oldest started ${new Date(oldestNote).toLocaleString("en-ZA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : "All signed"}
            />
            {data.appointments && (
              <Tile
                href="#my-appointments"
                icon={CalendarDays}
                iconClassName="text-brand-500"
                label="My appointments today"
                value={data.appointments.length}
                detail={next ? `Next ${next.time} · ${next.patientName}` : data.appointments.length ? "None still to come" : "None booked"}
              />
            )}
          </div>

          <div className="flex flex-wrap items-start gap-5">
            <WhoToSeeNextCard waiting={data.waiting} canCall={data.canCall} callingTokenId={callingTokenId} onCall={call} />
            <div className="flex min-w-0 flex-[2_1_22rem] flex-col gap-5">
              <NotesToSignCard entries={noteEntries} loading={notes.isLoading} failed={notes.isError} now={now} />
              {data.appointments && <AppointmentsCard appointments={data.appointments} next={next} />}
              <PharmacyMessagesCard messages={data.pharmacyMessages} now={now} />
            </div>
          </div>

          <SeenPerDayCard days={data.seenPerDay} />
        </div>
      )}
      {dialog}
    </div>
  );
}

interface TileProps {
  href: string;
  icon: LucideIcon;
  iconClassName: string;
  label: string;
  /** null when the figure couldn't be loaded. */
  value: number | null;
  unit?: string;
  detail: ReactNode;
}

function Tile({ href, icon: Icon, iconClassName, label, value, unit, detail }: TileProps) {
  return (
    <a
      href={href}
      className="flex flex-col gap-1.5 rounded-2xl border border-border-subtle bg-surface-raised px-5 py-4 text-text-primary shadow-card transition-colors duration-150 hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
    >
      <span className="flex items-center gap-2 text-[13.5px] text-text-secondary">
        <Icon className={`size-[18px] shrink-0 ${iconClassName}`} aria-hidden />
        {label}
      </span>
      <span className="text-[32px] font-semibold leading-tight">
        {value === null ? "—" : value.toLocaleString("en-ZA")}
        {unit && value !== null && <span className="ml-1.5 text-[15px] font-medium text-text-secondary">{unit}</span>}
      </span>
      <span className="text-[12.5px] text-text-secondary">{detail}</span>
    </a>
  );
}

function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Loading your dashboard" className="flex flex-col gap-5">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(13.5rem,100%),1fr))] gap-4">
        {[0, 1, 2, 3].map((tile) => (
          <div key={tile} className="h-[118px] animate-pulse rounded-2xl bg-surface-sunken motion-reduce:animate-none" />
        ))}
      </div>
      <div className="flex flex-wrap gap-5">
        <div className="h-96 flex-[3_1_32rem] animate-pulse rounded-2xl bg-surface-sunken motion-reduce:animate-none" />
        <div className="h-96 flex-[2_1_22rem] animate-pulse rounded-2xl bg-surface-sunken motion-reduce:animate-none" />
      </div>
    </div>
  );
}

