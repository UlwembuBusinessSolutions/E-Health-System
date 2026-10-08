import { forwardRef, useId, useState, type InputHTMLAttributes } from "react";
import clsx from "clsx";
import { Eye, EyeOff, Lock } from "lucide-react";

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
  { label, error, hint, required, id, className, ...rest },
  ref,
) {
  const [visible, setVisible] = useState(false);
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
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-text-secondary">
          <Lock className="size-4" aria-hidden />
        </span>
        <input
          ref={ref}
          id={inputId}
          type={visible ? "text" : "password"}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={clsx(
            "h-11 w-full rounded-lg border bg-surface-raised pl-10 pr-11 text-[15px] text-text-primary placeholder:text-text-secondary/70",
            "outline-none transition-colors duration-150",
            "focus:border-brand-400 focus:ring-2 focus:ring-brand-100",
            error ? "border-danger-500 focus:border-danger-500 focus:ring-danger-50" : "border-border-strong",
            className,
          )}
          {...rest}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-text-secondary hover:text-text-primary"
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOff className="size-[18px]" aria-hidden /> : <Eye className="size-[18px]" aria-hidden />}
        </button>
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
