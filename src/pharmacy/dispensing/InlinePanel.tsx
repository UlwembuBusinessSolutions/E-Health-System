import type { ReactNode } from "react";
import { Button } from "@/shared/components/Button";

interface InlinePanelProps {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  confirmDisabled?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// The common frame of every small per-item form (out of stock, part dispense,
// return, substitute): a titled box with Cancel and one confirming action. A
// <form> so Enter submits, and the confirm button stays the only submit.
export function InlinePanel({
  title,
  children,
  confirmLabel,
  confirmDisabled = false,
  loading = false,
  onConfirm,
  onCancel,
}: InlinePanelProps) {
  return (
    <form
      aria-label={title}
      onSubmit={(event) => {
        event.preventDefault();
        if (!confirmDisabled && !loading) onConfirm();
      }}
      className="mt-3 flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface-raised p-3.5"
    >
      {children}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" disabled={loading} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={confirmDisabled} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </form>
  );
}
