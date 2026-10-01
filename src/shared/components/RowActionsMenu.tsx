import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";
import clsx from "clsx";

export interface RowActionItem {
  key: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "default" | "danger";
}

// A single "⋮" trigger per row, replacing what used to be a row of up to
// 5-7 separate buttons (Print/Transfer/Boost/Vitals/Complete/Missed/Cancel
// on QueuePage, depending on status) — the table was unreadable once every
// column bled into a wall of buttons.
//
// Portals the menu to document.body rather than nesting it under the
// trigger: QueuePage's table sits inside an `overflow-x-auto` wrapper for
// horizontal scrolling on narrow screens, and per the CSS overflow spec,
// setting overflow-x to anything but visible forces overflow-y to compute
// to auto too — a plain absolutely-positioned menu nested inside that
// wrapper got silently clipped/scrolled away for any row not near the very
// top (confirmed by screenshot: the menu cut off mid-list). A portal
// escapes that clipping ancestor entirely; position is computed from the
// trigger's own bounding rect and kept in sync by closing on scroll/resize
// rather than re-measuring continuously, which is simpler and matches how
// most menus behave once the anchor itself has moved out from under you.
export function RowActionsMenu({ items, label = "Actions" }: { items: RowActionItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; right: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function handleScrollOrResize() {
      setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [open]);

  function toggle() {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setCoords({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    }
    setOpen((o) => !o);
  }

  if (items.length === 0) {
    return <span className="text-[12.5px] text-text-secondary" aria-hidden>—</span>;
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        className="flex size-9 items-center justify-center rounded-lg text-text-secondary transition-colors duration-150 hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      >
        <MoreHorizontal className="size-4" aria-hidden />
      </button>
      {open && coords &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ top: coords.top, right: coords.right }}
            className="fixed z-50 w-52 overflow-hidden rounded-lg border border-border-strong bg-surface-raised py-1.5 shadow-card"
          >
            {items.map((item) => (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                disabled={item.disabled || item.loading}
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
                className={clsx(
                  "flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13.5px] font-medium transition-colors duration-150",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                  item.variant === "danger"
                    ? "text-danger-600 hover:bg-danger-50"
                    : "text-text-primary hover:bg-surface-sunken",
                )}
              >
                <span className="flex size-4 shrink-0 items-center justify-center">{item.icon}</span>
                {item.loading ? "Working…" : item.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
