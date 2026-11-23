import { useState, type ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownToLine, FileText, Plus, Printer, Send, X } from "lucide-react";
import { Card } from "@/shared/components/Card";
import { Button } from "@/shared/components/Button";
import { Input } from "@/shared/components/Input";
import { Select } from "@/shared/components/Select";
import { ApiError } from "@/shared/api/client";
import { useAuth } from "@/auth/AuthContext";
import { canManagePatientReferrals } from "@/auth/roles";
import {
  changeReferralStatus, createPatientReferral, getPrintableReferral, getReferralDocumentUrl,
  getReferralHistory, listPatientReferrals, listReferralDocuments, updatePatientReferral,
  listReferralDestinations, uploadReferralDocument, type PatientReferral, type ReferralPayload, type ReferralStatus,
  type ReferralType,
} from "@/shared/api/referrals";

function errorText(cause: unknown, fallback: string): string {
  if (cause instanceof ApiError && cause.fieldErrors) {
    return Object.entries(cause.fieldErrors).map(([field, message]) => `${field}: ${message}`).join(" · ");
  }
  return cause instanceof Error ? cause.message : fallback;
}
interface Props {
  patientId: string;
  patientName: string;
  patientMpi: string;
  patientDateOfBirth: string | null;
  patientContactNumber: string;
  archived: boolean;
}

type DraftFields = {
  referralType: ReferralType;
  destinationFacilityId: string;
  institutionName: string;
  contactPerson: string;
  telephoneNumber: string;
  faxNumber: string;
  referralDate: string;
  reason: string;
  clinicalSummary: string;
  requiredMedication: string;
  medicationInstructions: string;
  additionalNotes: string;
};

function localDateInputValue(): string {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

const blankDraft = (): DraftFields => ({
  referralType: "REFERRAL", destinationFacilityId: "", institutionName: "", contactPerson: "",
  telephoneNumber: "", faxNumber: "", referralDate: localDateInputValue(),
  reason: "", clinicalSummary: "", requiredMedication: "", medicationInstructions: "", additionalNotes: "",
});

function toFields(referral: PatientReferral): DraftFields {
  return {
    referralType: referral.referralType, destinationFacilityId: referral.destinationFacilityId ?? "",
    institutionName: referral.institutionName ?? "", contactPerson: referral.contactPerson ?? "",
    telephoneNumber: referral.telephoneNumber ?? "", faxNumber: referral.faxNumber ?? "",
    referralDate: referral.referralDate, reason: referral.reason ?? "", clinicalSummary: referral.clinicalSummary ?? "",
    requiredMedication: referral.requiredMedication ?? "", medicationInstructions: referral.medicationInstructions ?? "",
    additionalNotes: referral.additionalNotes ?? "",
  };
}

const statusLabel: Record<ReferralStatus, string> = {
  DRAFT: "Draft", SUBMITTED: "Submitted", ACCEPTED: "Accepted", COMPLETED: "Completed", CANCELLED: "Cancelled",
};

export function PatientReferralsTab(props: Props) {
  const { patientId, archived } = props;
  const { user } = useAuth();
  const canManage = canManagePatientReferrals(user?.role);
  const client = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [fields, setFields] = useState<DraftFields>(blankDraft);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const referrals = useQuery({ queryKey: ["patient-referrals", patientId], queryFn: () => listPatientReferrals(patientId) });
  const facilities = useQuery({ queryKey: ["referral-destinations"], queryFn: listReferralDestinations });
  const selected = referrals.data?.find((item) => item.id === selectedId) ?? null;
  const documents = useQuery({
    queryKey: ["referral-documents", patientId, selectedId],
    queryFn: () => listReferralDocuments(patientId, selectedId!), enabled: !!selectedId,
  });
  const history = useQuery({
    queryKey: ["referral-history", patientId, selectedId],
    queryFn: () => getReferralHistory(patientId, selectedId!), enabled: !!selectedId,
  });
  const canEdit = canManage && !archived && (!selected || selected.status === "DRAFT");

  function update<K extends keyof DraftFields>(key: K, value: DraftFields[K]) {
    setFields((previous) => ({ ...previous, [key]: value }));
  }

  function selectReferral(referral: PatientReferral) {
    setSelectedId(referral.id);
    setIsCreating(false);
    setFields(toFields(referral));
    setError(null);
  }

  function startNew() {
    setSelectedId(null);
    setIsCreating(true);
    setFields(blankDraft());
    setError(null);
  }

  const payload = (): ReferralPayload => ({
    ...fields,
    destinationFacilityId: fields.destinationFacilityId || null,
  });

  const saveMutation = useMutation({
    mutationFn: () => selectedId
      ? updatePatientReferral(patientId, selectedId, payload())
      : createPatientReferral(patientId, payload()),
    onSuccess: async (saved) => {
      setSelectedId(saved.id);
      setIsCreating(false);
      setFields(toFields(saved));
      await client.invalidateQueries({ queryKey: ["patient-referrals", patientId] });
    },
  });

  const actionMutation = useMutation({
    mutationFn: (action: "submit" | "complete" | "cancel") =>
      changeReferralStatus(patientId, selectedId!, action),
    onSuccess: async (saved) => {
      setFields(toFields(saved));
      setError(null);
      await Promise.all([
        client.invalidateQueries({ queryKey: ["patient-referrals", patientId] }),
        client.invalidateQueries({ queryKey: ["referral-history", patientId, selectedId] }),
      ]);
    },
  });

  async function save() {
    setError(null);
    try { await saveMutation.mutateAsync(); } catch (cause) {
      setError(errorText(cause, "Could not save the referral."));
    }
  }

  async function act(action: "submit" | "complete" | "cancel") {
    setError(null);
    if (action === "submit") {
      const missing = [
        ["Receiving institution name", fields.institutionName],
        ["Reason for referral", fields.reason],
        ["Clinical summary", fields.clinicalSummary],
      ].filter(([, value]) => !value.trim()).map(([label]) => label);
      if (missing.length) {
        setError(`Complete the following before submitting: ${missing.join(", ")}.`);
        return;
      }
    }
    try {
      if (action === "submit") await saveMutation.mutateAsync();
      await actionMutation.mutateAsync(action);
    } catch (cause) {
      setError(errorText(cause, "Could not update the referral status."));
    }
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !selectedId) return;
    setError(null);
    setIsUploading(true);
    try {
      await uploadReferralDocument(patientId, selectedId, file);
      await client.invalidateQueries({ queryKey: ["referral-documents", patientId, selectedId] });
    } catch (cause) {
      setError(errorText(cause, "Could not upload the document."));
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  }

  async function download(documentId: string) {
    const tab = window.open("", "_blank");
    if (!tab) { setError("Allow pop-ups to open the document."); return; }
    try { tab.location.assign(await getReferralDocumentUrl(patientId, selectedId!, documentId)); }
    catch (cause) { tab.close(); setError(errorText(cause, "Could not open the document.")); }
  }

  async function print() {
    const tab = window.open("", "_blank");
    if (!tab) { setError("Allow pop-ups to print the referral."); return; }
    try {
      const html = await getPrintableReferral(patientId, selectedId!);
      tab.document.open(); tab.document.write(html); tab.document.close();
    } catch (cause) {
      tab.close(); setError(errorText(cause, "Could not prepare the referral for printing."));
    }
  }

  const isBusy = saveMutation.isPending || actionMutation.isPending || isUploading;
  const locked = !canEdit || isBusy;
  return (
    <div className="space-y-5">
      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-[16px] font-semibold text-text-primary">Referrals and transfers</h2>
            <p className="mt-1 text-[13px] text-text-secondary">Patient record: {props.patientName} · {props.patientMpi}
              {props.patientDateOfBirth ? ` · DOB ${props.patientDateOfBirth}` : ""} · {props.patientContactNumber}</p>
          </div>
          <Button type="button" icon={<Plus className="size-4" aria-hidden />} disabled={archived || !canManage} onClick={startNew}>
            New referral
          </Button>
        </div>
        {!canManage && <p className="mt-3 text-sm text-text-secondary">You have read-only access to patient referrals.</p>}
        {archived && <p className="mt-3 text-sm text-text-secondary">This patient record is archived; referrals are read-only.</p>}
        {referrals.isLoading ? <p className="mt-4 text-sm text-text-secondary">Loading referral history…</p>
          : referrals.isError ? <p role="alert" className="mt-4 text-sm text-danger-600">Could not load referral history.</p>
          : referrals.data?.length ? <div className="mt-4 flex flex-wrap gap-2">
            {referrals.data.map((item) => <button key={item.id} type="button" onClick={() => selectReferral(item)}
              className={`rounded-lg border px-3 py-2 text-left text-[13px] ${selectedId === item.id ? "border-brand-500 bg-brand-50" : "border-border-subtle"}`}>
              <span className="font-medium">{item.referralType === "TRANSFER" ? "Transfer" : "Referral"}</span>
              <span className="mx-2 text-text-secondary">·</span>{statusLabel[item.status]}
              <span className="ml-2 text-text-secondary">· {item.referralDate}</span>
              <span className="block text-text-secondary">{item.institutionName || "Destination not set"}</span>
            </button>)}
          </div> : <p className="mt-4 text-sm text-text-secondary">No referrals have been recorded for this patient.</p>}
      </Card>

      {(isCreating || selected) && <Card className="p-5 sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div><h3 className="text-[15px] font-semibold text-text-primary">{isCreating ? "New referral draft" : "Referral details"}</h3>
            {selected && <p className="mt-1 text-xs text-text-secondary">{statusLabel[selected.status]} · Created by {selected.initiatedByName}</p>}</div>
          <div className="flex gap-2">
            {selected && <Button type="button" variant="secondary" icon={<Printer className="size-3.5" aria-hidden />} onClick={print}>Print</Button>}
            <Button type="button" variant="ghost" icon={<X className="size-4" aria-hidden />} onClick={() => { setSelectedId(null); setIsCreating(false); }}>Close</Button>
          </div>
        </div>
        {error && <p role="alert" className="mb-4 rounded-lg bg-danger-50 p-3 text-sm text-danger-700">{error}</p>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select label="Referral type" required disabled={locked} value={fields.referralType}
            options={[{ value: "REFERRAL", label: "Referral" }, { value: "TRANSFER", label: "Patient transfer" }]}
            onChange={(e) => update("referralType", e.target.value as ReferralType)} />
          <Input label="Referral date" type="date" required disabled={locked} value={fields.referralDate}
            onChange={(e) => update("referralDate", e.target.value)} />
          <Select label="Destination clinic (optional)"
            disabled={locked || facilities.isLoading || facilities.isError || !facilities.data?.length}
            value={fields.destinationFacilityId}
            placeholder={facilities.isLoading ? "Loading clinics…" : facilities.data?.length ? "Select clinic" : "No active clinics available"}
            options={(facilities.data ?? []).map((facility) => ({
              value: facility.facilityId,
              label: `${facility.facilityName} — ${facility.organizationName}`,
            }))}
            onChange={(e) => {
              const facility = facilities.data?.find((item) => item.facilityId === e.target.value);
              update("destinationFacilityId", e.target.value);
              if (facility) {
                update("institutionName", `${facility.facilityName} — ${facility.organizationName}`);
                update("telephoneNumber", facility.telephoneNumber ?? "");
              }
            }} />
          {facilities.isError && <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-danger-600 sm:col-span-2">
            <span>{facilities.error instanceof ApiError ? `Could not load clinics: ${facilities.error.message}` : "Could not load clinics. You can still enter the receiving institution name manually."}</span>
            <Button type="button" variant="ghost" loading={facilities.isFetching} onClick={() => void facilities.refetch()}>Retry</Button>
          </div>}
          {facilities.isSuccess && !facilities.data.length && <p role="status" className="text-sm text-text-secondary sm:col-span-2">There are no active clinics in active organizations. You can enter the receiving institution name manually.</p>}
          <Input label="Receiving institution name" required disabled={locked} value={fields.institutionName}
            onChange={(e) => update("institutionName", e.target.value)} />
          <Input label="Contact person" disabled={locked} value={fields.contactPerson}
            onChange={(e) => update("contactPerson", e.target.value)} />
          <Input label="Telephone number" disabled={locked} value={fields.telephoneNumber}
            onChange={(e) => update("telephoneNumber", e.target.value)} />
          <Input label="Fax number" hint="Enter a number, no/N/A, or leave blank if unavailable." disabled={locked} value={fields.faxNumber}
            onChange={(e) => update("faxNumber", e.target.value)} />
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-text-primary sm:col-span-2">Reason for referral <span className="text-danger-500">*</span>
            <textarea required disabled={locked} rows={3} value={fields.reason} onChange={(e) => update("reason", e.target.value)} className="rounded-lg border border-border-strong bg-surface-raised p-3 text-sm" /></label>
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-text-primary sm:col-span-2">Clinical summary <span className="text-danger-500">*</span>
            <textarea required disabled={locked} rows={4} value={fields.clinicalSummary} onChange={(e) => update("clinicalSummary", e.target.value)} className="rounded-lg border border-border-strong bg-surface-raised p-3 text-sm" /></label>
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-text-primary">Required medication
            <textarea disabled={locked} rows={2} value={fields.requiredMedication} onChange={(e) => update("requiredMedication", e.target.value)} className="rounded-lg border border-border-strong bg-surface-raised p-3 text-sm" /></label>
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-text-primary">Medication instructions
            <textarea disabled={locked} rows={2} value={fields.medicationInstructions} onChange={(e) => update("medicationInstructions", e.target.value)} className="rounded-lg border border-border-strong bg-surface-raised p-3 text-sm" /></label>
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-text-primary sm:col-span-2">Additional notes
            <textarea disabled={locked} rows={3} value={fields.additionalNotes} onChange={(e) => update("additionalNotes", e.target.value)} className="rounded-lg border border-border-strong bg-surface-raised p-3 text-sm" /></label>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {canEdit && <Button type="button" loading={saveMutation.isPending} disabled={isBusy} onClick={save}>Save draft</Button>}
          {canManage && selected?.status === "DRAFT" && <Button type="button" variant="secondary" icon={<Send className="size-3.5" aria-hidden />} onClick={() => act("submit")} loading={actionMutation.isPending || saveMutation.isPending} disabled={isBusy}>Submit referral</Button>}
          {canManage && selected?.status === "ACCEPTED" && <Button type="button" variant="secondary" onClick={() => act("complete")} loading={actionMutation.isPending} disabled={isBusy}>Mark completed</Button>}
          {canManage && selected && ["DRAFT", "SUBMITTED", "ACCEPTED"].includes(selected.status) && <Button type="button" variant="danger" onClick={() => act("cancel")} loading={actionMutation.isPending} disabled={isBusy}>Cancel referral</Button>}
        </div>

        {selected && <div className="mt-6 border-t border-border-subtle pt-5">
          <h4 className="text-sm font-semibold text-text-primary">Supporting documents</h4>
          {canManage && selected.status === "DRAFT" && !archived && <label aria-disabled={isBusy} className={`mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border-default px-3 py-2 text-sm hover:bg-surface-sunken ${isBusy ? "opacity-60" : ""}`}>
            <Plus className="size-4" aria-hidden /> {isUploading ? "Uploading…" : "Upload document"}
            <input className="sr-only" type="file" accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.webp" disabled={isBusy} onChange={upload} />
          </label>}
          {documents.isLoading ? <p className="mt-2 text-sm text-text-secondary">Loading supporting documents…</p>
            : documents.isError ? <p role="alert" className="mt-2 text-sm text-danger-600">Could not load supporting documents.</p>
            : documents.data?.length ? <ul className="mt-3 divide-y divide-border-subtle">{documents.data.map((doc) => <li key={doc.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="flex min-w-0 items-center gap-2"><FileText className="size-4 shrink-0 text-text-secondary" aria-hidden /><span className="truncate">{doc.originalFilename}</span></span>
            <Button type="button" variant="ghost" size="md" icon={<ArrowDownToLine className="size-4" aria-hidden />} onClick={() => download(doc.id)}>Open</Button>
          </li>)}</ul> : <p className="mt-2 text-sm text-text-secondary">No supporting documents attached.</p>}
        </div>}

        {selected && <div className="mt-6 border-t border-border-subtle pt-5">
          <h4 className="text-sm font-semibold text-text-primary">Status history</h4>
          {history.isLoading ? <p className="mt-2 text-sm text-text-secondary">Loading status history…</p>
            : history.isError ? <p role="alert" className="mt-2 text-sm text-danger-600">Could not load status history.</p>
            : <ol className="mt-2 space-y-2">{history.data?.map((event) => <li key={event.id} className="text-[13px] text-text-secondary">
            <span className="font-medium text-text-primary">{statusLabel[event.toStatus]}</span> · {event.actorName} · {new Date(event.occurredAt).toLocaleString()}
            {event.note && <span> · {event.note}</span>}
          </li>)}</ol>}
        </div>}
      </Card>}
    </div>
  );
}
