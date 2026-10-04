import type { ReactNode } from "react";
import { Button } from "@/shared/components/Button";
import { Modal } from "./Modal";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** What will happen, in plain language. */
  body: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Use for destructive or irreversible actions (reversals, write-offs). */
  tone?: "default" | "danger";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      size="sm"
      title={title}
      onClose={onCancel}
      dismissible={!loading}
      footer={
        <>
          <Button variant="secondary" disabled={loading} onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-[14px] text-text-secondary">{body}</div>
    </Modal>
  );
}
