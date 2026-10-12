import type { ReactNode } from "react";
import clsx from "clsx";
import { Link, type To } from "react-router-dom";

type LinkButtonVariant = "primary" | "secondary";

interface LinkButtonProps {
  to: To;
  variant?: LinkButtonVariant;
  icon?: ReactNode;
  children: ReactNode;
}

// Navigation should be a real <a> (open in new tab, copy link, announced as a
// link) that merely looks like the shared Button, hence the matching classes.
const VARIANT_CLASSES: Record<LinkButtonVariant, string> = {
  primary: "bg-brand-500 text-white shadow-sm hover:bg-brand-600 active:bg-brand-700",
  secondary: "border border-border-strong bg-surface-raised text-text-primary hover:bg-surface-sunken",
};

export function LinkButton({ to, variant = "secondary", icon, children }: LinkButtonProps) {
  return (
    <Link
      to={to}
      className={clsx(
        "inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-[14px] font-semibold transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
        VARIANT_CLASSES[variant],
      )}
    >
      {icon}
      {children}
    </Link>
  );
}
