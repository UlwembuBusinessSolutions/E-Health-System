import { useState } from "react";
import { PharmacyWorkflowGuide } from "./PharmacyWorkflowGuide";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getFacilities } from "@/shared/api/facilities";
import { getDispensingCapabilities } from "@/shared/api/pharmacy";
import { getDuty, recordDuty, endDuty } from "@/shared/api/pharmacyDuty";
import { PageHeader } from "@/shared/components/PageHeader";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";

const inputStyle = "rounded-lg border border-border-strong bg-surface px-3 py-2 text-text-primary";
const format = (value: string) => new Date(value).toLocaleString("en-ZA");
export function PharmacyDutyPage() {
  const [params, setParams] = useSearchParams();
  const facilities = useQuery({ queryKey: ["facilities"], queryFn: getFacilities });
  const facilityId = params.get("facilityId") || facilities.data?.[0]?.id || "";
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [hours, setHours] = useState(8);
  const capabilities = useQuery({ queryKey: ["pharmacy", "dispensing-capabilities"], queryFn: getDispensingCapabilities });
  const duty = useQuery({ queryKey: ["pharmacy", "duty", facilityId], queryFn: () => getDuty(facilityId), enabled: !!facilityId, refetchInterval: 5000 });
  function refresh() { queryClient.invalidateQueries({ queryKey: ["pharmacy", "duty"] }); }
  const record = useMutation({
    mutationFn: (dutyType: string) => recordDuty({ facilityId, dutyType, hours, reason: reason.trim() }),
    onSuccess: () => { setReason(""); refresh(); },
  });
  const end = useMutation({ mutationFn: (id: string) => endDuty(facilityId, id), onSuccess: refresh });
  const pending = record.isPending || end.isPending;
  const status = duty.data?.status;
  const canRecord = capabilities.data?.canPrescribe || capabilities.data?.canDispense;
  return <div>
    <PageHeader title="Dispenser duty register" description="Record who is available at each clinic before dispensing." />
    <PharmacyWorkflowGuide title="How to record duty availability" steps={[
      { title: "Choose the clinic", description: "Select the clinic where you are working. This record applies only to that clinic." },
      { title: "Enter the reason", description: "Describe the actual attendance, for example: No pharmacist assistant available for this shift. Confirm absence only when no dispenser is on duty." },
      { title: "Record the correct status", description: "Absence confirmations last one hour. Licensed dispensers can choose a shift duration and start their own shift, then select End my shift when finished." },
    ]} />
    <div className="mb-5 flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm">Clinic<select aria-label="Clinic" className={inputStyle} value={facilityId} disabled={pending} onChange={e => {
        setParams({ facilityId: e.target.value }); setReason(""); record.reset(); end.reset();
      }}>{facilities.data?.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
      <Button variant="secondary" onClick={refresh}>Refresh</Button>
      <Link to="/app/pharmacy" className="p-2 text-brand-700 underline">Back to dispensing</Link>
    </div>
    {(facilities.isError || duty.isError || capabilities.isError) && <p role="alert" className="mb-4 text-danger-600">Could not load duty information. <button onClick={() => { facilities.refetch(); duty.refetch(); capabilities.refetch(); }}>Retry</button></p>}
    {!facilityId && !facilities.isPending && !facilities.isError && <p>No clinics are available.</p>}
    {duty.isPending && facilityId && <p role="status">Loading duty register…</p>}
    {duty.data && <Card className="mb-5 p-5">
      <h2 className="text-lg font-semibold">{status === "ON_DUTY" ? "Dispenser on duty" : status === "NO_DISPENSER" ? "No dispenser available — confirmed" : "Availability needs confirmation"}</h2>
      <p className="mt-2 text-sm text-text-secondary">{status === "NO_DISPENSER" ? `Valid until ${format(duty.data.absenceExpiresAt!)}. A new dispenser shift cancels this confirmation.` :
        status === "ON_DUTY" ? "Prescriber dispensing is blocked while a dispenser shift is active." : "Prescriber dispensing is blocked until availability is recorded."}</p>
      {duty.data.activeShifts.map(shift => <div key={shift.id} className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-3">
        <span>{shift.staffName} · until {format(shift.expiresAt)}</span>
        {shift.mine && <Button variant="secondary" disabled={pending} onClick={() => end.mutate(shift.id)}>End my shift</Button>}
      </div>)}
    </Card>}
    {canRecord && facilityId && <Card className="mb-5 p-5">
      <h2 className="font-semibold">Update availability</h2>
      <p className="mt-1 text-sm text-text-secondary">Record actual attendance. Absence confirmations last one hour; shifts expire automatically. Changes retain your name, time and reason.</p>
      <label className="mt-4 flex flex-col gap-1 text-sm">Reason<textarea aria-label="Duty reason" aria-describedby="duty-reason-help" placeholder="For example: No pharmacist assistant available for this shift." className={inputStyle} maxLength={500} value={reason} disabled={pending} onChange={e => setReason(e.target.value)} /></label>
      <p id="duty-reason-help" className="mt-2 text-xs text-text-secondary">Enter your own reason. For a dispenser shift, describe your attendance, for example: Starting the morning dispensing shift.</p>
      {capabilities.data?.canDispense && <label className="mt-3 flex flex-col gap-1 text-sm">Shift duration<select aria-label="Shift duration" className={inputStyle} value={hours} disabled={pending} onChange={e => setHours(Number(e.target.value))}>
        {[1,2,4,8,12].map(h => <option key={h} value={h}>{h} hours</option>)}
      </select></label>}
      <div className="mt-4 flex flex-wrap gap-3">
        {capabilities.data?.canDispense && <Button disabled={pending || !reason.trim() || !duty.data || duty.isError || duty.data.activeShifts.some(s => s.mine)} onClick={() => record.mutate("ON_DUTY")}>Start my dispenser shift</Button>}
        <Button variant="secondary" disabled={pending || !reason.trim() || !duty.data || duty.isError || status === "ON_DUTY"} onClick={() => record.mutate("NO_DISPENSER")}>Confirm no dispenser available</Button>
      </div>
      {(record.error || end.error) && <p role="alert" className="mt-3 text-danger-600">{(record.error || end.error)?.message}</p>}
    </Card>}
    {duty.data && <Card className="p-5">
      <h2 className="font-semibold">Recent duty history</h2>
      <p className="mt-1 text-sm text-text-secondary">Latest 50 records. Times are shown in your local timezone.</p>
      {duty.data.history.length === 0 && <p className="mt-4">No duty records yet.</p>}
      <ul className="mt-4 divide-y divide-border-subtle">{duty.data.history.map(entry => <li key={entry.id} className="py-3">
        <p className="font-medium">{entry.staffName} · {entry.dutyType === "ON_DUTY" ? "Dispenser shift" : "No dispenser confirmed"}</p>
        <p className="mt-1 text-sm">{entry.reason}</p>
        <p className="mt-1 text-xs text-text-secondary">{format(entry.startedAt)} — {format(entry.endedAt || entry.expiresAt)} {entry.endedAt ? "(ended)" : "(expires)"}</p>
        {entry.mine && !entry.endedAt && new Date(entry.expiresAt).getTime() > Date.now() && entry.dutyType === "NO_DISPENSER" && <Button variant="secondary" disabled={pending} onClick={() => end.mutate(entry.id)}>Withdraw confirmation</Button>}
      </li>)}</ul>
    </Card>}
    {end.error && <p role="alert" className="mt-3 text-danger-600">{end.error.message}</p>}
  </div>;
}

