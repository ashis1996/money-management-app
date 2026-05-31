'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';

interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  /** Accessible label for screen readers. Required. */
  label: string;
  /** Visible hint shown alongside the toggle (optional). */
  hint?: string;
  className?: string;
}

/**
 * Two-state switch. Intentionally minimal: the surrounding row component
 * (e.g. SettingsRow) is responsible for layout, label rendering, and
 * disabled-row styling. We only render the indicator so it can be reused
 * in inline contexts.
 */
export function Toggle({
  checked,
  onChange,
  disabled,
  label,
  hint,
  className,
}: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-describedby={hint ? `${label}-hint` : undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors duration-snappy',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-outline',
        checked
          ? 'bg-accent-ai border-accent-ai'
          : 'bg-surface-container-high border-[var(--border-default)]',
        disabled && 'opacity-40 cursor-not-allowed',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'absolute left-0.5 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full transition-transform duration-snappy',
          checked ? 'translate-x-5 bg-white' : 'translate-x-0 bg-outline',
        )}
      />
    </button>
  );
}
