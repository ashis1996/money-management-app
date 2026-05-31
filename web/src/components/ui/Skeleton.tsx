import { cn } from '@/lib/cn';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** width × height shortcut. Otherwise pass tailwind sizing in className. */
  w?: number | string;
  h?: number | string;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
}

export function Skeleton({ w, h, rounded = 'md', className, style, ...rest }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'skeleton',
        rounded === 'sm' && 'rounded-sm',
        rounded === 'md' && 'rounded-md',
        rounded === 'lg' && 'rounded-lg',
        rounded === 'full' && 'rounded-full',
        className,
      )}
      style={{
        width: typeof w === 'number' ? `${w}px` : w,
        height: typeof h === 'number' ? `${h}px` : h,
        ...style,
      }}
      {...rest}
    />
  );
}
