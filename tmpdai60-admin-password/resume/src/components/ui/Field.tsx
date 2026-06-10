import { cloneElement, isValidElement, useId } from "react";

interface FieldProps {
  /** Visible label text (or nodes, e.g. an inline hint). */
  label: React.ReactNode;
  /** Adds a red asterisk and aria-required on the control. */
  required?: boolean;
  /** Optional helper text rendered under the control. */
  hint?: React.ReactNode;
  /** Wrapper class (defaults to none — caller controls grid/spacing). */
  className?: string;
  labelClassName?: string;
  /** The single form control (input / textarea / select). */
  children: React.ReactElement;
}

const DEFAULT_LABEL = "block text-xs font-medium text-gray-400 mb-1";

/**
 * Associates a label with its control via htmlFor/id so screen readers announce the
 * label (not the placeholder). The control is passed as the single child; Field injects
 * a generated id unless the child already has one.
 */
export function Field({ label, required, hint, className, labelClassName, children }: FieldProps) {
  const autoId = useId();
  const childProps = (isValidElement(children) ? children.props : {}) as { id?: string };
  const inputId = childProps.id ?? autoId;
  const hintId = hint ? `${inputId}-hint` : undefined;

  const control = isValidElement(children)
    ? cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        id: inputId,
        "aria-required": required || undefined,
        "aria-describedby": hintId,
      })
    : children;

  return (
    <div className={className}>
      <label htmlFor={inputId} className={labelClassName ?? DEFAULT_LABEL}>
        {label}
        {required && <span className="text-red-400"> *</span>}
      </label>
      {control}
      {hint && (
        <p id={hintId} className="text-xs text-gray-500 mt-1">
          {hint}
        </p>
      )}
    </div>
  );
}

export default Field;
