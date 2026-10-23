import { useState } from "react";
import type { FoundLotPayload } from "@/shared/api/pharmacyCounts";
import { Button } from "@/shared/components/Button";
import { Input } from "@/shared/components/Input";
import { Modal } from "../components/Modal";
import { ProductSearchPicker } from "../components/ProductSearchPicker";
import { QuantityInput } from "../components/QuantityInput";

interface AddFoundLotDialogProps {
  open: boolean;
  saving: boolean;
  onSubmit: (lot: FoundLotPayload) => void;
  onClose: () => void;
}

interface Draft {
  productId: string;
  productName: string;
  lotNumber: string;
  expiryDate: string;
  quantity: number;
}

const EMPTY_DRAFT: Draft = { productId: "", productName: "", lotNumber: "", expiryDate: "", quantity: 1 };

// The dialog is mounted only while open (Modal returns null otherwise), so its
// state resets by itself each time and never needs manual clearing.
function FoundLotForm({ saving, onSubmit, onClose }: Omit<AddFoundLotDialogProps, "open">) {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const valid = draft.productId !== "" && draft.lotNumber.trim() !== "" && draft.expiryDate !== "" && draft.quantity > 0;

  return (
    <Modal
      open
      title="Add a lot I found"
      description="A lot that is on the shelf but not in the ledger."
      onClose={onClose}
      dismissible={!saving}
      footer={
        <>
          <Button variant="secondary" disabled={saving} onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!valid}
            loading={saving}
            onClick={() =>
              onSubmit({
                productId: draft.productId,
                lotNumber: draft.lotNumber.trim(),
                expiryDate: draft.expiryDate,
                quantity: draft.quantity,
              })
            }
          >
            Add to count
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {draft.productId ? (
          <p className="text-[14px]">
            <span className="font-medium text-text-primary">{draft.productName}</span>{" "}
            <button
              type="button"
              onClick={() => setDraft({ ...draft, productId: "", productName: "" })}
              className="min-h-11 px-2 text-[13px] font-medium text-brand-600 hover:underline"
            >
              Change
            </button>
          </p>
        ) : (
          <ProductSearchPicker
            label="Search for the product"
            onPick={(product) => setDraft({ ...draft, productId: product.id, productName: product.displayName })}
          />
        )}
        <Input label="Lot number" required value={draft.lotNumber} onChange={(event) => setDraft({ ...draft, lotNumber: event.target.value })} />
        <Input label="Expiry date" type="date" required value={draft.expiryDate} onChange={(event) => setDraft({ ...draft, expiryDate: event.target.value })} />
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-text-primary">Quantity</span>
          <QuantityInput label="Quantity found" min={1} value={draft.quantity} onChange={(quantity) => setDraft({ ...draft, quantity })} />
        </div>
        <p className="text-[13px] text-text-secondary">
          It is added as a difference of plus the quantity. Choose a reason like &ldquo;Unrecorded receipt&rdquo; when you review.
        </p>
      </div>
    </Modal>
  );
}

export function AddFoundLotDialog({ open, ...rest }: AddFoundLotDialogProps) {
  return open ? <FoundLotForm {...rest} /> : null;
}
