import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import clsx from "clsx";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  icon?: ReactNode;
  required?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, icon, required, id, className, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-[13px] font-medium text-text-primary">
        {label}
        {required && <span className="text-danger-500"> *</span>}
      </label>
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-text-secondary">
            {icon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={clsx(
            "h-11 w-full rounded-lg border bg-surface-raised px-3.5 text-[15px] text-text-primary placeholder:text-text-secondary/70",
            "outline-none transition-colors duration-150",
            "focus:border-brand-400 focus:ring-2 focus:ring-brand-100",
            error ? "border-danger-500 focus:border-danger-500 focus:ring-danger-50" : "border-border-strong",
            icon && "pl-10",
            className,
          )}
          {...rest}
        />
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="text-[13px] text-danger-500">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-[13px] text-text-secondary">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
