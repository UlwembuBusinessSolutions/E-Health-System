import { useState } from "react";
import { CheckCircle2, LockKeyhole, UserRound } from "lucide-react";
import type { ConfirmCollectionPayload, Prescription } from "@/shared/api/pharmacy";
import { Button } from "@/shared/components/Button";
import { Input } from "@/shared/components/Input";
import { Select } from "@/shared/components/Select";
import { SignaturePad } from "@/shared/components/SignaturePad";

interface Props {
  prescription: Prescription;
  itemIds: string[];
  pending: boolean;
  onClose: () => void;
  onConfirm: (payload: ConfirmCollectionPayload) => void;
}

export function ConfirmCollectionDrawer({ prescription, itemIds, pending, onClose, onConfirm }: Props) {
  const [patientCollected, setPatientCollected] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);
  const [name, setName] = useState("");
  const [idType, setIdType] = useState("SA_ID");
  const [idNumber, setIdNumber] = useState("");
  const [relationship, setRelationship] = useState("");
  const [contact, setContact] = useState("");
  const [authorisation, setAuthorisation] = useState("");
  const [proof, setProof] = useState<File>();
  const [signature, setSignature] = useState<Blob | null>(null);
  const [idChecked, setIdChecked] = useState(false);
  const [notes, setNotes] = useState("");

  const items = prescription.items.filter((item) => itemIds.includes(item.id));
  const controlled = items.some((item) => (item.schedule ?? 0) >= 5);
  const invalidVerbal = controlled && authorisation === "VERBAL_CONSENT";
  const representativeValid = name.trim() && idNumber.trim() && relationship && contact.trim() && authorisation &&
    idChecked && signature && (!controlled || (authorisation === "WRITTEN_CONSENT_LETTER" && proof));
  const ready = patientCollected || Boolean(representativeValid);

  function togglePatientCollection(next: boolean) {
    if (next && !patientCollected && (name || idNumber || proof || signature)) {
      setConfirmClear(true);
      return;
    }
    setPatientCollected(next);
  }

  function submit() {
    if (!ready || pending) return;
    onConfirm({
      itemIds,
      collectedByPatient: patientCollected,
      ...(!patientCollected && {
        collectorName: name.trim(), idType, idNumber: idNumber.trim(), relationship,
        contactNumber: contact.trim(), authorisationType: authorisation, proof,
        signature: signature ?? undefined, idChecked, notes: notes.trim() || undefined,
      }),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="collection-title" className="flex h-full w-full max-w-[520px] flex-col bg-surface-raised shadow-2xl">
        <header className="border-b border-border-subtle px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div><h2 id="collection-title" className="text-xl font-semibold">Confirm collection</h2><p className="mt-1 font-mono text-xs text-text-secondary">{prescription.serialNumber} · {prescription.patientName} · {prescription.patientMpi}</p></div>
            <button type="button" aria-label="Close" onClick={onClose} className="text-xl text-text-secondary">×</button>
          </div>
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          <div className="rounded-xl bg-surface-sunken p-4"><p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Medication</p>{items.map((item) => <p key={item.id} className="text-sm">{item.drugName} — {item.dosage} × {item.quantity}{item.schedule ? ` · Schedule ${item.schedule}` : ""}</p>)}</div>
          <label className="flex cursor-pointer items-center justify-between rounded-xl border border-border-subtle p-4">
            <span><span className="block text-sm font-semibold">Collected by patient</span><span className="text-xs text-text-secondary">Turn off if someone else is collecting on the patient’s behalf.</span></span>
            <input type="checkbox" checked={patientCollected} onChange={(e) => togglePatientCollection(e.target.checked)} className="size-5 accent-brand-600" />
          </label>
          {!patientCollected && <div className="space-y-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold uppercase text-brand-700"><UserRound className="size-4" /> Third-party collector details</h3>
            {controlled && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">This prescription contains Schedule 5 or higher medication. A third party can collect it only with uploaded written authorisation.</p>}
            <Input label="Full name" required value={name} onChange={(e) => setName(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <Select label="ID type" required value={idType} onChange={(e) => setIdType(e.target.value)} options={[{ value: "SA_ID", label: "SA ID" }, { value: "PASSPORT", label: "Passport" }, { value: "OTHER", label: "Other" }]} />
              <Input label="ID / passport number" required value={idNumber} onChange={(e) => setIdNumber(e.target.value)} />
              <Select label="Relationship to patient" required value={relationship} onChange={(e) => setRelationship(e.target.value)} options={[{ value: "", label: "Select relationship" }, ...["Spouse / Partner", "Parent", "Child", "Sibling", "Caregiver", "Other"].map((v) => ({ value: v, label: v }))]} />
              <Input label="Contact number" required value={contact} onChange={(e) => setContact(e.target.value)} />
            </div>
            <Select label="Authorisation type" required value={authorisation} onChange={(e) => setAuthorisation(e.target.value)} options={[{ value: "", label: "Select authorisation" }, { value: "WRITTEN_CONSENT_LETTER", label: "Written consent letter" }, { value: "VERBAL_CONSENT", label: "Verbal consent (confirmed by phone)" }, { value: "OTHER_WRITTEN", label: "Other written authorisation" }]} />
            {invalidVerbal && <p className="text-xs text-danger-600">Verbal consent is not accepted for Schedule 5 or higher medication. Upload written authorisation.</p>}
            <div><label className="mb-1.5 block text-[13px] font-medium">Proof of authorisation{controlled && " *"}</label><input type="file" accept=".pdf,image/*" onChange={(e) => setProof(e.target.files?.[0])} className="block w-full text-sm" />{proof && <p className="mt-1 text-xs text-text-secondary">{proof.name}</p>}</div>
            <div><p className="mb-1.5 text-[13px] font-medium">Collector signature *</p><SignaturePad onChange={setSignature} /></div>
            <label className="flex gap-2 rounded-lg border border-border-subtle p-3 text-xs"><input type="checkbox" checked={idChecked} onChange={(e) => setIdChecked(e.target.checked)} />I have physically checked the collector’s ID and matched it to the document presented at the counter.</label>
            <label className="block text-[13px] font-medium">Notes (optional)<textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-1.5 w-full rounded-lg border border-border-strong p-3 text-sm" /></label>
          </div>}
          <p className="flex gap-2 rounded-lg bg-surface-sunken p-3 text-xs text-text-secondary"><LockKeyhole className="size-4 shrink-0" />Recorded automatically with the staff member, branch and time. Saved collection records can’t be edited, only amended.</p>
        </div>
        <footer className="flex items-center justify-between border-t border-border-subtle p-4"><span className="text-xs text-text-secondary">{ready ? "Ready to confirm" : "Complete required collector details"}</span><div className="flex gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!ready || invalidVerbal} loading={pending} icon={<CheckCircle2 className="size-4" />} onClick={submit}>Confirm collection</Button></div></footer>
        {confirmClear && <div className="absolute inset-0 flex items-center justify-center bg-black/40 p-5"><div role="alertdialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-surface-raised p-6 shadow-xl"><h3 className="text-lg font-semibold">Switch back to patient collection?</h3><p className="mt-2 text-sm text-text-secondary">The collector details, uploaded proof and signature you’ve captured will be cleared.</p><div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={() => setConfirmClear(false)}>Keep details</Button><Button className="bg-danger-600 hover:bg-danger-700" onClick={() => { setName(""); setIdNumber(""); setRelationship(""); setContact(""); setAuthorisation(""); setProof(undefined); setSignature(null); setNotes(""); setIdChecked(false); setPatientCollected(true); setConfirmClear(false); }}>Clear and switch</Button></div></div></div>}
      </section>
    </div>
  );
}
