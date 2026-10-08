import { useId, useState, type ReactNode } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { Card } from "@/shared/components/Card";

type SettingsSectionProps = {
  title: string;
  description: string;
  icon: LucideIcon;
  children: ReactNode;
  defaultOpen?: boolean;
};

// Keep each section mounted so collapsing it preserves unsaved form values.
export function SettingsSection({ title, description, icon: Icon, children, defaultOpen = false }: SettingsSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();

  return (
    <Card>
      <h2>
        <button
          type="button"
          id={`${id}-heading`}
          aria-expanded={open}
          aria-controls={`${id}-content`}
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-center gap-4 rounded-2xl p-5 text-left transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 sm:p-6"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Icon className="size-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-semibold text-text-primary">{title}</span>
            <span className="mt-1 block text-[13.5px] font-normal text-text-secondary">{description}</span>
          </span>
          <ChevronDown className={`size-5 shrink-0 text-text-secondary transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
        </button>
      </h2>
      <div id={`${id}-content`} role="region" aria-labelledby={`${id}-heading`} hidden={!open}>
        <div className="border-t border-border-subtle p-5 sm:p-6">{children}</div>
      </div>
    </Card>
  );
}
