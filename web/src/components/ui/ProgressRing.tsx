import { cn } from '@/lib/cn';

interface ProgressRingProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  label?: string;
  /** When provided, rendered in the centre instead of the percentage. */
  centerLabel?: React.ReactNode;
  className?: string;
}

/**
 * SVG ring. The track + indicator are circles with rotated stroke
 * dasharray; identical math to the mobile ProgressRing so screens
 * line up.
 */
export function ProgressRing({
  value,
  max = 100,
  size = 120,
  strokeWidth = 8,
  color = 'var(--accent-success)',
  trackColor = 'rgba(146, 146, 152, 0.4)',
  label,
  centerLabel,
  className,
}: ProgressRingProps) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 320ms cubic-bezier(0.16,1,0.3,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {centerLabel ?? (
          <div className="text-center">
            <div className="text-headline-md text-on-surface tabular-nums">{Math.round(pct)}</div>
          </div>
        )}
      </div>
    </div>
  );
}
