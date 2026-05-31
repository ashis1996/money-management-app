'use client';

import { cn } from '@/lib/cn';
import { Sparkles } from 'lucide-react';

interface AiOrbProps {
  size?: number;
  onClick?: () => void;
  className?: string;
  'aria-label'?: string;
}

/**
 * The persistent AI Coach trigger. Floating orb with the AI gradient
 * background, soft outer cyan glow, and a 1.2s scale pulse.
 *
 * `motion-safe` — the pulse + glow animations honour
 * `prefers-reduced-motion: reduce` via `globals.css`.
 */
export function AiOrb({
  size = 56,
  onClick,
  className,
  'aria-label': ariaLabel = 'Open AI assistant',
}: AiOrbProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        'ai-orb inline-flex items-center justify-center',
        'transition-transform duration-tap ease-snappy',
        'active:scale-[0.92] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ai',
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Sparkles size={size * 0.42} className="text-white" strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
}
