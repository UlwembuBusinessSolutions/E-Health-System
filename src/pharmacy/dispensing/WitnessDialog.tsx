import { useState } from "react";
import { Button } from "@/shared/components/Button";
import type { WitnessCredentials } from "@/shared/api/pharmacy";
import { Modal } from "../components/Modal";
import { WitnessFields } from "../components/WitnessFields";

interface WitnessDialogProps {
  facilityId: string;
  pending: boolean;
  errorMessage: string | null;
  /** Sends the refused request again, this time with the witness. */
  onConfirm: (witness: WitnessCredentials) => void;
  onCancel: () => void;
}

// Schedule 6 medicine needs a second pharmacist. Rendered only while needed,
// so every opening starts with nobody chosen and no password typed.
export function WitnessDialog({ facilityId, pending, errorMessage, onConfirm, onCancel }: WitnessDialogProps) {
  const [witnessStaffId, setWitnessStaffId] = useState("");
  const [witnessPin, setWitnessPin] = useState("");
  const ready = witnessStaffId !== "" && witnessPin !== "";

  return (
    <Modal
      open
      title="A second pharmacist must witness this"
      description="Schedule 6 medicine can only be dispensed with a witness."
      dismissible={!pending}
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" disabled={pending} onClick={onCancel}>
            Cancel
          </Button>
          <Button
            disabled={!ready}
            loading={pending}
            onClick={() => onConfirm({ witnessStaffId, witnessPassword: witnessPin })}
          >
            Witness and continue
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <WitnessFields
          facilityId={facilityId}
          required
          witnessStaffId={witnessStaffId}
          witnessPin={witnessPin}
          onChange={(change) => {
            if (change.witnessStaffId !== undefined) setWitnessStaffId(change.witnessStaffId);
            if (change.witnessPin !== undefined) setWitnessPin(change.witnessPin);
          }}
        />
        {errorMessage && (
          <p role="alert" className="rounded-lg bg-danger-50 px-3.5 py-2.5 text-[13.5px] text-danger-600">
            {errorMessage}
          </p>
        )}
      </div>
    </Modal>
  );
}
