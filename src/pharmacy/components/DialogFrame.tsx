import { useEffect, useId, useRef, type MouseEvent, type ReactNode, type SyntheticEvent } from "react";
import clsx from "clsx";
import { X } from "lucide-react";

export interface DialogContentProps {
  title: string;
  description?: string;
  children: ReactNode;
  /** Action row pinned below the scrolling body. */
  footer?: ReactNode;
  onClose: () => void;
  /** Set false while saving: Esc, backdrop clicks and the close button are then ignored. */
  dismissible?: boolean;
}

interface DialogFrameProps extends DialogContentProps {
  /** Placement and sizing classes — the only thing Modal and Drawer differ in. */
  panelClassName: string;
}

// Shared by Modal and Drawer so they behave identically. The native <dialog>
// opened with showModal() gives a real focus trap, makes the page behind
// inert, provides aria-modal semantics and restores focus on close —
// behaviour that is easy to get subtly wrong when hand-rolled. It is mounted
// only while open, so callers render it conditionally.
export function DialogFrame({
  title,
  description,
  children,
  footer,
  onClose,
  dismissible = true,
  panelClassName,
}: DialogFrameProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;

    dialog.showModal();
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, []);

  // Esc fires "cancel"; routing it through onClose keeps the owner of the
  // `open` state as the single source of truth.
  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault();
    if (dismissible) onClose();
  }

  // A click on the ::backdrop reports the <dialog> itself as target; clicks
  // inside land on the panel's children.
  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (dismissible && event.target === event.currentTarget) onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={handleCancel}
      onClick={handleBackdropClick}
      className={clsx(
        "max-h-none max-w-none flex-col overflow-hidden bg-surface-raised p-0 text-text-primary shadow-card open:flex",
        "backdrop:bg-ink-900/50",
        panelClassName,
      )}
    >
      <header className="flex items-start justify-between gap-3 border-b border-border-subtle px-5 py-4">
        <div className="min-w-0">
          <h2 id={titleId} className="text-[17px] font-semibold text-text-primary">
            {title}
          </h2>
          {description && (
            <p id={descriptionId} className="mt-1 text-[13.5px] text-text-secondary">
              {description}
            </p>
          )}
        </div>
        <button
          type="button"
          aria-label="Close"
          disabled={!dismissible}
          onClick={onClose}
          className="-mr-2 -mt-1 grid size-11 shrink-0 place-items-center rounded-lg text-text-secondary hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-50"
        >
          <X className="size-5" aria-hidden />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      {footer && (
        <footer className="flex flex-col-reverse gap-2 border-t border-border-subtle px-5 py-4 sm:flex-row sm:justify-end">
          {footer}
        </footer>
      )}
    </dialog>
  );
}
