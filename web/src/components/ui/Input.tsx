'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  /**
   * If true, renders the input area without a visible label, but
   * `aria-label` is still set from the `label` prop.
   */
  hideLabel?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    className,
    label,
    hint,
    error,
    leadingIcon,
    trailingIcon,
    hideLabel,
    id: idProp,
    'aria-label': ariaLabelProp,
    ...rest
  },
  ref,
) {
  const generatedId = React.useId();
  const id = idProp ?? generatedId;
  const labelId = `${id}-label`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      {label && !hideLabel && (
        <label id={labelId} htmlFor={id} className="text-label-md text-on-surface-variant">
          {label}
        </label>
      )}
      <div
        className={cn(
          'flex items-center gap-2 rounded-md border bg-surface-container-lowest',
          'border-[var(--border-default)] px-4 h-12',
          'transition-all duration-snappy ease-snappy',
          // AI cyan focus glow.
          'focus-within:border-accent-ai focus-within:shadow-focus-ai',
          error && 'border-accent-error/60',
        )}
      >
        {leadingIcon && (
          <span className="text-on-surface-variant flex-shrink-0">{leadingIcon}</span>
        )}
        <input
          ref={ref}
          id={id}
          aria-label={ariaLabelProp ?? (hideLabel ? label : undefined)}
          aria-invalid={!!error || undefined}
          aria-describedby={
            [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined
          }
          className={cn(
            'flex-1 bg-transparent text-body-md text-on-surface',
            'placeholder:text-outline focus:outline-none',
            className,
          )}
          {...rest}
        />
        {trailingIcon && (
          <span className="text-on-surface-variant flex-shrink-0">{trailingIcon}</span>
        )}
      </div>
      {hint && !error && (
        <p id={hintId} className="text-body-sm text-on-surface-variant">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-body-sm text-accent-error">
          {error}
        </p>
      )}
    </div>
  );
});
