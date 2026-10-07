import type { ReactNode } from "react";
import clsx from "clsx";
import "../lib/print.css";

interface PrintAreaProps {
  /** Also show the block on screen (a purchase order); otherwise it exists only on paper. */
  visibleOnScreen?: boolean;
  className?: string;
  children: ReactNode;
}

export function PrintArea({ visibleOnScreen = false, className, children }: PrintAreaProps) {
  return <div className={clsx("print-area", !visibleOnScreen && "hidden print:block", className)}>{children}</div>;
}
