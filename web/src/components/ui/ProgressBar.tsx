import { cn } from '@/lib/cn';

interface ProgressBarProps {
  value: number;
  max?: number;
  /** Color CSS variable / hex / rgba. Defaults to `accent-success`. */
  color?: string;
  className?: string;
  label?: string;
}

export function ProgressBar({
  value,
  max = 100,
  color = 'var(--accent-success)',
  className,
  label,
}: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      className={cn('w-full', className)}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className="h-1 w-full rounded-full bg-outline-variant/40 overflow-hidden">
        <div
          className="h-full rounded-full transition-[width] duration-soft ease-soft"
          style={{
            width: `${pct}%`,
            background: color,
            boxShadow: `0 0 12px ${color}`,
          }}
        />
      </div>
    </div>
  );
}
