import * as React from 'react';
import { cn } from '@/lib/cn';

type Variant = 'default' | 'hero' | 'glass' | 'ai' | 'flat';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
  /**
   * Padding preset. Most cards want `lg` (24px). Use `none` when you
   * need to attach a full-bleed media element.
   */
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  asChild?: boolean;
}

const VARIANT: Record<Variant, string> = {
  default: 'bg-surface-container border border-[var(--border-default)] rounded-lg',
  hero: 'bg-gradient-hero-card border border-[var(--border-default)] rounded-xl relative overflow-hidden',
  glass:
    'bg-[var(--glass-tint-60)] backdrop-blur-glass border border-[var(--border-glass)] rounded-lg',
  // `border-ai-animated` is the spec utility class defined in
  // globals.css. We add `rounded-lg` here because the utility uses
  // `rounded-lg` by default but apply gracefully here.
  ai: 'border-ai-animated rounded-lg',
  flat: 'bg-surface-container-low rounded-lg',
};

const PADDING: Record<NonNullable<CardProps['padding']>, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
  xl: 'p-8',
};

export function Card({
  className,
  variant = 'default',
  padding = 'lg',
  children,
  ...rest
}: CardProps) {
  return (
    <div className={cn(VARIANT[variant], PADDING[padding], className)} {...rest}>
      {children}
    </div>
  );
}
