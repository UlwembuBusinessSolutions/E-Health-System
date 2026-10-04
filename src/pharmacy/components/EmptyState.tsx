import type { ReactNode } from "react";
import { Inbox, type LucideIcon } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  /** Next step, usually a Button. */
  action?: ReactNode;
}

export function EmptyState({ title, description, icon: Icon = Inbox, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
      <Icon className="size-6 text-text-secondary" aria-hidden />
      <p className="text-[14.5px] font-semibold text-text-primary">{title}</p>
      {description && <p className="max-w-sm text-[13.5px] text-text-secondary">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
