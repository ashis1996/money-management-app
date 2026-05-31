'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Wallet, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { PublicEnv } from '@/lib/env';
import { useUnreadCount } from '@/hooks/useNotifications';
import { NAV_GROUPS, isNavItemActive } from './navItems';

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Off-canvas drawer that mirrors the desktop `Sidebar` for viewports
 * below `lg`. Hidden on `lg+` because the persistent sidebar takes
 * over there.
 *
 * Implementation choices:
 * - The drawer is always mounted so the slide animation has a home in
 *   both directions; visibility is driven by `open`.
 * - Body scroll is locked while open so background content doesn't
 *   chase the user under the panel.
 * - Esc closes; clicks outside the panel close (the backdrop is the
 *   parent click target). Internal panel clicks `stopPropagation`.
 * - Route changes auto-close so the drawer doesn't linger after
 *   navigation. The pathname effect is the single closing point so we
 *   don't need to wire onClose into every Link.
 *
 * We intentionally don't trap Tab here. The drawer's content is short
 * (≤ 12 links + close button) and the dismissal paths above cover the
 * usual escape hatches; a full focus trap is a Phase 9.5 polish item
 * once we adopt Radix or Headless UI for dialogs system-wide.
 */
export function MobileNav({ open, onClose }: MobileNavProps) {
  const pathname = usePathname();
  const unread = useUnreadCount();
  const badgeFor = (key?: string): number | null => {
    if (key === 'notifications') return unread.data ?? null;
    return null;
  };

  // Auto-close on route change.
  useEffect(() => {
    if (open) onClose();
    // We intentionally only listen to `pathname` here; firing onClose
    // when `open` flips would cause a close-on-open loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Esc + body-scroll lock.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  return (
    <div
      id="mobile-nav"
      className={cn(
        'fixed inset-0 z-drawer lg:hidden',
        // We use visibility + pointer-events rather than
        // conditionally unmounting so the close transition can play.
        // `aria-hidden` mirrors the visual state for assistive tech.
        open ? 'visible' : 'invisible pointer-events-none',
      )}
      aria-hidden={!open}
    >
      {/* Backdrop */}
      <button
        type="button"
        tabIndex={open ? 0 : -1}
        aria-label="Close navigation"
        onClick={onClose}
        className={cn(
          'absolute inset-0 bg-black/65 transition-opacity duration-snappy ease-snappy',
          open ? 'opacity-100' : 'opacity-0',
        )}
      />

      {/* Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Primary navigation"
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'absolute left-0 top-0 h-full w-[280px] max-w-[85vw]',
          'flex flex-col border-r border-outline-variant bg-surface-container-low',
          'transition-transform duration-snappy ease-snappy',
          'shadow-modal',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center gap-2 px-3 py-3 border-b border-outline-variant/40">
          <div className="ai-orb h-9 w-9 flex items-center justify-center">
            <Wallet size={18} className="text-white" strokeWidth={2} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-headline-sm text-on-surface leading-none truncate">
              {PublicEnv.appName}
            </div>
            <div className="text-label-sm text-on-surface-variant mt-1">
              v{PublicEnv.appVersion}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="rounded-md p-2 text-on-surface-variant hover:bg-surface-container hover:text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-outline transition-colors"
          >
            <X size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        <nav
          className="flex-1 flex flex-col gap-3 overflow-y-auto p-3"
          aria-label="Primary"
        >
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="flex flex-col gap-1">
              <p className="px-3 text-label-sm uppercase tracking-wider text-on-surface-variant">
                {group.label}
              </p>
              {group.items.map((item) => {
                const active = isNavItemActive(pathname, item.href);
                const Icon = item.icon;
                const badge = badgeFor(item.badgeKey);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    onClick={onClose}
                    className={cn(
                      'group relative flex items-center gap-3 rounded-md px-3 py-2.5',
                      'text-body-md transition-colors duration-snappy ease-snappy',
                      active
                        ? 'bg-surface-container-high text-accent-primary'
                        : 'text-on-surface-variant hover:bg-surface-container/60 hover:text-on-surface',
                    )}
                  >
                    {active && (
                      <span
                        className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-accent-primary"
                        aria-hidden="true"
                      />
                    )}
                    <Icon
                      size={18}
                      strokeWidth={1.75}
                      className="flex-shrink-0"
                      aria-hidden="true"
                    />
                    <span className="flex-1 truncate">{item.label}</span>
                    {badge != null && badge > 0 && (
                      <span
                        aria-label={`${badge} unread`}
                        className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-accent-error/20 px-1.5 text-label-sm font-bold tabular-nums text-accent-error"
                      >
                        {badge > 99 ? '99+' : badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>
    </div>
  );
}
