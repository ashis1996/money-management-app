import * as React from 'react';
import { cn } from '@/lib/cn';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center px-6 py-12 gap-3',
        className,
      )}
    >
      {icon && (
        <div className="text-outline" aria-hidden="true">
          {icon}
        </div>
      )}
      <h3 className="text-headline-md text-on-surface">{title}</h3>
      {description && (
        <p className="text-body-md text-on-surface-variant max-w-md">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
