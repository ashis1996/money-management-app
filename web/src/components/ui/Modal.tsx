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
  /**
   * Disable the focus trap. Off by default. The trap blocks focus
   * from leaving the dialog while it's open — you almost always want
   * this on a real modal. Provided as an escape hatch for embedded
   * dialogs that intentionally share focus with the page (rare).
   */
  disableFocusTrap?: boolean;
}

const SIZE_MAX_WIDTH: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
};

// CSS selector matching every focusable element a sighted keyboard user
// would tab to. The negative-tabindex filter excludes elements that
// have explicitly opted out (e.g. a programmatically-focused container
// wrapper).
const FOCUSABLE =
  'a[href], area[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

/**
 * Centred modal dialog. Closes on overlay click and on Escape.
 *
 * Mobile-side equivalents are bottom-sheets, but on desktop a centred
 * card is the more idiomatic shape — cancel/confirm actions sit at the
 * bottom and the content can grow without taking over the viewport.
 *
 * Focus management:
 *   - On open, focus the first focusable child (or the close button if
 *     none); save the previously-focused element.
 *   - While open, intercept Tab / Shift+Tab to keep focus inside the
 *     dialog. This is the WAI-ARIA modal-dialog pattern.
 *   - On close, restore focus to whatever was focused before open.
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
  disableFocusTrap = false,
}: ModalProps) {
  const generatedId = React.useId();
  const titleId = titleIdProp ?? `${generatedId}-title`;
  const closeRef = React.useRef<HTMLButtonElement | null>(null);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const previouslyFocused = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    previouslyFocused.current = (document.activeElement as HTMLElement) ?? null;

    // Defer one tick so the panel is mounted before we focus.
    const initialFocus = window.setTimeout(() => {
      const focusables = getFocusable(panelRef.current);
      const first = focusables[0] ?? closeRef.current;
      first?.focus();
    }, 0);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key === 'Tab' && !disableFocusTrap && panelRef.current) {
        const focusables = getFocusable(panelRef.current);
        if (focusables.length === 0) {
          // Nothing focusable inside — keep focus on the panel itself.
          e.preventDefault();
          panelRef.current.focus();
          return;
        }

        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const current = document.activeElement as HTMLElement | null;

        if (e.shiftKey && current === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && current === last) {
          e.preventDefault();
          first.focus();
        } else if (current && !panelRef.current.contains(current)) {
          // Focus escaped the panel (e.g. user clicked outside then
          // tabbed). Yank it back to the first element.
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);

    // Lock body scroll while open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.clearTimeout(initialFocus);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose, disableFocusTrap]);

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
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        // tabIndex=-1 lets the panel itself receive focus as a fallback
        // when the dialog has zero focusable children (rare — usually
        // there's at least the close button).
        tabIndex={-1}
        className={cn(
          'w-full rounded-xl border border-[var(--border-default)] bg-surface-container-highest p-6 shadow-modal',
          'max-h-[calc(100vh-2rem)] overflow-y-auto',
          'focus:outline-none',
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

/**
 * Collect focusable descendants in document order. We filter out
 * elements that are visually hidden (display:none, visibility:hidden,
 * or `inert`) — they're skipped by the browser's tab order anyway, and
 * including them in our trap would make Tab stop on invisible nodes.
 */
function getFocusable(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  const nodes = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
  return nodes.filter((el) => {
    if (el.hasAttribute('disabled')) return false;
    if (el.getAttribute('aria-hidden') === 'true') return false;
    // `offsetParent === null` is the cheap "is rendered" check. It's
    // not perfect (`position: fixed` elements also report null) but
    // it's good enough for our flows.
    if (el.offsetParent === null) {
      // Special-case the panel itself — we're inside it, so its
      // offsetParent is the dialog ancestor, not null.
      const cs = window.getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    }
    return true;
  });
}
