'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Wallet } from 'lucide-react';
import { cn } from '@/lib/cn';
import { PublicEnv } from '@/lib/env';
import { useUnreadCount } from '@/hooks/useNotifications';
import { NAV_GROUPS, isNavItemActive } from './navItems';

/**
 * Desktop-only sticky sidebar. Active item gets a 3px leading bar in
 * `accent-primary` plus a `surface-container-high` pill background.
 *
 * Below `lg`, this component renders nothing — the responsive nav is
 * handled by `MobileNav`, which iterates over the same `NAV_GROUPS`
 * config so the two surfaces can never drift.
 */
export function Sidebar() {
  const pathname = usePathname();
  const unread = useUnreadCount();
  const badgeFor = (key?: string): number | null => {
    if (key === 'notifications') return unread.data ?? null;
    return null;
  };

  return (
    <aside className="hidden lg:flex h-screen w-60 flex-col border-r border-outline-variant bg-surface-container-low p-3 sticky top-0">
      <div className="flex items-center gap-2 px-3 py-3 mb-2">
        <div className="ai-orb h-9 w-9 flex items-center justify-center">
          <Wallet size={18} className="text-white" strokeWidth={2} />
        </div>
        <div>
          <div className="text-headline-sm text-on-surface leading-none">{PublicEnv.appName}</div>
          <div className="text-label-sm text-on-surface-variant mt-1">v{PublicEnv.appVersion}</div>
        </div>
      </div>

      <nav className="flex-1 flex flex-col gap-3 overflow-y-auto" aria-label="Primary">
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
  );
}
