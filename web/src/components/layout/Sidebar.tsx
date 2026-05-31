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
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { PublicEnv } from '@/lib/env';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/transactions', label: 'Transactions', icon: CreditCard },
  { href: '/subscriptions', label: 'Subscriptions', icon: Repeat },
  { href: '/insights', label: 'Insights', icon: BarChart3 },
  { href: '/ai-coach', label: 'AI Coach', icon: Sparkles },
  { href: '/settings', label: 'Settings', icon: Settings },
];

/**
 * Sticky sidebar. Active item gets a 3px leading bar in
 * `accent-primary` plus a `surface-container-high` pill background.
 *
 * Phase 5 ships the desktop sidebar only; mobile/tablet web nav is
 * a Phase 9 polish task (collapse to a top-bar tab strip on
 * `<lg`). For now, on small viewports the sidebar simply fits
 * narrower (the layout shell handles overflow).
 */
export function Sidebar() {
  const pathname = usePathname();

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

      <nav className="flex-1 flex flex-col gap-1" aria-label="Primary">
        {ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
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
              <Icon size={18} strokeWidth={1.75} className="flex-shrink-0" aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
