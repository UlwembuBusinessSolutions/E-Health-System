import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { recordRegisterEntry, type ScheduledProduct } from "@/shared/api/pharmacyRegister";
import { Button } from "@/shared/components/Button";
import { Input } from "@/shared/components/Input";
import { Select } from "@/shared/components/Select";
import { useToast } from "@/shared/components/toast/ToastProvider";
import { Modal } from "../components/Modal";
import { QuantityInput } from "../components/QuantityInput";
import { describeError } from "../lib/problem";
import { WitnessFields } from "../components/WitnessFields";
import { invalidateAfterStockMovement } from "../lib/queryKeys";
import {
  EMPTY_REMOVAL,
  OTHER_REMOVAL_KINDS,
  removalProblem,
  toEntryPayload,
  witnessRequired,
  type RemovalDraft,
  type RemovalMode,
} from "./registerMath";

interface RecordRemovalDialogProps {
  facilityId: string;
  product: ScheduledProduct;
  open: boolean;
  onClose: () => void;
}

const MODES: { value: RemovalMode; label: string }[] = [
  { value: "PATIENT", label: "Dispensed to a patient" },
  { value: "OTHER", label: "Other removal" },
];

function RemovalForm({ facilityId, product, onClose }: Omit<RecordRemovalDialogProps, "open">) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<RemovalDraft>(EMPTY_REMOVAL);
  const [lotNumber, setLotNumber] = useState(product.currentLot ?? "");
  const set = (change: Partial<RemovalDraft>) => setDraft((current) => ({ ...current, ...change }));

  const problem = removalProblem(draft, product.schedule, product.onHand) ?? (lotNumber.trim() ? null : "Enter the lot number.");
  const record = useMutation({
    mutationFn: () => recordRegisterEntry(toEntryPayload(draft, facilityId, product.productId, lotNumber.trim())),
    // The entry also posts to the stock ledger, so the register, stock and ledger all go stale.
    onSuccess: async () => {
      await invalidateAfterStockMovement(queryClient);
      showToast("Added to the register.", "success");
      onClose();
    },
    onError: (error) => showToast(describeError(error), "error"),
  });

  return (
    <Modal
      open
      size="lg"
      title="Record removal"
      description={`${product.productName} · ${product.onHand} on hand`}
      onClose={onClose}
      dismissible={!record.isPending}
      footer={
        <>
          <Button variant="secondary" disabled={record.isPending} onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={problem !== null} loading={record.isPending} onClick={() => record.mutate()}>
            Add to register
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {witnessRequired(product.schedule) && (
          <p className="rounded-lg bg-danger-50 px-3.5 py-2.5 text-[13.5px] text-danger-600">
            <strong>Schedule 6.</strong> Every removal needs a second staff member to witness it and confirm with their PIN.
          </p>
        )}

        <div role="radiogroup" aria-label="Type of removal" className="grid grid-cols-2 gap-2">
          {MODES.map((mode) => (
            <button
              key={mode.value}
              type="button"
              role="radio"
              aria-checked={draft.mode === mode.value}
              onClick={() => set({ mode: mode.value })}
              className={`min-h-11 rounded-lg border px-3 text-[13.5px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
                draft.mode === mode.value ? "border-brand-500 bg-brand-50 text-brand-700" : "border-border-strong text-text-secondary"
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-text-primary">Quantity</span>
            <QuantityInput label="Quantity removed" min={1} max={product.onHand} value={draft.quantity} onChange={(quantity) => set({ quantity })} />
          </div>
          <Input label="Lot number" required value={lotNumber} onChange={(event) => setLotNumber(event.target.value)} />
        </div>

        {draft.mode === "PATIENT" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="RX number" required value={draft.rxSerial} onChange={(event) => set({ rxSerial: event.target.value })} />
            <Input label="Patient name" required value={draft.patientName} onChange={(event) => set({ patientName: event.target.value })} />
            <Input label="Patient ID" value={draft.patientIdRef} onChange={(event) => set({ patientIdRef: event.target.value })} />
            <Input label="Prescriber" required value={draft.prescriber} onChange={(event) => set({ prescriber: event.target.value })} />
            <Input label="Prescriber reg. no." value={draft.prescriberRegNo} onChange={(event) => set({ prescriberRegNo: event.target.value })} />
          </div>
        ) : (
          <div className="grid gap-4">
            <Select
              label="What happened to it?"
              value={draft.kind}
              options={OTHER_REMOVAL_KINDS}
              onChange={(event) => set({ kind: event.target.value as RemovalDraft["kind"] })}
            />
            <Input label="Reason" required value={draft.reason} hint="For example: expired and destroyed with a witness." onChange={(event) => set({ reason: event.target.value })} />
          </div>
        )}

        <WitnessFields
          facilityId={facilityId}
          required={witnessRequired(product.schedule)}
          witnessStaffId={draft.witnessStaffId}
          witnessPin={draft.witnessPin}
          onChange={set}
        />
        {problem && <p role="status" className="text-[13px] text-text-secondary">{problem}</p>}
      </div>
    </Modal>
  );
}

export function RecordRemovalDialog({ open, ...rest }: RecordRemovalDialogProps) {
  return open ? <RemovalForm {...rest} /> : null;
}
