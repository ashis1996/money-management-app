'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  CreditCard,
  Repeat,
  BarChart3,
  Sparkles,
  Settings,
  Wallet,
  Building,
  Target,
  PieChart,
  Bell,
  Activity,
  Droplet,
  CalendarRange,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { PublicEnv } from '@/lib/env';
import { useUnreadCount } from '@/hooks/useNotifications';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /**
   * Optional small badge — currently only Notifications uses it for the
   * unread count, but defining it on the item makes it straightforward
   * to wire up future indicators without restructuring the component.
   */
  badge?: number | null;
}

interface NavGroup {
  label?: string;
  items: NavItem[];
}

/**
 * Sticky sidebar. Active item gets a 3px leading bar in
 * `accent-primary` plus a `surface-container-high` pill background.
 *
 * Phase 8: route surface is now at full feature parity with the mobile
 * app. We split nav into three groups (overview, money, you) so the
 * 12-item rail stays scannable; the spec asked for grouped sections
 * once the surface grew past ~6 items.
 *
 * Phase 9 polish item: collapse to a top-bar tab strip below `lg`. For
 * now small viewports get a narrower sidebar that fits 12 rows because
 * `hidden lg:flex` keeps it desktop-only.
 */
export function Sidebar() {
  const pathname = usePathname();
  const unread = useUnreadCount();

  const groups: NavGroup[] = [
    {
      label: 'Overview',
      items: [
        { href: '/dashboard', label: 'Dashboard', icon: Home },
        { href: '/insights', label: 'Insights', icon: BarChart3 },
        { href: '/weekly-summary', label: 'Weekly summary', icon: CalendarRange },
      ],
    },
    {
      label: 'Money',
      items: [
        { href: '/transactions', label: 'Transactions', icon: CreditCard },
        { href: '/accounts', label: 'Accounts', icon: Building },
        { href: '/budgets', label: 'Budgets', icon: PieChart },
        { href: '/goals', label: 'Goals', icon: Target },
        { href: '/subscriptions', label: 'Subscriptions', icon: Repeat },
        { href: '/money-leaks', label: 'Money leaks', icon: Droplet },
      ],
    },
    {
      label: 'You',
      items: [
        { href: '/health-score', label: 'Health score', icon: Activity },
        { href: '/ai-coach', label: 'AI Coach', icon: Sparkles },
        {
          href: '/notifications',
          label: 'Notifications',
          icon: Bell,
          badge: unread.data ?? null,
        },
        { href: '/settings', label: 'Settings', icon: Settings },
      ],
    },
  ];

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
        {groups.map((group, gi) => (
          <div key={group.label ?? gi} className="flex flex-col gap-1">
            {group.label && (
              <p className="px-3 text-label-sm uppercase tracking-wider text-on-surface-variant">
                {group.label}
              </p>
            )}
            {group.items.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(item.href + '/');
              const Icon = item.icon;
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
                  {item.badge != null && item.badge > 0 && (
                    <span
                      aria-label={`${item.badge} unread`}
                      className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-accent-error/20 px-1.5 text-label-sm font-bold tabular-nums text-accent-error"
                    >
                      {item.badge > 99 ? '99+' : item.badge}
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
