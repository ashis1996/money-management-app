'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ai' | 'ghost' | 'destructive';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  children: React.ReactNode;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  // Solid Electric Blue with white text + 1px inset light border for
  // a subtle inner glow (per design spec).
  primary:
    'bg-accent-primary text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16)] hover:brightness-110 active:scale-[0.98]',
  // Glass-styled neutral.
  secondary:
    'bg-surface-container-high/60 backdrop-blur-glass text-on-surface border border-white/10 hover:bg-surface-container-high/80 active:scale-[0.98]',
  // AI variant: gradient text on a default surface, animated stroke.
  ai: 'relative bg-surface-container text-transparent bg-clip-text bg-gradient-ai border border-accent-ai/30 hover:border-accent-ai/60 active:scale-[0.98]',
  ghost: 'bg-transparent text-on-surface hover:bg-surface-container/60 active:scale-[0.98]',
  destructive:
    'bg-accent-error/15 text-accent-error border border-accent-error/40 hover:bg-accent-error/25 active:scale-[0.98]',
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'h-8 px-3 text-label-md rounded-md',
  md: 'h-11 px-5 text-label-md rounded-md',
  lg: 'h-13 px-6 text-body-md font-semibold rounded-md',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant = 'primary',
    size = 'md',
    loading,
    disabled,
    fullWidth,
    leadingIcon,
    trailingIcon,
    type = 'button',
    children,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 select-none',
        'transition-all duration-snappy ease-snappy',
        // Focus ring uses outline rather than tailwind ring so the
        // 2px offset from the design spec is preserved exactly.
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-outline',
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100',
        fullWidth && 'w-full',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Spinner size={size === 'lg' ? 18 : 14} />
      ) : (
        <>
          {leadingIcon}
          <span>{children}</span>
          {trailingIcon}
        </>
      )}
    </button>
  );
});

function Spinner({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className="animate-spin"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
