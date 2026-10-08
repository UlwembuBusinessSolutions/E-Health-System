import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

// Shared between the Platform Console and the tenant app — both need the
// same "title, one-line description, primary actions" header shape at the
// top of every list/detail screen.
export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-[22px] font-semibold text-text-primary" style={{ textWrap: "balance" }}>
          {title}
        </h1>
        {description && <p className="mt-1 text-[14px] text-text-secondary">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-3">{action}</div>}
    </div>
  );
}
