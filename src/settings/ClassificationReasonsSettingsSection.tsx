import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ListChecks, Pencil, Plus, RotateCcw, X } from "lucide-react";
import {
  createClassificationReason,
  getManagedClassificationReasons,
  updateClassificationReason,
  type ManagedClassificationReason,
} from "@/shared/api/consultations";
import { SERVICE_STREAM_DETAILS, type ServiceStream } from "@/shared/api/visits";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { Select } from "@/shared/components/Select";
import { useToast } from "@/shared/components/toast/ToastProvider";

const STREAMS = Object.keys(SERVICE_STREAM_DETAILS) as ServiceStream[];
const STREAM_OPTIONS = STREAMS.map((value) => ({ value, label: SERVICE_STREAM_DETAILS[value].label }));

function reasonCode(label: string): string {
  return label.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60);
}

function ReasonRow({ reason }: { reason: ManagedClassificationReason }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(reason.label);
  const [order, setOrder] = useState(String(reason.sortOrder));
  const [active, setActive] = useState(reason.active);
  const save = useMutation({
    mutationFn: () => updateClassificationReason(reason.id, { label: label.trim(), active, sortOrder: Number(order) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["managed-classification-reasons"] });
      void queryClient.invalidateQueries({ queryKey: ["classification-reasons"] });
      setEditing(false);
      showToast("Classification reason updated.", "success");
    },
  });
  const discard = () => {
    setLabel(reason.label);
    setOrder(String(reason.sortOrder));
    setActive(reason.active);
    save.reset();
    setEditing(false);
  };

  return <div className={`rounded-xl border p-4 ${reason.active ? "border-border-subtle bg-surface-raised" : "border-border-subtle bg-surface-sunken/60"}`}>
    {editing ? <form onSubmit={(event) => { event.preventDefault(); save.mutate(); }} className="space-y-3">
      <label className="block text-[12px] font-medium text-text-secondary">Reason label
        <input autoFocus maxLength={120} required value={label} onChange={(event) => setLabel(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-border-subtle bg-surface px-3 text-[13px] text-text-primary outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20" />
      </label>
      <div className="flex flex-wrap items-end gap-4">
        <label className="block text-[12px] font-medium text-text-secondary">Display order
          <input type="number" min={0} max={9999} required value={order} onChange={(event) => setOrder(event.target.value)} className="mt-1.5 h-10 w-28 rounded-lg border border-border-subtle bg-surface px-3 text-[13px] text-text-primary outline-none focus:border-brand-500" />
        </label>
        <label className="flex h-10 items-center gap-2 text-[13px] text-text-primary"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} className="size-4 accent-brand-600" /> Available to clinicians</label>
      </div>
      {save.isError && <p role="alert" className="text-[12px] text-danger-600">{save.error.message || "Couldn’t save this reason."}</p>}
      <div className="flex gap-2"><Button type="submit" size="md" icon={<Check className="size-3.5" aria-hidden />} loading={save.isPending} disabled={!label.trim() || !/^\d+$/.test(order)}>Save</Button><Button type="button" variant="secondary" size="md" icon={<X className="size-3.5" aria-hidden />} onClick={discard}>Cancel</Button></div>
    </form> : <div className="flex items-start gap-3">
      <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${reason.active ? "bg-brand-50 text-brand-700" : "bg-surface-sunken text-text-secondary"}`}><ListChecks className="size-4" aria-hidden /></span>
      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h4 className="text-[13.5px] font-semibold text-text-primary">{reason.label}</h4>{!reason.active && <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[10px] font-medium text-text-secondary">Inactive</span>}</div><p className="mt-1 font-mono text-[10.5px] text-text-secondary">{reason.reasonCode} · order {reason.sortOrder}</p></div>
      <button type="button" aria-label={`Edit ${reason.label}`} onClick={() => setEditing(true)} className="flex size-9 shrink-0 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-sunken hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"><Pencil className="size-4" aria-hidden /></button>
    </div>}
  </div>;
}

export function ClassificationReasonsSettingsSection() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [serviceStream, setServiceStream] = useState<ServiceStream>("GENERAL");
  const [label, setLabel] = useState("");
  const reasonsQuery = useQuery({ queryKey: ["managed-classification-reasons"], queryFn: getManagedClassificationReasons });
  const addReason = useMutation({
    mutationFn: () => createClassificationReason({ serviceStream, reasonCode: reasonCode(label), label: label.trim(), sortOrder: (reasonsQuery.data ?? []).filter((reason) => reason.serviceStream === serviceStream).length + 1 }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["managed-classification-reasons"] });
      void queryClient.invalidateQueries({ queryKey: ["classification-reasons"] });
      setLabel("");
      showToast("Classification reason added.", "success");
    },
  });
  const filtered = useMemo(() => (reasonsQuery.data ?? []).filter((reason) => reason.serviceStream === serviceStream).sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label)), [reasonsQuery.data, serviceStream]);
  const code = reasonCode(label);

  return <div className="space-y-5">
    <Card className="overflow-hidden">
      <div className="border-b border-border-subtle bg-gradient-to-r from-brand-50 to-surface-raised px-5 py-5 sm:px-6">
        <div className="flex items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-brand-700 shadow-sm"><ListChecks className="size-5" aria-hidden /></span><div><h3 className="text-[15px] font-semibold text-text-primary">Classification reason master list</h3><p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-text-secondary">Manage the options clinicians see in consultations. Reasons are grouped by care stream; inactive reasons stay on existing records but are no longer offered for selection.</p></div></div>
      </div>
      <div className="p-5 sm:p-6">
        <form onSubmit={(event) => { event.preventDefault(); if (code) addReason.mutate(); }} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(210px,0.7fr)_auto] md:items-end">
          <label className="block text-[12px] font-medium text-text-secondary">New reason
            <input maxLength={120} required value={label} onChange={(event) => setLabel(event.target.value)} placeholder="e.g. Respiratory infection" className="mt-1.5 h-11 w-full rounded-lg border border-border-subtle bg-surface px-3 text-[13.5px] text-text-primary outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20" />
            {label.trim() && <span className="mt-1 block font-mono text-[10.5px] text-text-secondary">Code: {code || "Enter letters or numbers to make a code"}</span>}
          </label>
          <Select label="Care stream" options={STREAM_OPTIONS} value={serviceStream} onChange={(event) => setServiceStream(event.target.value as ServiceStream)} />
          <Button type="submit" disabled={!label.trim() || !code} loading={addReason.isPending} icon={<Plus className="size-4" aria-hidden />}>Add reason</Button>
        </form>
        {addReason.isError && <p role="alert" className="mt-3 text-[13px] text-danger-600">{addReason.error.message || "Couldn’t add this reason. Check whether the same reason already exists in this stream."}</p>}
        {addReason.isSuccess && <p role="status" className="mt-3 text-[12.5px] text-success-700">Reason added to {SERVICE_STREAM_DETAILS[serviceStream].label}.</p>}
      </div>
    </Card>

    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Care stream">
      {STREAMS.map((stream) => <button key={stream} type="button" role="tab" aria-selected={stream === serviceStream} onClick={() => { setServiceStream(stream); addReason.reset(); }} className={`rounded-full border px-3.5 py-2 text-[12.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${stream === serviceStream ? "border-brand-600 bg-brand-600 text-white" : "border-border-subtle bg-surface-raised text-text-secondary hover:border-brand-400 hover:text-brand-700"}`}>
        {SERVICE_STREAM_DETAILS[stream].label}<span className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] ${stream === serviceStream ? "bg-white/20 text-white" : "bg-surface-sunken text-text-secondary"}`}>{(reasonsQuery.data ?? []).filter((reason) => reason.serviceStream === stream && reason.active).length}</span>
      </button>)}
    </div>

    {reasonsQuery.isPending ? <p role="status" className="py-6 text-center text-[13px] text-text-secondary">Loading reasons…</p> : reasonsQuery.isError ? <Card className="p-6 text-center"><p role="alert" className="text-[13px] text-danger-600">Classification reasons couldn’t be loaded.</p><Button variant="secondary" size="md" className="mt-3" loading={reasonsQuery.isFetching} onClick={() => void reasonsQuery.refetch()}>Retry</Button></Card> : filtered.length === 0 ? <Card className="flex flex-col items-center p-8 text-center"><span className="flex size-11 items-center justify-center rounded-xl bg-surface-sunken text-text-secondary"><ListChecks className="size-5" aria-hidden /></span><h3 className="mt-3 text-[14px] font-semibold text-text-primary">No reasons configured</h3><p className="mt-1 max-w-md text-[12.5px] text-text-secondary">Add a reason above. It will become available to clinicians for {SERVICE_STREAM_DETAILS[serviceStream].label.toLowerCase()} consultations.</p><button type="button" className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-text-secondary hover:text-text-primary" onClick={() => { setServiceStream("GENERAL"); addReason.reset(); }}><RotateCcw className="size-3" aria-hidden />Reset stream filter</button></Card> : <div className="grid gap-3 xl:grid-cols-2" role="tabpanel" aria-label={SERVICE_STREAM_DETAILS[serviceStream].label}>{filtered.map((reason) => <ReasonRow key={reason.id} reason={reason} />)}</div>}
  </div>;
}
