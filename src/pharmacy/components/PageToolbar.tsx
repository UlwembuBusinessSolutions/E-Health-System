import type { ReactNode } from "react";

interface PageToolbarProps {
  /** Optional heading for the section below (the page's own title lives in PageHeader). */
  title?: string;
  /** Filters and search, left-aligned. */
  children?: ReactNode;
  /** Primary actions, right-aligned on wide screens and full-width below `sm`. */
  actions?: ReactNode;
}

export function PageToolbar({ title, children, actions }: PageToolbarProps) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="flex min-w-0 flex-1 basis-64 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        {title && <h2 className="text-[15px] font-semibold text-text-primary">{title}</h2>}
        {children}
      </div>
      {actions && (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto [&>*]:max-sm:flex-1">{actions}</div>
      )}
    </div>
  );
}
