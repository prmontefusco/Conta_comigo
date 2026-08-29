"use client";

import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { cn } from "./primitives";

/**
 * Form fields.
 *
 * Every field has a real `<label>` bound to its input, errors are announced,
 * and hints are wired through `aria-describedby`. Forms are where an
 * accessibility shortcut hurts most, so none are taken here.
 */

interface FieldWrapperProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: (ids: { id: string; describedBy: string | undefined }) => ReactNode;
}

export function Field({ label, hint, error, required, children }: FieldWrapperProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
        {required ? (
          <span className="ml-0.5 text-[color:var(--tone-critical)]" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>

      {children({ id, describedBy })}

      {hint ? (
        <p id={hintId} className="text-xs" style={{ color: "var(--muted-fg)" }}>
          {hint}
        </p>
      ) : null}

      {error ? (
        <p
          id={errorId}
          role="alert"
          className="text-xs font-medium text-[color:var(--tone-critical)]"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

const CONTROL_CLASS =
  "block min-h-11 w-full rounded-lg border border-[color:var(--card-border)] " +
  "bg-[color:var(--card-bg)] px-3 text-base " +
  "aria-[invalid=true]:border-[color:var(--color-critical-600)]";

export function TextField({
  label,
  hint,
  error,
  required,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
}) {
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      {({ id, describedBy }) => (
        <input
          id={id}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          required={required}
          className={cn(CONTROL_CLASS)}
          {...rest}
        />
      )}
    </Field>
  );
}

/**
 * A money input.
 *
 * Uses `inputMode="decimal"` so phones show a numeric keypad, and accepts both
 * "1.234,56" and "1234.56" - people paste values from many places
 * (see Money.fromDecimalString).
 */
export function MoneyField({
  label,
  hint,
  error,
  required,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
}) {
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      {({ id, describedBy }) => (
        <div className="relative">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm"
            style={{ color: "var(--muted-fg)" }}
          >
            R$
          </span>
          <input
            id={id}
            inputMode="decimal"
            autoComplete="off"
            aria-describedby={describedBy}
            aria-invalid={error ? true : undefined}
            required={required}
            className={cn(CONTROL_CLASS, "tabular pl-10 text-right")}
            {...rest}
          />
        </div>
      )}
    </Field>
  );
}

export function SelectField({
  label,
  hint,
  error,
  required,
  options,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  hint?: string;
  error?: string;
  options: ReadonlyArray<{ value: string; label: string }>;
}) {
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      {({ id, describedBy }) => (
        <select
          id={id}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          required={required}
          className={cn(CONTROL_CLASS)}
          {...rest}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

export function DateField(
  props: InputHTMLAttributes<HTMLInputElement> & {
    label: string;
    hint?: string;
    error?: string;
  },
) {
  return <TextField type="date" {...props} />;
}

/** Announces a form-level failure to assistive technology. */
export function FormError({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className="rounded-lg border-l-4 border-[color:var(--color-critical-600)] bg-[color:var(--color-critical-100)] p-3 text-sm text-[color:var(--color-ink-900)]"
    >
      {children}
    </p>
  );
}
