import clsx from "clsx";
import { DialogFrame, type DialogContentProps } from "./DialogFrame";

type ModalSize = "sm" | "md" | "lg";

interface ModalProps extends DialogContentProps {
  open: boolean;
  size?: ModalSize;
}

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
};

// Below `sm` the dialog becomes a full-screen sheet: a floating card leaves
// too little room for forms on a 360 px phone.
const PANEL_BASE =
  "m-auto h-dvh w-full sm:h-fit sm:max-h-[calc(100dvh-3rem)] sm:rounded-2xl";

export function Modal({ open, size = "md", ...content }: ModalProps) {
  if (!open) return null;
  return <DialogFrame {...content} panelClassName={clsx(PANEL_BASE, SIZE_CLASSES[size])} />;
}
