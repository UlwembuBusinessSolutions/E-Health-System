import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import clsx from "clsx";
import { ChevronDown, type LucideIcon } from "lucide-react";

export interface MoreMenuLink {
  to: string;
  label: string;
  icon: LucideIcon;
}

// A labelled disclosure of navigation links (not role="menu" — these are
// ordinary links, so the simpler disclosure pattern is the accessible one).
// It lives outside the horizontally scrolling tab strip because overflow
// scrolling would clip the dropdown.
export function PharmacyMoreMenu({ links }: { links: MoreMenuLink[] }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  const containsActiveRoute = links.some((link) => pathname.startsWith(link.to));

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="pharmacy-more-links"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        className={clsx(
          "flex min-h-11 items-center gap-1.5 border-b-2 px-3.5 text-[13.5px] font-medium transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400",
          containsActiveRoute
            ? "border-brand-500 text-brand-700"
            : "border-transparent text-text-secondary hover:text-text-primary",
        )}
      >
        More
        <ChevronDown className={clsx("size-4 transition-transform motion-reduce:transition-none", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <ul
          id="pharmacy-more-links"
          className="absolute right-0 top-full z-20 mt-1 w-56 overflow-hidden rounded-lg border border-border-strong bg-surface-raised py-1.5 shadow-card"
        >
          {links.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  clsx(
                    "flex min-h-11 items-center gap-2.5 px-3.5 text-[13.5px] font-medium hover:bg-surface-sunken",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400",
                    isActive ? "text-brand-700" : "text-text-primary",
                  )
                }
              >
                <Icon className="size-4 shrink-0 text-text-secondary" aria-hidden />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
