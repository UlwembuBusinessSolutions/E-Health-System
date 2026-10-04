import { ConfirmDialog } from "../components/ConfirmDialog";

interface CancelCountDialogProps {
  open: boolean;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CancelCountDialog({ open, loading, onConfirm, onCancel }: CancelCountDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      tone="danger"
      title="Cancel this count?"
      body="Your counted numbers will be thrown away. Nothing has been posted to the ledger, so stock stays exactly as it is. To keep your work, choose “Save and continue later” instead."
      confirmLabel="Cancel the count"
      cancelLabel="Keep counting"
      loading={loading}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
