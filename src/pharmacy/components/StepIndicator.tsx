import clsx from "clsx";
import { Check } from "lucide-react";

interface StepIndicatorProps {
  steps: string[];
  /** Zero-based index of the step being shown. */
  current: number;
}

export function StepIndicator({ steps, current }: StepIndicatorProps) {
  return (
    <ol aria-label="Progress" className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2">
      {steps.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={step} aria-current={active ? "step" : undefined} className="flex items-center gap-2">
            <span
              className={clsx(
                "grid size-7 place-items-center rounded-full text-[12.5px] font-semibold",
                done && "bg-brand-500 text-white",
                active && "border-2 border-brand-500 text-brand-700",
                !done && !active && "border border-border-strong text-text-secondary",
              )}
            >
              {done ? <Check className="size-4" aria-hidden /> : index + 1}
            </span>
            <span className={clsx("text-[13.5px] font-medium", active ? "text-text-primary" : "text-text-secondary")}>
              {step}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
