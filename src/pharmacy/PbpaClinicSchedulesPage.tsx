import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/shared/api/client";
import {
  assignPbpaClinicSchedule,
  endPbpaClinicSchedule,
  getManagedPbpaFacilities,
  getManagedPbpaSchedules,
  getSchedulablePbpas,
} from "@/shared/api/pharmacy";
import { Button } from "@/shared/components/Button";
import { PageHeader } from "@/shared/components/PageHeader";

function scheduleRequestError(cause: unknown, action: "save" | "end"): string {
  const verb = action === "save" ? "save" : "end";
  if (cause instanceof ApiError) {
    if (cause.status >= 500) {
      return `The server couldn't confirm that it could ${verb} this schedule. Refresh the schedule list before retrying.`;
    }
    return cause.message;
  }
  return cause instanceof Error && cause.message
    ? cause.message
    : `Could not ${verb} this clinic schedule. Check your connection and try again.`;
}

function scheduleLoadError(cause: unknown): string {
  if (cause instanceof ApiError) {
    if (cause.status === 401 || cause.status === 403) {
      return "Your account is not authorized to view schedules for these clinics. Sign in with a Facility Manager or Org Admin account that has pharmacy management access.";
    }
    if (cause.status >= 500) {
      return "The server couldn't load the clinic schedules. The assignment form may still be available; refresh the schedule list or check the backend log.";
    }
    return cause.message;
  }
  return "Could not connect to load clinic schedules. Check that the backend is running, then refresh.";
}
function todayIsoDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function PbpaClinicSchedulesPage() {
  const queryClient = useQueryClient();
  const [pbpaId, setPbpaId] = useState("");
  const [facilityId, setFacilityId] = useState("");
  const [activeFrom, setActiveFrom] = useState(todayIsoDate);
  const [activeTo, setActiveTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const facilities = useQuery({ queryKey: ["pbpa-schedules", "managed-facilities"], queryFn: getManagedPbpaFacilities });
  const staff = useQuery({ queryKey: ["pbpa-schedules", "managed-staff"], queryFn: getSchedulablePbpas });
  const schedules = useQuery({ queryKey: ["pbpa-schedules", "managed"], queryFn: getManagedPbpaSchedules });
  const choices = useMemo(() => staff.data?.find((person) => person.userId === pbpaId)?.facilityIds ?? [], [staff.data, pbpaId]);

  const assign = useMutation({
    mutationFn: () => assignPbpaClinicSchedule({ userId: pbpaId, facilityId, activeFrom, ...(activeTo ? { activeTo } : {}) }),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["pbpa-schedules", "managed"] });
    },
    onError: (cause) => setError(scheduleRequestError(cause, "save")),
  });
  const end = useMutation({
    mutationFn: endPbpaClinicSchedule,
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["pbpa-schedules", "managed"] }); },
    onError: (cause) => setError(scheduleRequestError(cause, "end")),
  });

  const loading = facilities.isLoading || staff.isLoading || schedules.isLoading;
  const failedLoad = facilities.isError ? facilities.error : staff.isError ? staff.error : schedules.isError ? schedules.error : null;
  const facilityNames = new Map((facilities.data ?? []).map((facility) => [facility.id, facility.name]));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="PBPA clinic schedules" description="Assign post-basic pharmacist assistants to the clinics where they are scheduled to dispense." />
      {(error || failedLoad) && <div role="alert" className="rounded-lg border border-danger-500/30 bg-danger-50 px-4 py-3 text-sm text-danger-700">{error ?? scheduleLoadError(failedLoad)}</div>}

      <section className="rounded-xl border border-border-subtle bg-surface-raised p-5">
        <h2 className="text-base font-semibold text-text-primary">Assign a clinic</h2>
        <p className="mt-1 text-sm text-text-secondary">Only PBPA staff and clinics within your management scope are listed.</p>
        {facilities.data?.length === 0 && !loading ? (
          <p className="mt-4 rounded-lg bg-surface-sunken p-4 text-sm text-text-secondary">No active clinics are assigned to your management scope. Ask an Org Admin to assign your Facility Manager account to a clinic, then refresh this page.</p>
        ) : staff.data?.length === 0 && !loading ? (
          <p className="mt-4 rounded-lg bg-surface-sunken p-4 text-sm text-text-secondary">No active PBPA staff are assigned to the clinics you manage. Ask an Org Admin to confirm the staff account is active, has the Pharmacist Assistant role, and is assigned to one of your clinics. Refresh this page after those assignments are updated.</p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-text-secondary">PBPA
              <select value={pbpaId} onChange={(event) => { setPbpaId(event.target.value); setFacilityId(""); }} disabled={loading} className="h-11 rounded-lg border border-border-strong bg-white px-3 text-text-primary">
                <option value="">Choose staff</option>{(staff.data ?? []).map((person) => <option key={person.userId} value={person.userId}>{person.staffName}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-text-secondary">Clinic
              <select value={facilityId} onChange={(event) => setFacilityId(event.target.value)} disabled={!pbpaId || loading} className="h-11 rounded-lg border border-border-strong bg-white px-3 text-text-primary">
                <option value="">Choose clinic</option>{(facilities.data ?? []).filter((facility) => choices.includes(facility.id)).map((facility) => <option key={facility.id} value={facility.id}>{facility.name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-text-secondary">Starts on
              <input type="date" value={activeFrom} onChange={(event) => setActiveFrom(event.target.value)} className="h-11 rounded-lg border border-border-strong bg-white px-3 text-text-primary" />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-text-secondary">Ends on (optional)
              <input type="date" value={activeTo} min={activeFrom} onChange={(event) => setActiveTo(event.target.value)} className="h-11 rounded-lg border border-border-strong bg-white px-3 text-text-primary" />
            </label>
            <div className="sm:col-span-2 lg:col-span-4"><Button disabled={!pbpaId || !facilityId || !activeFrom || (!!activeTo && activeTo < activeFrom) || loading} loading={assign.isPending} onClick={() => assign.mutate()}>Assign clinic</Button></div>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border-subtle bg-surface-raised p-5">
        <h2 className="text-base font-semibold text-text-primary">Schedules for your clinics</h2>
        {loading ? <p className="mt-4 text-sm text-text-secondary">Loading schedules…</p> : schedules.data?.length === 0 ? <p className="mt-4 text-sm text-text-secondary">No schedules to show.</p> : (
          <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs uppercase text-text-secondary"><tr><th className="py-2 pr-4">PBPA</th><th className="py-2 pr-4">Clinic</th><th className="py-2 pr-4">Start</th><th className="py-2 pr-4">End</th><th className="py-2 text-right">Action</th></tr></thead><tbody className="divide-y divide-border-subtle">{(schedules.data ?? []).map((schedule) => <tr key={schedule.id}><td className="py-3 pr-4 font-medium text-text-primary">{schedule.staffName}</td><td className="py-3 pr-4">{facilityNames.get(schedule.facilityId) ?? schedule.facilityName}</td><td className="py-3 pr-4">{schedule.activeFrom}</td><td className="py-3 pr-4">{schedule.activeTo ?? "Ongoing"}</td><td className="py-3 text-right">{!schedule.activeTo && <Button variant="secondary" size="md" loading={end.isPending && end.variables === schedule.id} onClick={() => { setError(null); end.mutate(schedule.id); }}>End</Button>}</td></tr>)}</tbody></table></div>
        )}
      </section>
    </div>
  );
}
