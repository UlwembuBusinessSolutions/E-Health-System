import { useId, type TextareaHTMLAttributes } from "react";

interface TextAreaFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> {
  label: string;
  required?: boolean;
  hint?: string;
}

// The shared Input is single-line; notes, reasons and messages need a textarea
// styled the same way.
export function TextAreaField({ label, required, hint, ...rest }: TextAreaFieldProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-text-primary">
        {label}
        {required && <span className="text-danger-500"> *</span>}
      </label>
      <textarea
        id={id}
        rows={3}
        required={required}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="w-full rounded-lg border border-border-strong bg-surface-raised px-3.5 py-2.5 text-[15px] text-text-primary outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        {...rest}
      />
      {hint && (
        <p id={`${id}-hint`} className="text-[13px] text-text-secondary">
          {hint}
        </p>
      )}
    </div>
  );
}
