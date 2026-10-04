import { useId, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/shared/api/client";
import {
  createSupplier,
  DUPLICATE_SUPPLIER_CODE,
  updateSupplier,
  type Supplier,
} from "@/shared/api/pharmacyReceiving";
import { Button } from "@/shared/components/Button";
import { Input } from "@/shared/components/Input";
import { FormRow } from "@/shared/components/FormRow";
import { Modal } from "@/pharmacy/components/Modal";
import { describeError } from "@/pharmacy/lib/problem";
import { pharmacyKeys } from "@/pharmacy/lib/queryKeys";
import { findDuplicateSupplier, type DuplicateMatch, type SupplierRef } from "./supplierName";
import { useSuppliers } from "./useSuppliers";

interface SupplierDialogProps {
  /** Present when editing; omit to add a new supplier. */
  supplier?: Supplier;
  /** Pre-fills the name when the dialog is opened from "Add [typed name] as a new supplier". */
  initialName?: string;
  onClose: () => void;
  onSaved: (supplier: Supplier) => void;
  /** The user chose the supplier that already exists instead of adding a duplicate. */
  onUseExisting: (existing: SupplierRef) => void;
}

// Rendered only while open (callers write `{open && <SupplierDialog … />}`), so
// every opening starts with a fresh form and no reset logic is needed.
export function SupplierDialog({ supplier, initialName = "", onClose, onSaved, onUseExisting }: SupplierDialogProps) {
  const formId = useId();
  const queryClient = useQueryClient();
  const suppliers = useSuppliers();
  const isEdit = supplier !== undefined;

  const [name, setName] = useState(supplier?.name ?? initialName);
  const [phone, setPhone] = useState(supplier?.phone ?? "");
  const [email, setEmail] = useState(supplier?.email ?? "");
  // "No, add as new" is an explicit answer to a warning about one particular name.
  const [confirmedDistinct, setConfirmedDistinct] = useState(false);
  // The server can still find a duplicate our local list missed (added moments ago by a colleague).
  const [serverMatch, setServerMatch] = useState<DuplicateMatch | null>(null);

  const localMatch = findDuplicateSupplier(name, suppliers.data ?? [], supplier?.id);
  const match = localMatch ?? serverMatch;
  const blocked = match?.exact === true;
  const needsAnswer = match !== null && !match.exact && !confirmedDistinct;

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        confirmDistinct: confirmedDistinct || undefined,
      };
      return supplier ? updateSupplier(supplier.id, payload) : createSupplier(payload);
    },
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: pharmacyKeys.suppliers.all });
      onSaved(saved);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === DUPLICATE_SUPPLIER_CODE && error.existing) {
        setServerMatch({ existing: error.existing, exact: !error.similar });
      }
    },
  });

  function changeName(next: string) {
    setName(next);
    setConfirmedDistinct(false);
    setServerMatch(null);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || blocked || needsAnswer || save.isPending) return;
    save.mutate();
  }

  const saveError = save.error && serverMatch === null ? describeError(save.error) : null;

  return (
    <Modal
      open
      size="md"
      title={isEdit ? "Edit supplier" : "Add a supplier"}
      description={isEdit ? undefined : "Saved once and reused on every future receipt, so history groups correctly."}
      dismissible={!save.isPending}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={save.isPending} disabled={!name.trim() || blocked || needsAnswer}>
            {isEdit ? "Save changes" : "Add supplier"}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Input
          label="Supplier name"
          required
          autoFocus
          autoComplete="off"
          maxLength={200}
          value={name}
          onChange={(event) => changeName(event.target.value)}
        />

        {match && (
          <DuplicateNotice
            match={match}
            onUseExisting={() => onUseExisting(match.existing)}
            onConfirmDistinct={() => setConfirmedDistinct(true)}
            confirmedDistinct={confirmedDistinct}
          />
        )}

        <FormRow>
          <Input
            label="Phone (optional)"
            type="tel"
            autoComplete="off"
            maxLength={40}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
          <Input
            label="Email (optional)"
            type="email"
            autoComplete="off"
            maxLength={200}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </FormRow>

        {saveError && (
          <p role="alert" className="text-[13.5px] text-danger-600">
            {saveError}
          </p>
        )}
      </form>
    </Modal>
  );
}

interface DuplicateNoticeProps {
  match: DuplicateMatch;
  confirmedDistinct: boolean;
  onUseExisting: () => void;
  onConfirmDistinct: () => void;
}

function DuplicateNotice({ match, confirmedDistinct, onUseExisting, onConfirmDistinct }: DuplicateNoticeProps) {
  const { existing, exact } = match;

  if (exact) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-lg bg-danger-50 p-3.5 text-[13.5px] text-danger-600">
        <p>
          <strong>{existing.name}</strong> is already in your supplier list, so it can't be added twice.
        </p>
        <Button variant="secondary" onClick={onUseExisting}>
          Use {existing.name}
        </Button>
      </div>
    );
  }

  if (confirmedDistinct) return null;

  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-lg bg-amber-50 p-3.5 text-[13.5px] text-amber-600">
      <p>
        Looks like <strong>{existing.name}</strong>, which is already in your list. Is it the same supplier?
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={onUseExisting}>
          Yes, use {existing.name}
        </Button>
        <Button variant="secondary" onClick={onConfirmDistinct}>
          No, add as new
        </Button>
      </div>
    </div>
  );
}
