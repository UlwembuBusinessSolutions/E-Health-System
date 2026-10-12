import { useState } from "react";
import { InlinePanel } from "./InlinePanel";
import { TextAreaField } from "./TextAreaField";

interface OutOfStockFormProps {
  // Prefilled when the item is already out of stock, so the note can be edited.
  initialNote: string;
  loading: boolean;
  onConfirm: (note: string) => void;
  onCancel: () => void;
}

export function OutOfStockForm({ initialNote, loading, onConfirm, onCancel }: OutOfStockFormProps) {
  const [note, setNote] = useState(initialNote);

  return (
    <InlinePanel
      title="Mark out of stock"
      confirmLabel="Confirm out of stock"
      loading={loading}
      onConfirm={() => onConfirm(note.trim())}
      onCancel={onCancel}
    >
      <TextAreaField
        label="Note (optional)"
        placeholder="e.g. Restock expected Friday"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        hint="The item stays on the prescription. Dispense it later once stock is back."
      />
    </InlinePanel>
  );
}
