import * as React from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'success' | 'warning' | 'error' | 'ai' | 'urgent' | 'neutral';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
  size?: 'sm' | 'md';
}

const VARIANT: Record<Variant, string> = {
  primary: 'bg-accent-primary/15 text-accent-primary',
  success: 'bg-accent-success/15 text-accent-success',
  warning: 'bg-accent-warning/15 text-accent-warning',
  error: 'bg-accent-error/15 text-accent-error',
  ai: 'bg-accent-ai/15 text-accent-ai',
  // Strongest visual emphasis — uppercase + slightly heavier bg.
  urgent: 'bg-accent-error/24 text-accent-error uppercase tracking-wider',
  neutral: 'bg-surface-container-high text-on-surface-variant',
};

const SIZE: Record<NonNullable<BadgeProps['size']>, string> = {
  sm: 'h-[22px] px-2 text-label-sm',
  md: 'h-7 px-3 text-label-md',
};

export function Badge({
  className,
  variant = 'primary',
  size = 'md',
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full font-medium',
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
