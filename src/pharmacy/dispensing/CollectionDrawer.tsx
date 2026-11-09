import { useState } from "react";
import type { CollectResult, Prescription, WitnessCredentials } from "@/shared/api/pharmacy";
import { Button } from "@/shared/components/Button";
import { Switch } from "@/shared/components/Switch";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Drawer } from "../components/Drawer";
import { blobToDataUrl } from "../lib/blobToDataUrl";
import { describeError, isPbpaClinicScheduleRequired, isWitnessRequired } from "../lib/problem";
import {
  EMPTY_COLLECTOR_FORM,
  hasCapturedData,
  missingRequirements,
  toCollectorDetails,
  type CollectorFormState,
} from "./collectorForm";
import { CollectionMedicationList } from "./CollectionMedicationList";
import { CollectionResultView } from "./CollectionResultView";
import { useCollect } from "./hooks/useCollect";
import { collectableItems } from "./itemState";
import { ThirdPartyForm } from "./ThirdPartyForm";
import { WitnessDialog } from "./WitnessDialog";

interface CollectionDrawerProps {
  open: boolean;
  prescription: Prescription;
  startWithThirdParty: boolean;
  onClose: () => void;
}

function statusText(byPatient: boolean, missing: string[]): string {
  if (byPatient || missing.length === 0) return "Ready to confirm";
  return `${missing.length} required ${missing.length === 1 ? "item" : "items"} left`;
}

// Mounted only while open (see below), so every opening starts with a clean
// form instead of a previous collector's name and signature.
function OpenCollectionDrawer({ prescription, startWithThirdParty, onClose }: Omit<CollectionDrawerProps, "open">) {
  const [byPatient, setByPatient] = useState(!startWithThirdParty);
  const [form, setForm] = useState<CollectorFormState>(EMPTY_COLLECTOR_FORM);
  const [confirmingSwitch, setConfirmingSwitch] = useState(false);
  const [result, setResult] = useState<CollectResult | null>(null);
  // Set when the server refuses a Schedule 6 hand-over for lack of a witness.
  const [askingWitness, setAskingWitness] = useState(false);
  const [askingManager, setAskingManager] = useState(false);
  const [managerEmail, setManagerEmail] = useState("");
  const [managerPassword, setManagerPassword] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const collect = useCollect(prescription.id);

  const hasScheduledItem = collectableItems(prescription).some((item) => item.schedule !== null);
  const missing = byPatient ? [] : missingRequirements(form, hasScheduledItem);
  const patch = (changes: Partial<CollectorFormState>) => setForm((current) => ({ ...current, ...changes }));

  // Capturing a signature and proof takes effort, so discarding it by flicking
  // the switch must be a deliberate, confirmed act.
  function handleSwitch(nextByPatient: boolean) {
    if (nextByPatient && hasCapturedData(form)) {
      setConfirmingSwitch(true);
      return;
    }
    setByPatient(nextByPatient);
  }

  function switchBackToPatient() {
    setForm(EMPTY_COLLECTOR_FORM);
    setByPatient(true);
    setConfirmingSwitch(false);
  }

  // `witness` is only passed on the retry that follows a "needs a witness" refusal.
  async function confirmCollection(witness?: WitnessCredentials, manager?: { managerUserId: string; managerPassword: string; managerOverrideReason: string }) {
    const signature = !byPatient && form.signature ? await blobToDataUrl(form.signature) : undefined;
    collect.mutate(
      {
        proof: byPatient ? undefined : (form.proof ?? undefined),
        payload: byPatient
          ? { collectedByPatient: true, idVerified: false, ...witness, ...manager }
          : {
              collectedByPatient: false,
              collector: toCollectorDetails(form),
              idVerified: form.idVerified,
              signature,
              notes: form.notes.trim() || undefined,
              ...witness,
              ...manager,
            },
      },
      {
        onSuccess: (collected) => {
          setAskingWitness(false);
          setResult(collected);
        },
        onError: (error) => {
          if (isWitnessRequired(error)) setAskingWitness(true);
          if (isPbpaClinicScheduleRequired(error)) setAskingManager(true);
        },
      },
    );
  }

  const footer = result ? (
    <Button onClick={onClose}>Done</Button>
  ) : (
    <>
      <p role="status" className="self-center text-[13px] font-medium text-text-secondary sm:mr-auto">
        {statusText(byPatient, missing)}
      </p>
      <Button variant="secondary" disabled={collect.isPending} onClick={onClose}>
        Cancel
      </Button>
      <Button disabled={missing.length > 0} loading={collect.isPending} onClick={() => void confirmCollection()}>
        Confirm collection
      </Button>
    </>
  );

  return (
    <>
      <Drawer
        open
        title="Confirm collection"
        description={`${prescription.patientName} · ${prescription.serialNumber}`}
        dismissible={!collect.isPending}
        onClose={onClose}
        footer={footer}
      >
        {result ? (
          <CollectionResultView result={result} />
        ) : (
          <div className="flex flex-col gap-5">
            <CollectionMedicationList prescription={prescription} />
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border-subtle px-3.5 py-3">
              <div>
                <p className="text-[14px] font-medium text-text-primary">Collected by patient</p>
                <p className="text-[13px] text-text-secondary">
                  Turn off if someone else is collecting on the patient's behalf.
                </p>
              </div>
              <Switch label="Collected by patient" checked={byPatient} onChange={handleSwitch} />
            </div>
            {!byPatient && <ThirdPartyForm form={form} onChange={patch} hasScheduledItem={hasScheduledItem} />}
            <p className="text-[12.5px] text-text-secondary">
              Recorded automatically: who handed the medication over, and when. Saved collections can't be edited.
            </p>
          </div>
        )}
      </Drawer>
      {askingWitness && (
        <WitnessDialog
          facilityId={prescription.facilityId}
          pending={collect.isPending}
          errorMessage={collect.isError && !isWitnessRequired(collect.error) ? describeError(collect.error) : null}
          onConfirm={(witness) => void confirmCollection(witness)}
          onCancel={() => setAskingWitness(false)}
        />
      )}
      {askingManager && (
        <div role="dialog" aria-label="Manager clinic override" className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h2 className="text-base font-semibold text-text-primary">Manager approval required</h2>
            <p className="mt-1 text-sm text-text-secondary">Enter the facility manager&apos;s credentials and the reason for this unscheduled clinic.</p>
            <div className="mt-4 grid gap-3">
              <input aria-label="Facility manager email" type="email" placeholder="Facility manager email" value={managerEmail} onChange={(event) => setManagerEmail(event.target.value)} className="rounded border border-border-subtle px-3 py-2 text-sm" />
              <input aria-label="Manager password" type="password" placeholder="Manager password" value={managerPassword} onChange={(event) => setManagerPassword(event.target.value)} className="rounded border border-border-subtle px-3 py-2 text-sm" />
              <input aria-label="Override reason" placeholder="Reason for override" value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} className="rounded border border-border-subtle px-3 py-2 text-sm" />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setAskingManager(false)}>Cancel</Button>
              <Button disabled={!managerEmail || !managerPassword || !overrideReason || collect.isPending} loading={collect.isPending}
                onClick={() => { setAskingManager(false); void confirmCollection(undefined, { managerUserId: managerEmail, managerPassword, managerOverrideReason: overrideReason }); }}>Approve and confirm</Button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={confirmingSwitch}
        title="Switch back to patient collection?"
        body="The collector details, uploaded proof and signature you've captured will be cleared."
        confirmLabel="Clear and switch"
        cancelLabel="Keep details"
        onConfirm={switchBackToPatient}
        onCancel={() => setConfirmingSwitch(false)}
      />
    </>
  );
}

export function CollectionDrawer({ open, ...rest }: CollectionDrawerProps) {
  return open ? <OpenCollectionDrawer {...rest} /> : null;
}
