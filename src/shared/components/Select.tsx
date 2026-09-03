import { forwardRef, useId, type SelectHTMLAttributes } from "react";
import clsx from "clsx";
import { ChevronDown } from "lucide-react";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  label: string;
  options: SelectOption[];
  placeholder?: string;
  error?: string;
  hint?: string;
  required?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, options, placeholder = "Select…", error, hint, required, id, className, disabled, value, ...rest },
  ref,
) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const describedBy = error ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined;
  // react-hook-form's register() never passes `value` (it reads the DOM via
  // ref instead) — defaultValue="" is for that uncontrolled case. A caller
  // driving this with its own useState (PatientDetailPage's own start-visit
  // form, the first one to do so) passes `value` directly, and React
  // rejects an element carrying both defaultValue and value on the same
  // render ("must be either controlled or uncontrolled"). Only ever supply
  // one.
  const valueProps = value === undefined ? { defaultValue: "" } : { value };

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={selectId} className="text-[13px] font-medium text-text-primary">
        {label}
        {required && <span className="text-danger-500"> *</span>}
      </label>
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          {...valueProps}
          className={clsx(
            "h-11 w-full appearance-none rounded-lg border bg-surface-raised pl-3.5 pr-10 text-[15px] text-text-primary",
            "outline-none transition-colors duration-150",
            "focus:border-brand-400 focus:ring-2 focus:ring-brand-100",
            "disabled:cursor-not-allowed disabled:opacity-60",
            error ? "border-danger-500 focus:border-danger-500 focus:ring-danger-50" : "border-border-strong",
            className,
          )}
          {...rest}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-text-secondary"
          aria-hidden
        />
      </div>
      {error ? (
        <p id={`${selectId}-error`} className="text-[13px] text-danger-500">
          {error}
        </p>
      ) : hint ? (
        <p id={`${selectId}-hint`} className="text-[13px] text-text-secondary">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
