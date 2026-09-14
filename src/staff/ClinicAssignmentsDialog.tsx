// Lihle | 2026-09-09 | Add clinic membership and primary-clinic editing with unavailable-clinic and pending-save guards so administrators submit valid assignments.
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Save, X } from "lucide-react";
import type { StaffRosterEntry } from "@/shared/api/staff";
import { getStaffClinics, updateStaffClinics } from "@/shared/api/clinics";
import { useClinic } from "@/app/ClinicProvider";
import { Button } from "@/shared/components/Button";

export function ClinicAssignmentsDialog({ staff, onClose }: { staff: StaffRosterEntry; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cache = useQueryClient();
  const { clinics } = useClinic();
  const [selected, setSelected] = useState<string[]>([]);
  const [primary, setPrimary] = useState("");
  const assignment = useQuery({ queryKey: ["staff", staff.id, "clinics"], queryFn: () => getStaffClinics(staff.id) });
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    if (assignment.data) { setSelected(assignment.data.clinicIds); setPrimary(assignment.data.primaryClinicId ?? ""); }
  }, [assignment.data]);
  const save = useMutation({
    mutationFn: () => updateStaffClinics(staff.id, selected, primary),
    onSuccess: async () => { await cache.invalidateQueries({ queryKey: ["staff"] }); onClose(); },
  });
  const unavailable = selected.filter(id => !clinics.some(clinic => clinic.id === id));
  const choices = [...clinics, ...unavailable.map(id => ({ id, name: "Unavailable clinic (" + id + ")" }))];
  function toggle(id: string) {
    const next = selected.includes(id) ? selected.filter(value => value !== id) : [...selected, id];
    setSelected(next);
    if (!next.includes(primary)) setPrimary(next[0] ?? "");
  }
  return <dialog ref={dialog} aria-labelledby="clinic-assignment-title" onCancel={event => { event.preventDefault(); if (!save.isPending) onClose(); }}
    className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-lg border border-border-subtle bg-surface-raised p-0 text-text-primary shadow-xl backdrop:bg-black/40">
    <header className="flex items-start justify-between gap-4 border-b border-border-subtle p-5">
      <div><h2 id="clinic-assignment-title" className="flex items-center gap-2 text-lg font-semibold"><Building2 className="size-5 text-brand-600" />Clinic access</h2>
        <p className="mt-1 break-words text-sm text-text-secondary">{staff.firstName} {staff.lastName}</p></div>
      <button type="button" title="Close" aria-label="Close clinic access" disabled={save.isPending} onClick={onClose} className="flex size-8 shrink-0 items-center justify-center rounded-md hover:bg-surface-sunken"><X className="size-5" /></button>
    </header>
    <form onSubmit={event => { event.preventDefault(); save.mutate(); }}>
      <div className="space-y-5 p-5">
        {assignment.isPending ? <p role="status">Loading clinic assignments...</p> : assignment.isError ? <div role="alert"><p>{assignment.error.message}</p><button type="button" className="mt-2 text-brand-600" onClick={() => void assignment.refetch()}>Retry</button></div>
          : assignment.data.tenantWide ? <p className="text-sm text-text-secondary">This user has organization-wide access through a tenant-wide role.</p>
          : <>
            <fieldset disabled={save.isPending}><legend className="mb-2 text-sm font-semibold">Assigned clinics</legend>
              {choices.length === 0 && <p className="text-sm text-text-secondary">No active clinics available.</p>}
              {choices.map(clinic => <label key={clinic.id} className="flex items-start gap-3 border-b border-border-subtle py-3 text-sm">
                <input type="checkbox" checked={selected.includes(clinic.id)} onChange={() => toggle(clinic.id)} className="mt-0.5 size-4 shrink-0 accent-emerald-600" />
                <span className="break-all">{clinic.name}</span>
              </label>)}
            </fieldset>
            <label className="flex flex-col gap-2 text-sm font-semibold">Primary clinic
              <select aria-label="Primary clinic" value={primary} onChange={event => setPrimary(event.target.value)} disabled={save.isPending || selected.length === 0} required
                className="h-11 min-w-0 rounded-md border border-border-strong bg-surface-raised px-3 font-normal">
                <option value="" disabled>Select primary clinic</option>
                {choices.filter(clinic => selected.includes(clinic.id)).map(clinic => <option key={clinic.id} value={clinic.id}>{clinic.name}</option>)}
              </select>
            </label>
            {selected.length === 0 && <p className="text-sm text-danger-600">Select at least one clinic.</p>}
            {unavailable.length > 0 && <p className="text-sm text-danger-600">Remove unavailable clinics before saving.</p>}
          </>}
        {save.isError && <p role="alert" className="text-sm text-danger-600">{save.error.message}</p>}
      </div>
      <footer className="flex justify-end gap-3 border-t border-border-subtle p-5">
        <Button type="button" variant="secondary" onClick={onClose} disabled={save.isPending}>Cancel</Button>
        {!assignment.data?.tenantWide && <Button type="submit" icon={<Save className="size-4" />} loading={save.isPending}
          disabled={!assignment.data || selected.length === 0 || !selected.includes(primary) || unavailable.length > 0}>Save changes</Button>}
      </footer>
    </form>
  </dialog>;
}
