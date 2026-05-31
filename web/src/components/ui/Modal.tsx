'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  /**
   * Element id used for `aria-labelledby`. Defaults to a generated id.
   * Set explicitly when the title is rendered outside the header (e.g.
   * a custom hero banner) so screen readers still find it.
   */
  titleId?: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  /** Renders an `X` close button in the header. Defaults to true. */
  showClose?: boolean;
  /** Footer slot — typically a row of `Button`s. */
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_MAX_WIDTH: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
};

/**
 * Centred modal dialog. Closes on overlay click and on Escape.
 *
 * Mobile-side equivalents are bottom-sheets, but on desktop a centred
 * card is the more idiomatic shape — cancel/confirm actions sit at the
 * bottom and the content can grow without taking over the viewport.
 *
 * Focus management: we move focus to the close button when the modal
 * opens and restore it to the previously focused element on close. We
 * intentionally don't trap Tab — most flows here are short enough that
 * Esc + click-outside cover the dismiss paths, and a full focus trap
 * adds complexity we'd want to consolidate behind Radix Dialog at the
 * Phase 9 polish pass anyway.
 */
export function Modal({
  open,
  onClose,
  title,
  titleId: titleIdProp,
  description,
  children,
  showClose = true,
  footer,
  size = 'md',
  className,
}: ModalProps) {
  const generatedId = React.useId();
  const titleId = titleIdProp ?? `${generatedId}-title`;
  const closeRef = React.useRef<HTMLButtonElement | null>(null);
  const previouslyFocused = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    previouslyFocused.current = (document.activeElement as HTMLElement) ?? null;
    // defer one tick so the element is mounted before we focus it
    const t = window.setTimeout(() => closeRef.current?.focus(), 0);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);

    // Lock body scroll while open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-black/65"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'w-full rounded-xl border border-[var(--border-default)] bg-surface-container-highest p-6 shadow-modal',
          'max-h-[calc(100vh-2rem)] overflow-y-auto',
          SIZE_MAX_WIDTH[size],
          className,
        )}
      >
        {(title || showClose) && (
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {title && (
                <h2 id={titleId} className="text-headline-md text-on-surface truncate">
                  {title}
                </h2>
              )}
              {description && (
                <p className="mt-1 text-body-sm text-on-surface-variant">{description}</p>
              )}
            </div>
            {showClose && (
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="rounded-md p-1 text-on-surface-variant hover:bg-surface-container hover:text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-outline transition-colors"
              >
                <X size={20} strokeWidth={2} />
              </button>
            )}
          </div>
        )}

        <div>{children}</div>

        {footer && (
          <div className="mt-6 flex items-center justify-end gap-2">{footer}</div>
        )}
      </div>
    </div>
  );
}
