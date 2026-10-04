import { useState } from "react";
import type { CollectResult, Prescription } from "@/shared/api/pharmacy";
import { Button } from "@/shared/components/Button";
import { Switch } from "@/shared/components/Switch";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Drawer } from "../components/Drawer";
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

  function confirmCollection() {
    collect.mutate(
      {
        key: crypto.randomUUID(),
        files: byPatient ? {} : { signature: form.signature ?? undefined, proof: form.proof ?? undefined },
        payload: byPatient
          ? { collectedByPatient: true, idVerified: false }
          : {
              collectedByPatient: false,
              collector: toCollectorDetails(form),
              idVerified: form.idVerified,
              notes: form.notes.trim() || undefined,
            },
      },
      { onSuccess: setResult },
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
      <Button disabled={missing.length > 0} loading={collect.isPending} onClick={confirmCollection}>
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
          <CollectionResultView skippedItems={result.skippedItems} />
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
