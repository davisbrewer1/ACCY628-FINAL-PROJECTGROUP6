import type { ReactNode } from "react";

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
  hint?: string;
  required?: boolean;
}

export function FormField({
  label,
  htmlFor,
  children,
  className = "",
  hint,
  required = false,
}: FormFieldProps) {
  return (
    <div className={`field ${className}`.trim()}>
      <label htmlFor={htmlFor} className="label py-0">
        <span className="label-text font-semibold">
          {label}
          {required ? <span className="text-error"> *</span> : null}
        </span>
      </label>
      {children}
      {hint ? <p className="mt-1 text-xs text-base-content/60">{hint}</p> : null}
    </div>
  );
}
