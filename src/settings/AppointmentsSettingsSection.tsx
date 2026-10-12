import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
import { getAppointmentSettings, saveAppointmentSettings, type AppointmentSettings } from "@/shared/api/appointments";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { useToast } from "@/shared/components/toast/ToastProvider";

function FacilityLimit({ setting }: { setting: AppointmentSettings }) {
  const [unlimited, setUnlimited] = useState(setting.dailyLimit === null);
  const [limit, setLimit] = useState(setting.dailyLimit?.toString() ?? "");
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const value = unlimited ? null : Number(limit);
  const valid = unlimited || (limit.trim() !== "" && Number.isSafeInteger(value) && value! > 0 && value! <= 2147483647);
  const dirty = value !== setting.dailyLimit;
  const save = useMutation({
    mutationFn: () => saveAppointmentSettings(setting.facilityId, value),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["appointment-settings"] }); void queryClient.invalidateQueries({ queryKey: ["appointments"] }); showToast("Daily visit limit saved.", "success"); },
  });
  return <Card className="p-5 sm:p-6"><form onSubmit={e => { e.preventDefault(); if (valid) save.mutate(); }}>
    <h3 className="font-semibold text-text-primary">{setting.facilityName}</h3><p className="mt-1 text-xs text-text-secondary">Daily capacity uses {setting.timezone} time.</p>
    <fieldset disabled={save.isPending} className="mt-5 space-y-4">
      <label className="flex items-center gap-2 text-sm text-text-primary"><input type="checkbox" checked={unlimited} onChange={e => setUnlimited(e.target.checked)} /> No daily limit</label>
      <label className="block text-sm font-medium text-text-primary">Daily visit limit<input type="number" required={!unlimited} disabled={unlimited} min={1} max={2147483647} step={1} value={limit} onChange={e => setLimit(e.target.value)} className="mt-2 block h-11 w-full max-w-xs rounded-lg border border-border-strong bg-surface-raised px-3 disabled:opacity-50" /></label>
      <p className="text-sm text-text-secondary">Receptionists can book up to this many appointments per day. Cancelled appointments free a place. Walk-in visits are not counted.</p>
      {value !== null && (setting.dailyLimit === null || value < setting.dailyLimit) && <p className="rounded-lg border border-border-subtle bg-surface p-3 text-sm text-text-secondary">Existing appointments will be kept. Days already at or above this limit will stop accepting new bookings.</p>}
    </fieldset>
    {save.isError && <p role="alert" className="mt-4 text-sm text-red-600">{save.error.message}</p>}
    <div className="mt-5 flex gap-3"><Button type="submit" disabled={!valid || !dirty} loading={save.isPending}>Save limit</Button><Button type="button" variant="secondary" disabled={!dirty || save.isPending} onClick={() => { setUnlimited(setting.dailyLimit === null); setLimit(setting.dailyLimit?.toString() ?? ""); save.reset(); }}>Discard</Button></div>
  </form></Card>;
}
export function AppointmentsSettingsSection() {
  const query = useQuery({ queryKey: ["appointment-settings"], queryFn: getAppointmentSettings });
  return <div className="space-y-5"><div><h2 className="flex items-center gap-2 text-xl font-semibold text-text-primary"><CalendarDays size={21} aria-hidden /> Appointments</h2><p className="mt-2 text-sm text-text-secondary">Set the daily appointment capacity for each facility.</p></div>
    {query.isPending ? <p role="status">Loading appointment settings…</p> : query.isError ? <div role="alert"><p>{query.error.message}</p><Button variant="secondary" onClick={() => void query.refetch()}>Retry</Button></div> : query.data.length === 0 ? <Card className="p-6">Add a facility in Settings to configure appointment limits.</Card> : query.data.map(setting => <FacilityLimit key={`${setting.facilityId}:${setting.dailyLimit}`} setting={setting} />)}
  </div>;
}
