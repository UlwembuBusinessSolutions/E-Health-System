import type { ReactNode } from "react";
import clsx from "clsx";

export type LedgerTabKey = "movements" | "receipts";

const TABS: { key: LedgerTabKey; label: string }[] = [
  { key: "movements", label: "Movements" },
  { key: "receipts", label: "Receipts" },
];

interface LedgerTabsProps {
  active: LedgerTabKey;
  onChange: (tab: LedgerTabKey) => void;
  counts: Partial<Record<LedgerTabKey, number>>;
  children: ReactNode;
}

// The strip scrolls sideways on a narrow phone rather than wrapping or clipping.
export function LedgerTabs({ active, onChange, counts, children }: LedgerTabsProps) {
  return (
    <div>
      <div role="tablist" aria-label="Ledger views" className="mb-4 flex gap-1 overflow-x-auto border-b border-border-subtle">
        {TABS.map(({ key, label }) => {
          const selected = key === active;
          const count = counts[key];
          return (
            <button
              key={key}
              type="button"
              role="tab"
              id={`ledger-tab-${key}`}
              aria-selected={selected}
              aria-controls="ledger-tabpanel"
              onClick={() => onChange(key)}
              className={clsx(
                "-mb-px min-h-11 shrink-0 border-b-2 px-4 text-[14px] font-semibold",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
                selected
                  ? "border-brand-500 text-brand-700"
                  : "border-transparent text-text-secondary hover:text-text-primary",
              )}
            >
              {label}
              {count !== undefined && <span className="ml-2 tabular-nums">({count.toLocaleString("en-ZA")})</span>}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id="ledger-tabpanel" aria-labelledby={`ledger-tab-${active}`}>
        {children}
      </div>
    </div>
  );
}
