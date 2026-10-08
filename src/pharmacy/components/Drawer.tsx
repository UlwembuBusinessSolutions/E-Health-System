import { DialogFrame, type DialogContentProps } from "./DialogFrame";

interface DrawerProps extends DialogContentProps {
  open: boolean;
}

// Pinned to the right edge (ml-auto, no vertical margin); full width on phones.
const PANEL_CLASSES = "ml-auto mr-0 h-dvh w-full sm:max-w-md sm:rounded-l-2xl";

export function Drawer({ open, ...content }: DrawerProps) {
  if (!open) return null;
  return <DialogFrame {...content} panelClassName={PANEL_CLASSES} />;
}
